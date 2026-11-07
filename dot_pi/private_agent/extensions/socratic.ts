/**
 * Socratic method extension.
 *
 * `/socratic [topic]` forks a conversation branch and engages in
 * question-driven exploration of the topic. `/end-socratic` returns
 * to the original position with an optional summary.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const STATE_TYPE = "socratic-session";

type SessionState = {
  active: boolean;
  originId?: string;
  topic?: string;
};

// Module-level state for the active session.
let originId: string | undefined;
let topic: string | undefined;

const ANCHOR_TYPE = "socratic-anchor";

const SOCRATIC_PROMPT = `You are a Socratic tutor. Your job is to help the user \
deeply understand the topic below through focused questioning.

Rules:
- Start with a brief (2–3 sentence) framing of the topic, then ask one clear \
question (≤25 words).
- Ask only one question at a time. Wait for the user to answer before continuing.
- Keep each question under 25 words.
- If the user's answer shows understanding, move toward more nuanced or \
complex aspects.
- If the user struggles, break the question down or approach from a simpler angle.
- Never lecture. Guide through questions. Short clarifications (one sentence) \
are fine when the user is stuck.
- If the user says something incorrect, don't correct them directly — ask a \
question that exposes the contradiction.
- Periodically summarize what the user has established so far (one sentence) \
before moving on.

Topic:
`;

const SUMMARY_PROMPT = `Summarize this Socratic dialogue. Include:
- The topic explored
- Key insights the user arrived at
- Questions that were left open or could be explored further

Be concise.`;

function setWidget(ctx: ExtensionContext, active: boolean) {
  if (!ctx.hasUI) return;
  if (!active) {
    ctx.ui.setWidget("socratic", undefined);
    return;
  }

  const label = topic ? `Socratic session: ${topic}` : "Socratic session";
  ctx.ui.setWidget("socratic", (_tui, theme) => {
    const text = new Text(
      theme.fg("warning", `${label} — return with /end-socratic`),
      0,
      0,
    );
    return {
      render(width: number) {
        return text.render(width);
      },
      invalidate() {
        text.invalidate();
      },
    };
  });
}

function getPersistedState(ctx: ExtensionContext): SessionState | undefined {
  let state: SessionState | undefined;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === STATE_TYPE) {
      state = entry.data as SessionState | undefined;
    }
  }
  return state;
}

function restoreState(ctx: ExtensionContext) {
  const state = getPersistedState(ctx);
  if (state?.active && state.originId) {
    originId = state.originId;
    topic = state.topic;
    setWidget(ctx, true);
  } else {
    originId = undefined;
    topic = undefined;
    setWidget(ctx, false);
  }
}

function clearState(ctx: ExtensionContext, pi: ExtensionAPI) {
  originId = undefined;
  topic = undefined;
  setWidget(ctx, false);
  pi.appendEntry(STATE_TYPE, { active: false });
}

export default function socraticExtension(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => restoreState(ctx));
  pi.on("session_tree", (_event, ctx) => restoreState(ctx));

  pi.registerCommand("socratic", {
    description: "Explore a topic via Socratic questioning",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Socratic mode requires interactive mode", "error");
        return;
      }

      if (originId) {
        ctx.ui.notify(
          "Already in a Socratic session. Use /end-socratic first.",
          "warning",
        );
        return;
      }

      let input = args?.trim();
      if (!input) {
        input = (await ctx.ui.editor("Topic or idea to explore:", ""))?.trim();
      }
      if (!input) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Record where to return to.
      let anchor = ctx.sessionManager.getLeafId() ?? undefined;
      if (!anchor) {
        pi.appendEntry(ANCHOR_TYPE, { createdAt: new Date().toISOString() });
        anchor = ctx.sessionManager.getLeafId() ?? undefined;
      }
      if (!anchor) {
        ctx.ui.notify("Failed to determine origin.", "error");
        return;
      }

      const lockedOrigin = anchor;
      topic = input;

      // Fork from the earliest user message so we get a clean branch.
      const entries = ctx.sessionManager.getEntries();
      const firstUser = entries.find(
        (e) => e.type === "message" && e.message.role === "user",
      );

      if (firstUser) {
        try {
          const result = await ctx.navigateTree(firstUser.id, {
            summarize: false,
            label: "socratic",
          });
          if (result.cancelled) return;
        } catch (err) {
          ctx.ui.notify(
            `Failed to fork: ${err instanceof Error ? err.message : String(err)}`,
            "error",
          );
          return;
        }
        ctx.ui.setEditorText("");
      }

      originId = lockedOrigin;
      setWidget(ctx, true);
      pi.appendEntry(STATE_TYPE, {
        active: true,
        originId: lockedOrigin,
        topic: input,
      });

      pi.sendUserMessage(`${SOCRATIC_PROMPT}${input}`);
    },
  });

  pi.registerCommand("end-socratic", {
    description: "End the Socratic session and return",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Requires interactive mode", "error");
        return;
      }

      const target = originId ?? getPersistedState(ctx)?.originId;
      if (!target) {
        ctx.ui.notify("No active Socratic session.", "info");
        return;
      }

      const choice = await ctx.ui.select("End Socratic session:", [
        "Return only",
        "Return and summarize",
      ]);

      if (choice === undefined) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }

      const summarize = choice === "Return and summarize";

      if (summarize) {
        const result = await ctx.ui.custom<{
          cancelled: boolean;
          error?: string;
        } | null>((_tui, theme, _kb, done) => {
          const loader = new BorderedLoader(
            _tui,
            theme,
            "Summarizing Socratic session...",
          );
          loader.onAbort = () => done(null);
          ctx
            .navigateTree(target, {
              summarize: true,
              customInstructions: SUMMARY_PROMPT,
              replaceInstructions: true,
            })
            .then(done)
            .catch((err) =>
              done({
                cancelled: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          return loader;
        });

        if (result === null) {
          ctx.ui.notify("Cancelled.", "info");
          return;
        }
        if (result.error) {
          ctx.ui.notify(`Failed: ${result.error}`, "error");
          return;
        }
        if (result.cancelled) {
          ctx.ui.notify("Navigation cancelled.", "info");
          return;
        }
      } else {
        try {
          const result = await ctx.navigateTree(target, { summarize: false });
          if (result.cancelled) {
            ctx.ui.notify("Navigation cancelled.", "info");
            return;
          }
        } catch (err) {
          ctx.ui.notify(
            `Failed: ${err instanceof Error ? err.message : String(err)}`,
            "error",
          );
          return;
        }
      }

      clearState(ctx, pi);
      ctx.ui.notify("Socratic session ended.", "info");
    },
  });
}
