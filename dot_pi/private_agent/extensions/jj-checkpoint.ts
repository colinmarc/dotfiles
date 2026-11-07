import { statSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let root: string | undefined;
	let secondary = false;
	let warned = false;

	pi.on("session_start", async (_event, ctx) => {
		const { stdout, stderr, code } = await pi.exec("jj", ["workspace", "root"], {
			cwd: ctx.cwd,
			timeout: 5000,
		});
		root = code === 0 ? stdout.trim() : undefined;
		if (code !== 0 && !/no jj repo/i.test(stderr)) {
			ctx.ui.notify(`jj checkpoint disabled: ${stderr.trim() || `exit ${code}`}`, "error");
		}
		secondary =
			root !== undefined &&
			statSync(join(root, ".jj", "repo"), { throwIfNoEntry: false })?.isFile() === true;
	});

	const checkpoint = async (ctx: ExtensionContext) => {
		if (!root) return;
		const args = secondary ? ["workspace", "update-stale"] : ["util", "snapshot"];
		const { code, stderr } = await pi.exec("jj", ["-R", root, ...args], {
			timeout: 120000,
		});
		if (code !== 0 && !warned) {
			warned = true;
			ctx.ui.notify(`jj checkpoint failed: ${stderr.trim() || `exit ${code}`}`, "error");
		}
	};

	pi.on("turn_start", (_event, ctx) => checkpoint(ctx));
	pi.on("turn_end", (_event, ctx) => checkpoint(ctx));
}
