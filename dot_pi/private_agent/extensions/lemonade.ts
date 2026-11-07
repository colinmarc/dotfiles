import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LEMONADE_URL = "http://localhost:13305";
const CACHE_PATH = join(homedir(), ".cache", "pi", "lemonade-models.json");

interface LemonadeModel {
  id: string;
  checkpoint: string;
  labels: string[];
}

async function discoverModels(): Promise<LemonadeModel[] | null> {
  try {
    const resp = await fetch(`${LEMONADE_URL}/v1/models`);
    if (!resp.ok) return null;
    const body = await resp.json();
    return body.data ?? [];
  } catch {
    return null;
  }
}

function readCachedModels(): LemonadeModel[] | null {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function refresh(pi: ExtensionAPI): Promise<LemonadeModel[] | null> {
  const models = await discoverModels();
  if (models === null) return null;
  registerModels(pi, models);
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(models));
  return models;
}

function registerModels(pi: ExtensionAPI, models: LemonadeModel[]) {
  if (models.length === 0) {
    pi.unregisterProvider("lemonade");
    return;
  }

  pi.registerProvider("lemonade", {
    baseUrl: `${LEMONADE_URL}/v1`,
    apiKey: "lemonade",
    api: "openai-completions",
    models: models.map((m) => {
      const hasVision = m.labels.includes("vision");
      // Use the checkpoint name (before the colon) as the display name.
      const name = m.checkpoint.split(":")[0].split("/").pop() ?? m.id;
      return {
        id: m.id,
        name,
        reasoning: false,
        input: hasVision ? (["text", "image"] as const) : (["text"] as const),
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384,
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
          maxTokensField: "max_tokens" as const,
        },
      };
    }),
  });
}

export default function (pi: ExtensionAPI) {
  const cached = readCachedModels();
  if (cached !== null) registerModels(pi, cached);

  // Discover on session start (covers startup, reload, new session).
  pi.on("session_start", () => {
    refresh(pi).catch(() => {});
  });

  pi.registerCommand("lemonade", {
    description: "Manage lemonade server models",
    handler: async (args, ctx) => {
      const sub = args?.trim();
      if (sub !== "reload") {
        ctx.ui.notify("Usage: /lemonade reload", "warn");
        return;
      }
      const models = await refresh(pi);
      if (models === null) {
        ctx.ui.notify("Lemonade server unreachable", "error");
        return;
      }
      if (models.length === 0) {
        ctx.ui.notify("No models loaded in lemonade", "warn");
      } else {
        const names = models.map((m) => m.id).join(", ");
        ctx.ui.notify(`Lemonade: ${names}`, "info");
      }
    },
  });
}
