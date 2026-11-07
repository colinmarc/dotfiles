import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const BASE_URL = "https://inference.baseten.co/v1";
const API_KEY_PATH = join(homedir(), ".config", "baseten", "api-key");
const CACHE_PATH = join(homedir(), ".cache", "pi", "baseten-models.json");

interface BasetenModel {
  id: string;
  name?: string;
  context_length?: number;
  max_completion_tokens?: number;
  supported_features?: string[];
  input_modalities?: string[];
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
  };
}

async function discoverModels(): Promise<BasetenModel[] | null> {
  let apiKey: string;
  try {
    apiKey = (await readFile(API_KEY_PATH, "utf8")).trim();
  } catch {
    return null;
  }

  try {
    const resp = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as { data?: BasetenModel[] };
    return body.data ?? [];
  } catch {
    return null;
  }
}

function readCachedModels(): BasetenModel[] | null {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function refresh(pi: ExtensionAPI): Promise<BasetenModel[] | null> {
  const models = await discoverModels();
  if (models === null) return null;
  registerModels(pi, models);
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(models));
  return models;
}

function perMillion(price: string | undefined): number {
  return Number(price ?? 0) * 1_000_000;
}

function registerModels(pi: ExtensionAPI, models: BasetenModel[]) {
  if (models.length === 0) {
    pi.unregisterProvider("baseten");
    return;
  }

  pi.registerProvider("baseten", {
    name: "Baseten",
    baseUrl: BASE_URL,
    apiKey: `!cat ${API_KEY_PATH}`,
    api: "openai-completions",
    models: models.map((m) => {
      const features = m.supported_features ?? [];
      return {
        id: m.id,
        name: m.name || m.id,
        reasoning: features.includes("reasoning"),
        input: m.input_modalities?.includes("image")
          ? (["text", "image"] as const)
          : (["text"] as const),
        cost: {
          input: perMillion(m.pricing?.prompt),
          output: perMillion(m.pricing?.completion),
          cacheRead: perMillion(m.pricing?.input_cache_read),
          cacheWrite: 0,
        },
        contextWindow: m.context_length ?? 128000,
        maxTokens: m.max_completion_tokens ?? 16384,
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: features.includes("reasoning_effort"),
          supportsStrictMode: false,
          maxTokensField: "max_tokens" as const,
        },
      };
    }),
  });
}

export default function (pi: ExtensionAPI) {
  const cached = readCachedModels();
  if (cached !== null) registerModels(pi, cached);

  pi.on("session_start", () => {
    refresh(pi).catch(() => {});
  });

  pi.registerCommand("baseten", {
    description: "Refresh the Baseten model list",
    handler: async (_args, ctx) => {
      const models = await refresh(pi);
      if (models === null) {
        ctx.ui.notify("Baseten model list unavailable", "error");
        return;
      }
      ctx.ui.notify(`Baseten: ${models.length} models`, "info");
    },
  });
}
