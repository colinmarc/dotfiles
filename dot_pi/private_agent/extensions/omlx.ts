import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const OMLX_URL = "http://localhost:8123";
const CACHE_PATH = join(homedir(), ".cache", "pi", "omlx-models.json");
const OMLX_API_KEY = "YZkrfQ.utwXZFhMCd*N29Y2e7!c3zC";

interface OmlxModel {
  id: string;
  context_window?: number;
  max_tokens?: number;
}

async function discoverModels(): Promise<OmlxModel[] | null> {
  try {
    const resp = await fetch(`${OMLX_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${OMLX_API_KEY}` },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    return body.data ?? [];
  } catch {
    return null;
  }
}

function readCachedModels(): OmlxModel[] | null {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function refresh(pi: ExtensionAPI): Promise<OmlxModel[] | null> {
  const models = await discoverModels();
  if (models === null) return null;
  registerModels(pi, models);
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(models));
  return models;
}

function registerModels(pi: ExtensionAPI, models: OmlxModel[]) {
  if (models.length === 0) {
    pi.unregisterProvider("omlx");
    return;
  }

  pi.registerProvider("omlx", {
    baseUrl: `${OMLX_URL}/v1`,
    apiKey: OMLX_API_KEY,
    api: "openai-completions",
    models: models.map((m) => ({
      id: m.id,
      name: m.id,
      reasoning: false,
      input: ["text"] as const,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: m.context_window ?? 128000,
      maxTokens: m.max_tokens ?? 16384,
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
        maxTokensField: "max_tokens" as const,
      },
    })),
  });
}

export default function (pi: ExtensionAPI) {
  const cached = readCachedModels();
  if (cached !== null) registerModels(pi, cached);

  pi.on("session_start", () => {
    refresh(pi).catch(() => {});
  });

  pi.registerCommand("omlx", {
    description: "Reload available omlx models",
    handler: async (_args, ctx) => {
      const models = await refresh(pi);
      if (models === null) {
        ctx.ui.notify("omlx server unreachable", "error");
        return;
      }
      if (models.length === 0) {
        ctx.ui.notify("No models loaded in omlx", "warn");
      } else {
        const names = models.map((m) => m.id).join(", ");
        ctx.ui.notify(`omlx: ${names}`, "info");
      }
    },
  });
}
