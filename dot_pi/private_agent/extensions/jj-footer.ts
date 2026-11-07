/**
 * jj Footer Extension
 *
 * Replaces the default footer with a two-line footer that shows
 * the cwd and jj change ID on top, token stats and model info
 * below. Works independently of the workspace extension.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
	interface JjInfo {
		shortLen: number;
		full: string;
	}

	async function getJjInfo(): Promise<JjInfo | null> {
		const { stdout, code } = await pi.exec("jj", [
			"-R", process.cwd(),
			"log", "-r", "@", "--no-graph",
			"-T", 'change_id.shortest(4) ++ " " ++ change_id.short(8)',
		], { timeout: 5000 });
		if (code !== 0) return null;

		const parts = stdout.trim().split(" ");
		if (parts.length < 2) return null;
		return {
			shortLen: parts[0]!.length,
			full: parts[1]!,
		};
	}

	let lastCtx: any = null;

	function installFooter(ctx: { sessionManager: any; model: any; ui: any; getContextUsage?: any }) {
		lastCtx = ctx;
		let info: JjInfo | null = null;

		getJjInfo().then((result) => { info = result; });

		ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					// Top line: path (change-id)
					let topLine: string;
					const cwd = process.cwd();
					const home = process.env.HOME ?? "";
					const displayPath = home && cwd.startsWith(home)
						? "~" + cwd.slice(home.length)
						: cwd;

					if (info) {
						const changeId = theme.fg("accent", info.full.slice(0, info.shortLen))
							+ theme.fg("dim", info.full.slice(info.shortLen));
						topLine = theme.fg("dim", displayPath + " (") + changeId + theme.fg("dim", ")");
					} else {
						topLine = theme.fg("dim", displayPath);
					}

					// Bottom line: tokens on left, model on right.
					let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cacheRead += m.usage.cacheRead ?? 0;
							cacheWrite += m.usage.cacheWrite ?? 0;
							cost += m.usage.cost.total;
						}
					}

					const fmt = (n: number) => n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
					const tokens = `\u2191${fmt(input)} \u2193${fmt(output)} R${fmt(cacheRead)} W${fmt(cacheWrite)} $${cost.toFixed(3)}`;

					const usage = ctx.getContextUsage?.();
					const usageStr = usage
						? ` ${((usage.tokens / usage.contextWindow) * 100).toFixed(1)}%/${fmt(usage.contextWindow)}`
						: "";

					const thinking = pi.getThinkingLevel();
					const thinkingStr = thinking !== "off" ? ` \u2022 ${thinking}` : "";
					const model = ctx.model
						? `(${ctx.model.provider}) ${ctx.model.id}${thinkingStr}`
						: "no-model";

					const left = theme.fg("dim", tokens + usageStr);
					const right = theme.fg("dim", model);
					const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));

					return [
						truncateToWidth(topLine, width),
						truncateToWidth(left + " ".repeat(gap) + right, width),
					];
				},
			};
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		installFooter(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		installFooter(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		installFooter(ctx);
	});

	// Other extensions can emit this to trigger a refresh.
	pi.events.on("jj:changed", () => {
		if (lastCtx) installFooter(lastCtx);
	});
}
