/**
 * VCS Guard Extension
 *
 * Blocks git commands entirely and restricts jj to read-only operations.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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

// Get the first word (the command name) from a simple command.
function commandName(simple: string): string | undefined {
	// Skip leading env assignments like FOO=bar.
	const tokens = simple.trim().split(/\s+/);
	for (const token of tokens) {
		if (/^\w+=/.test(token)) continue;
		return unquote(token);
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") return undefined;

		const command = (event.input.command as string).trim();

		for (const part of shellCommands(command)) {
			const name = commandName(part);

			// Match `git` and absolute/relative paths to it, e.g. /usr/bin/git.
			if (name === "git" || name?.endsWith("/git")) {
				return {
					block: true,
					reason: "git is not allowed. Use jj (read-only) instead.",
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
