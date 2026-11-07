/**
 * jj Workspace Extension
 *
 * Manages a shared jj workspace so the agent can work on a different
 * revision than the user. The workspace is a sibling directory named
 * `<project>-pi`, reused across sessions.
 *
 * Commands:
 *   /workspace             - Create workspace or show picker if dirty
 *   /workspace new [rev]   - Create a new revision (optionally on top of rev)
 *   /workspace edit <rev>  - Check out an existing revision
 *   /workspace rebase <dest>  - Rebase onto dest, subtask for conflicts
 *   /workspace rebase done    - End conflict resolution subtask
 *   /workspace status         - Show current revision and status
 *   /workspace abandon        - Abandon the revision and remove the workspace
 *   /workspace delete         - Remove the workspace, keep the revision
 */

import { resolve, basename, join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";


const WORKSPACE_STATE_TYPE = "jj-workspace";
const WORKSPACE_ANCHOR_TYPE = "jj-workspace-anchor";

interface WorkspaceState {
	active: boolean;
	path: string;
	name: string;
}

interface RebaseState {
	originId: string;
}

const CONFLICT_RESOLUTION_SUMMARY_PROMPT = `We are leaving a conflict-resolution branch and returning to the main coding branch.

Summarize what happened during conflict resolution so the main branch has context.

Required sections:

## Rebase Target
- What revision was rebased onto

## Conflicted Files
- List each file that had conflicts

## Resolution
- For each file, briefly describe how the conflict was resolved

## Notes
- Any other relevant context (e.g. behavioral changes, things to watch out for)
- Or "(none)"

Be concise. The main branch needs to know what changed, not the full history.`;

export default function (pi: ExtensionAPI) {
	const projectDir = process.cwd();
	const projectName = basename(projectDir);
	const workspacesDir = join(homedir(), ".pi", "agent", "workspaces");
	const workspacePath = join(workspacesDir, `${projectName}-pi`);
	const workspaceName = `${projectName}-pi`;

	let state: WorkspaceState | null = null;
	let rebaseState: RebaseState | null = null;

	// -- jj helpers --

	// Run jj against the main repo.
	function jj(...args: string[]) {
		return pi.exec("jj", ["-R", projectDir, ...args], { timeout: 15000 });
	}

	// Run jj against the workspace.
	function jjw(...args: string[]) {
		return pi.exec("jj", ["-R", workspacePath, ...args], { timeout: 15000 });
	}

	async function workspaceExists(): Promise<boolean> {
		await mkdir(workspacesDir, { recursive: true });
		const { code } = await pi.exec("test", ["-d", `${workspacePath}/.jj`]);
		return code === 0;
	}

	// Bring the workspace up to date after operations in other
	// workspaces. This is a no-op when the workspace isn't stale.
	async function updateStale(): Promise<void> {
		const { stderr, code } = await jjw("workspace", "update-stale");
		if (code !== 0) throw new Error(`jj workspace update-stale failed: ${stderr}`);
	}

	async function workspaceDirty(): Promise<boolean> {
		if (!(await workspaceExists())) return false;
		const { stdout } = await jjw("diff", "--stat");
		return stdout.trim().length > 0;
	}

	async function workspaceStatusLine(): Promise<string> {
		const { stdout } = await jjw(
			"log", "-r", "@", "--no-graph",
			"-T", 'concat(change_id.short(8), " ", if(conflict, "CONFLICT ", ""), description.first_line())',
		);
		return stdout.trim();
	}

	async function hasConflicts(): Promise<boolean> {
		const { stdout } = await jjw(
			"log", "-r", "@", "--no-graph",
			"-T", 'if(conflict, "CONFLICT")',
		);
		return stdout.includes("CONFLICT");
	}

	// -- State management --

	async function activate(ctx: ExtensionContext) {
		state = { active: true, path: workspacePath, name: workspaceName };
		pi.appendEntry(WORKSPACE_STATE_TYPE, state);
		process.chdir(workspacePath);
		await refreshUI(ctx);
	}

	function deactivate(ctx: ExtensionContext) {
		state = null;
		pi.appendEntry(WORKSPACE_STATE_TYPE, { active: false, path: workspacePath, name: workspaceName });
		process.chdir(projectDir);
		ctx.ui.setWidget("jj-workspace", undefined);
	}

	async function restoreState(ctx: ExtensionContext) {
		state = null;
		rebaseState = null;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === WORKSPACE_STATE_TYPE) {
				const data = entry.data as WorkspaceState;
				state = data.active ? data : null;
			}
			if (entry.type === "custom" && entry.customType === "jj-workspace-rebase") {
				rebaseState = entry.data as RebaseState | null;
			}
		}

		if (state?.active) {
			// Verify the workspace still exists on disk.
			if (!(await workspaceExists())) {
				state = null;
			}
		}

		if (state?.active) {
			process.chdir(workspacePath);
		} else {
			process.chdir(projectDir);
		}

		await refreshUI(ctx);
	}

	async function refreshUI(ctx: ExtensionContext) {
		pi.events.emit("jj:changed");

		if (!state?.active) {
			ctx.ui.setWidget("jj-workspace", undefined);
			return;
		}

		if (rebaseState && ctx.hasUI) {
			ctx.ui.setWidget("jj-workspace", (_tui, theme) => {
				return new (class {
					render() {
						return [theme.fg("warning", "Conflict resolution active \u2014 return with /workspace rebase done")];
					}
					invalidate() {}
				})();
			});
		} else {
			ctx.ui.setWidget("jj-workspace", undefined);
		}
	}

	// -- Subcommands --

	async function forgetStaleWorkspace() {
		await jj("workspace", "forget", workspaceName);
	}

	async function cmdDefault(ctx: ExtensionCommandContext) {
		if (!(await workspaceExists())) {
			await forgetStaleWorkspace();
			const { stderr, code } = await jj(
				"workspace", "add", workspacePath, "--name", workspaceName,
			);
			if (code !== 0) throw new Error(`jj workspace add failed: ${stderr}`);
			await activate(ctx);
			ctx.ui.notify("Workspace created.", "info");
			return;
		}

		if (await workspaceDirty()) {
			const choice = await ctx.ui.select("Workspace has uncommitted changes:", [
				"Show status",
				"New revision on top of current",
				"Abandon and start fresh",
				"Delete workspace",
			]);
			switch (choice) {
				case "Show status":
					await cmdStatus(ctx);
					break;
				case "New revision on top of current":
					await cmdNew([], ctx);
					break;
				case "Abandon and start fresh":
					await cmdAbandon(ctx);
					break;
				case "Delete workspace":
					await cmdDelete(ctx);
					break;
			}
		} else {
			await activate(ctx);
			await cmdStatus(ctx);
		}
	}

	async function cmdNew(revArgs: string[], ctx: ExtensionCommandContext) {
		if (!(await workspaceExists())) {
			await forgetStaleWorkspace();
			const args = ["workspace", "add", workspacePath, "--name", workspaceName];
			for (const r of revArgs) args.push("-r", r);
			const { stderr, code } = await jj(...args);
			if (code !== 0) throw new Error(`jj workspace add failed: ${stderr}`);
			await activate(ctx);
			ctx.ui.notify("Workspace created.", "info");
			return;
		}

		await updateStale();
		const { stderr, code } = await jjw("new", ...revArgs);
		if (code !== 0) throw new Error(`jj new failed: ${stderr}`);

		await activate(ctx);
		const status = await workspaceStatusLine();
		ctx.ui.notify(`New revision: ${status}`, "info");
	}

	async function cmdEdit(revArgs: string[], ctx: ExtensionCommandContext) {
		if (revArgs.length === 0) {
			ctx.ui.notify("Usage: /workspace edit <revision>", "error");
			return;
		}

		if (!(await workspaceExists())) {
			await forgetStaleWorkspace();
			const { stderr, code } = await jj(
				"workspace", "add", workspacePath, "--name", workspaceName,
				"-r", revArgs[0],
			);
			if (code !== 0) throw new Error(`jj workspace add failed: ${stderr}`);
			await activate(ctx);
			ctx.ui.notify("Workspace created.", "info");
			return;
		}

		const { stderr, code } = await jjw("edit", revArgs[0]);
		if (code !== 0) throw new Error(`jj edit failed: ${stderr}`);

		await activate(ctx);
		const status = await workspaceStatusLine();
		ctx.ui.notify(`Editing: ${status}`, "info");
	}

	async function cmdRebase(destArgs: string[], ctx: ExtensionCommandContext) {
		if (destArgs[0] === "done") {
			return cmdRebaseDone(ctx);
		}
		if (destArgs.length === 0) {
			ctx.ui.notify("Usage: /workspace rebase <destination>", "error");
			return;
		}
		if (!(await workspaceExists())) {
			ctx.ui.notify("No workspace. Run /workspace first.", "error");
			return;
		}
		if (rebaseState) {
			ctx.ui.notify("Already resolving conflicts. Use /workspace rebase done first.", "warning");
			return;
		}

		const { stderr, code } = await jjw("rebase", "-d", destArgs[0]);
		if (code !== 0) throw new Error(`jj rebase failed: ${stderr}`);

		if (!(await hasConflicts())) {
			const status = await workspaceStatusLine();
			await refreshUI(ctx);
			ctx.ui.notify(`Rebased: ${status}`, "info");
			return;
		}

		// Conflicts: branch off for resolution, following the review
		// tool's subtask pattern.
		const status = await workspaceStatusLine();
		const { stdout: jjStatus } = await jjw("status");

		// Ensure we have a leaf to return to.
		let originId = ctx.sessionManager.getLeafId() ?? undefined;
		if (!originId) {
			pi.appendEntry(WORKSPACE_ANCHOR_TYPE, {});
			originId = ctx.sessionManager.getLeafId() ?? undefined;
		}
		if (!originId) {
			ctx.ui.notify("Failed to determine return point.", "error");
			return;
		}

		// Store origin before navigating (session_tree events can reset
		// module state).
		const lockedOriginId = originId;

		// Navigate to the current position to create a branch point.
		// Find the first user message to branch from, same as the review
		// tool does — this gives a clean branch in /tree.
		const entries = ctx.sessionManager.getEntries();
		const firstUserMessage = entries.find(
			(e) => e.type === "message" && e.message.role === "user",
		);

		const branchTarget = firstUserMessage?.id ?? originId;
		try {
			const result = await ctx.navigateTree(branchTarget, {
				summarize: false,
				label: "rebase-conflict-resolution",
			});
			if (result.cancelled) return;
		} catch (error) {
			ctx.ui.notify(
				`Failed to branch: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
			return;
		}

		// Clear editor (navigating to a user message fills it).
		ctx.ui.setEditorText("");

		// Restore origin after session_tree may have cleared it.
		rebaseState = { originId: lockedOriginId };
		pi.appendEntry("jj-workspace-rebase", rebaseState);
		await refreshUI(ctx);

		ctx.ui.notify("Rebase produced conflicts. Resolve them, then /workspace rebase done.", "warning");

		pi.sendUserMessage(
			`A rebase onto \`${destArgs[0]}\` produced conflicts in the workspace ` +
			`at \`${workspacePath}\`.\n\n` +
			`Current revision: ${status}\n\n` +
			`\`\`\`\n${jjStatus.trim()}\n\`\`\`\n\n` +
			`Please resolve the conflicts in the affected files.`,
		);
	}

	async function cmdRebaseDone(ctx: ExtensionCommandContext) {
		if (!rebaseState) {
			// Check branch state in case module state was lost.
			await restoreState(ctx);
		}
		if (!rebaseState) {
			ctx.ui.notify("Not in a conflict resolution subtask.", "info");
			return;
		}

		const originId = rebaseState.originId;

		const choice = await ctx.ui.select("End conflict resolution:", [
			"Return with summary",
			"Return without summary",
		]);

		if (choice === undefined) return;

		const summarize = choice === "Return with summary";

		try {
			const result = await ctx.navigateTree(originId, {
				summarize,
				customInstructions: summarize ? CONFLICT_RESOLUTION_SUMMARY_PROMPT : undefined,
				replaceInstructions: true,
			});
			if (result.cancelled) {
				ctx.ui.notify("Navigation cancelled.", "info");
				return;
			}
		} catch (error) {
			ctx.ui.notify(
				`Failed to return: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
			return;
		}

		rebaseState = null;
		pi.appendEntry("jj-workspace-rebase", null);
		await refreshUI(ctx);
		ctx.ui.notify("Returned from conflict resolution.", "info");
	}

	async function cmdStatus(ctx: ExtensionContext) {
		if (!(await workspaceExists())) {
			ctx.ui.notify("No workspace exists.", "info");
			return;
		}

		const status = await workspaceStatusLine();
		const { stdout } = await jjw("status");
		ctx.ui.notify(`${workspacePath}\n${status}\n${stdout.trim()}`, "info");
	}

	async function cmdAbandon(ctx: ExtensionCommandContext) {
		if (!(await workspaceExists())) {
			ctx.ui.notify("No workspace exists.", "info");
			return;
		}

		const ok = await ctx.ui.confirm(
			"Abandon?",
			"This will abandon the revision and remove the workspace.",
		);
		if (!ok) return;

		await jjw("status"); // snapshot working copy
		await jjw("abandon");
		await jj("workspace", "forget", workspaceName);
		deactivate(ctx); // chdir out before removing
		await pi.exec("rm", ["-rf", workspacePath]);
		ctx.ui.notify("Workspace abandoned.", "info");
	}

	async function cmdDelete(ctx: ExtensionCommandContext) {
		if (!(await workspaceExists())) {
			ctx.ui.notify("No workspace exists.", "info");
			return;
		}

		const ok = await ctx.ui.confirm(
			"Delete workspace?",
			"The revision will be kept in the repo.",
		);
		if (!ok) return;

		await jjw("status"); // snapshot working copy
		await jj("workspace", "forget", workspaceName);
		deactivate(ctx); // chdir out before removing
		await pi.exec("rm", ["-rf", workspacePath]);
		ctx.ui.notify("Workspace removed (revision kept).", "info");
	}

	// -- Command dispatch --

	pi.registerCommand("workspace", {
		description: "Manage jj workspace for agent",
		handler: async (args, ctx) => {
			const parts = args?.trim().split(/\s+/).filter(Boolean) ?? [];
			const subcommand = parts[0] ?? "";
			const rest = parts.slice(1);

			try {
				switch (subcommand) {
					case "":
						await cmdDefault(ctx);
						break;
					case "new":
						await cmdNew(rest, ctx);
						break;
					case "edit":
						await cmdEdit(rest, ctx);
						break;
					case "rebase":
						await cmdRebase(rest, ctx);
						break;
					case "status":
						await cmdStatus(ctx);
						break;
					case "abandon":
						await cmdAbandon(ctx);
						break;
					case "delete":
						await cmdDelete(ctx);
						break;
					default:
						ctx.ui.notify(`Unknown subcommand: ${subcommand}`, "error");
				}
			} catch (e: any) {
				ctx.ui.notify(e.message ?? String(e), "error");
			}
		},
	});

	// -- Events --

	pi.on("session_start", async (_event, ctx) => {
		await restoreState(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		await restoreState(ctx);
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		process.chdir(projectDir);
	});

	pi.on("before_agent_start", async (event) => {
		if (!state?.active) return;
		if (!(await workspaceExists())) return;

		let status: string;
		try {
			status = await workspaceStatusLine();
		} catch {
			return;
		}

		return {
			systemPrompt:
				event.systemPrompt +
				"\n\n## jj Workspace\n\n" +
				`Your working directory is a jj workspace. Current revision: ${status}\n` +
				`The user is working separately in \`${projectDir}\`. Do not modify files there.\n\n` +
				`**Important**: Your bash tool's cwd may not match the workspace path due to a ` +
				`pi limitation. Run \`cd ${workspacePath}\` at the start of bash commands, or ` +
				`use absolute paths. For file operations (read/write/edit), use paths relative ` +
				`to \`${workspacePath}\`.`,
		};
	});
}
