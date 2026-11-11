/**
 * VCS Guard Extension
 *
 * Blocks git commands (except inside /tmp) and restricts jj to read-only
 * operations.
 */

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, basename, join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// git is allowed when it runs in, and only touches paths under, these roots.
const GIT_ALLOWED_ROOTS = ["/tmp"];

const JJ_READONLY = new Set([
	"log",
	"diff",
	"show",
	"status",
	"st",
	"config",
]);

// Split a command line into individual commands on shell operators and newlines.
function shellCommands(command: string): string[] {
	return command.split(/\s*(?:&&|\|\||[;&|\n])\s*/);
}

function unquote(token: string): string {
	return token.replace(/^(['"])(.*)\1$/, "$2");
}

// Resolve a path, following symlinks for the longest existing prefix so that
// /tmp -> /private/tmp and symlinks out of /tmp are both handled.
function canonical(path: string, cwd: string): string {
	const expanded = path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
	let p = resolve(cwd, expanded);
	const rest: string[] = [];
	while (true) {
		try {
			return join(realpathSync(p), ...rest);
		} catch {
			const parent = dirname(p);
			if (parent === p) return resolve(cwd, expanded);
			rest.unshift(basename(p));
			p = parent;
		}
	}
}

function underAllowedRoot(path: string, cwd: string): boolean {
	const target = canonical(path, cwd);
	return GIT_ALLOWED_ROOTS.some((root) => {
		const r = canonical(root, "/");
		return target === r || target.startsWith(r + "/");
	});
}

// Check a git invocation: its effective directory (cwd or -C) and any
// path-like arguments must be under an allowed root.
function gitAllowed(simple: string, cwd: string): boolean {
	const tokens = simple.trim().split(/\s+/).map(unquote);
	const start = tokens.indexOf("git");
	let dir = cwd;
	const args = tokens.slice(start + 1);
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "-C" && args[i + 1]) {
			dir = canonical(args[++i], dir);
			continue;
		}
		const arg = args[i].replace(/^--[\w-]+=/, "");
		if (/^[\w+.-]+:\/\//.test(arg) || /^[\w.-]+@[\w.-]+:/.test(arg)) continue; // URLs
		if (/^(\/|~|\.\.)/.test(arg) && !underAllowedRoot(arg, dir)) return false;
	}
	return underAllowedRoot(dir, cwd);
}

// Get the first word (the command name) from a simple command.
function commandName(simple: string): string | undefined {
	// Skip leading env assignments like FOO=bar.
	const tokens = simple.trim().split(/\s+/);
	for (const token of tokens) {
		if (/^\w+=/.test(token)) continue;
		return token;
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = (event.input.command as string).trim();
		// Track `cd` across the command line to know where git would run.
		let cwd = ctx.cwd;

		for (const part of shellCommands(command)) {
			const name = commandName(part);

			if (name === "cd") {
				const target = unquote(part.trim().split(/\s+/)[1] ?? "~");
				cwd = canonical(target, cwd);
				continue;
			}

			if (name === "git" && !gitAllowed(part, cwd)) {
				return {
					block: true,
					reason: `git is only allowed under ${GIT_ALLOWED_ROOTS.join(", ")}. Use jj (read-only) elsewhere.`,
				};
			}

			if (name === "jj") {
				const sub = part.trim().split(/\s+/)[1];
				if (sub && !JJ_READONLY.has(sub)) {
					return {
						block: true,
						reason: `jj ${sub} is not allowed. Only read-only jj commands are permitted: ${[...JJ_READONLY].join(", ")}.`,
					};
				}
			}
		}

		return undefined;
	});
}
