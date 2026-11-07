/**
 * Rust Diagnostics Extension
 *
 * Maintains a persistent rust-analyzer instance and appends diagnostics
 * to edit/write tool results for Rust files. Only includes diagnostics
 * if rust-analyzer responds within a short window, so it never slows
 * down the agent.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIAG_TIMEOUT_MS = 3_000;
const INIT_TIMEOUT_MS = 10_000;

// --- LSP types (subset) ---

interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number; // 1=error, 2=warning, 3=info, 4=hint
  message: string;
}

interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: LspDiagnostic[];
}

// --- JSON-RPC over LSP transport ---

class LspClient {
  private proc: ChildProcess;
  private nextId = 1;
  private buf = "";
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  >();
  private onNotification: (method: string, params: any) => void;

  constructor(
    cwd: string,
    onNotification: (method: string, params: any) => void,
  ) {
    this.onNotification = onNotification;
    this.proc = spawn("rust-analyzer", [], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout!.setEncoding("utf-8");
    this.proc.stdout!.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr!.on("data", () => {});
    this.proc.on("exit", () => this.rejectAll("rust-analyzer exited"));
  }

  private onData(chunk: string) {
    this.buf += chunk;
    while (true) {
      const headerEnd = this.buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = this.buf.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Malformed; skip this header.
        this.buf = this.buf.slice(headerEnd + 4);
        continue;
      }

      const len = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.buf.length < bodyStart + len) break;

      const body = this.buf.slice(bodyStart, bodyStart + len);
      this.buf = this.buf.slice(bodyStart + len);

      let msg: any;
      try {
        msg = JSON.parse(body);
      } catch {
        continue;
      }

      if ("id" in msg && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      } else if ("method" in msg && "id" in msg) {
        // Server-to-client request; acknowledge it.
        this.send({ jsonrpc: "2.0", id: msg.id, result: null });
        this.onNotification(msg.method, msg.params);
      } else if ("method" in msg) {
        this.onNotification(msg.method, msg.params);
      }
    }
  }

  request(method: string, params: any, timeoutMs?: number): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`LSP request '${method}' timed out`));
        }, timeoutMs);
      }
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private rejectAll(reason: string) {
    for (const [id, p] of this.pending) {
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  notify(method: string, params: any) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private send(msg: any) {
    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this.proc.stdin!.write(header + body);
  }

  kill() {
    try {
      this.proc.kill();
    } catch {}
  }

  get alive() {
    return !this.proc.killed && this.proc.exitCode === null;
  }
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  let client: LspClient | null = null;
  let diagnostics = new Map<string, LspDiagnostic[]>();
  let diagnosticVersion = 0;
  let openFiles = new Set<string>();

  function fileUri(absPath: string): string {
    return `file://${absPath}`;
  }

  // Listeners waiting for diagnostics to update.
  // Returns true if the waiter matched and should be removed.
  let waiters: Array<(uri: string) => boolean> = [];

  function onDiagnostics(uri: string, diags: LspDiagnostic[]) {
    diagnostics.set(uri, diags);
    diagnosticVersion++;
    const remaining: typeof waiters = [];
    for (const w of waiters) {
      if (!w(uri)) remaining.push(w);
    }
    waiters = remaining;
  }

  async function ensureClient(cwd: string): Promise<LspClient | null> {
    if (client?.alive) return client;

    try {
      client = new LspClient(cwd, (method, params) => {
        if (method === "textDocument/publishDiagnostics") {
          const p = params as PublishDiagnosticsParams;
          onDiagnostics(p.uri, p.diagnostics);
        }
      });

      await client.request("initialize", {
        processId: process.pid,
        capabilities: {
          textDocument: {
            publishDiagnostics: {},
            synchronization: {
              didSave: true,
              dynamicRegistration: false,
            },
          },
        },
        rootUri: fileUri(cwd),
      }, INIT_TIMEOUT_MS);

      client.notify("initialized", {});
      return client;
    } catch {
      client?.kill();
      client = null;
      return null;
    }
  }

  // Wait for publishDiagnostics for the given URI. After the first
  // emission, waits briefly for a second (the first is often stale,
  // sent before rust-analyzer processes the latest change). Falls
  // back to whatever we have on timeout.
  function waitForDiagnostics(
    uri: string,
    timeoutMs: number,
  ): Promise<LspDiagnostic[]> {
    return new Promise<LspDiagnostic[]>((res) => {
      let seen = 0;
      let debounce: ReturnType<typeof setTimeout> | undefined;

      const timer = setTimeout(() => {
        clearTimeout(debounce);
        waiters = waiters.filter((w) => w !== check);
        res(diagnostics.get(uri) ?? []);
      }, timeoutMs);

      function resolve() {
        clearTimeout(timer);
        clearTimeout(debounce);
        res(diagnostics.get(uri) ?? []);
      }

      function check(updatedUri: string): boolean {
        if (updatedUri !== uri) return false;
        seen++;
        if (seen >= 2) {
          resolve();
          return true;
        }
        // Got the first emission; wait a short window for a second
        // (fresher) one before accepting this one.
        debounce = setTimeout(resolve, 500);
        return false;
      }
      waiters.push(check);
    });
  }

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    if (event.isError) return;

    const path = (event as any).input?.path as string | undefined;
    if (!path || !path.endsWith(".rs")) return;

    const absPath = resolve(ctx.cwd, path);
    const uri = fileUri(absPath);
    const c = await ensureClient(ctx.cwd);
    if (!c) return;

    // Notify rust-analyzer about the file content.
    let text: string;
    try {
      text = readFileSync(absPath, "utf-8");
    } catch {
      return;
    }

    const version = ++diagnosticVersion;
    let isFirstOpen = false;
    if (openFiles.has(uri)) {
      c.notify("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
    } else {
      isFirstOpen = true;
      c.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "rust", version, text },
      });
      openFiles.add(uri);
    }

    c.notify("textDocument/didSave", {
      textDocument: { uri },
      text,
    });

    // First open needs longer since rust-analyzer may still be indexing.
    const timeout = isFirstOpen ? INIT_TIMEOUT_MS : DIAG_TIMEOUT_MS;
    const diags = await waitForDiagnostics(uri, timeout);
    const relevant = diags.filter((d) => d.severity && d.severity <= 2);
    if (relevant.length === 0) return;

    const errors = relevant.filter((d) => d.severity === 1).length;
    const warnings = relevant.filter((d) => d.severity === 2).length;
    const parts = [];
    if (errors > 0) parts.push(`${errors} error(s)`);
    if (warnings > 0) parts.push(`${warnings} warning(s)`);
    const summary = `rust-analyzer: ${parts.join(", ")}`;

    const lines = relevant.map((d) => {
      const sev = d.severity === 1 ? "error" : "warning";
      const line = d.range.start.line + 1;
      return `${sev}:${line}: ${d.message}`;
    });
    const formatted = `${summary}\n${lines.join("\n")}`;

    ctx.ui.notify(summary, errors > 0 ? "error" : "warning");

    const existingText = event.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");

    return {
      content: [{ type: "text" as const, text: `${existingText}\n\n${formatted}` }],
    };
  });

  pi.on("session_shutdown", async () => {
    client?.kill();
    client = null;
  });
}
