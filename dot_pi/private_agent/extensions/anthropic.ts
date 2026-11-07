import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Anthropic classifies requests as subscription or extra usage from the system
// prompt. Lowercase "pi packages" lands on the extra-usage (API-billed) side.
// Matched as substrings so upstream edits to these lines don't silently
// disable the rewrite.
const PI_PACKAGES_REFERENCE = "pi packages (docs/packages.md)";
const SAFE_PI_PACKAGES_REFERENCE = "Pi packages (docs/packages.md)";
const PI_TOPIC_DOCS_LINE =
	"- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing";
const SAFE_PI_TOPIC_DOCS_LINE =
	"- When working on pi topics, read the docs and examples before implementing";

function rewriteAnthropicSystemPrompt(systemPrompt: string): string {
	return systemPrompt
		.replaceAll(PI_PACKAGES_REFERENCE, SAFE_PI_PACKAGES_REFERENCE)
		.replaceAll(PI_TOPIC_DOCS_LINE, SAFE_PI_TOPIC_DOCS_LINE);
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, ctx) => {
		if (ctx.model?.provider !== "anthropic") return;
		return { systemPrompt: rewriteAnthropicSystemPrompt(event.systemPrompt) };
	});
}
