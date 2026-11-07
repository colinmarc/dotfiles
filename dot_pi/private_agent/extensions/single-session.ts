import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerFlag("single-session", {
		description: "Pin this process to one session: no /new, /resume, /fork, or /clone",
		type: "boolean",
		default: false,
	});

	pi.on("session_before_switch", async (event, ctx) => {
		if (!pi.getFlag("single-session")) return;
		const action = event.reason === "new" ? "Starting a new session" : "Resuming another session";
		ctx.ui.notify(`${action} is disabled by --single-session.`, "warning");
		return { cancel: true };
	});

	pi.on("session_before_fork", async (_event, ctx) => {
		if (!pi.getFlag("single-session")) return;
		ctx.ui.notify("Forking is disabled by --single-session.", "warning");
		return { cancel: true };
	});
}
