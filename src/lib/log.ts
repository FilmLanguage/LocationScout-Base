/**
 * Structured JSONL logger for Cloud Run.
 *
 * One line per event written to stdout. Cloud Run lifts JSON stdout into
 * structured `jsonPayload` fields automatically, so:
 *
 *   gcloud logging read 'resource.type=cloud_run_revision \
 *     AND resource.labels.service_name=fl-<slug>-base' \
 *     --format='value(jsonPayload.category,jsonPayload.action,jsonPayload.status)'
 *
 * filters cleanly by category/action.
 *
 * Per-agent local copy (no workspace package) — keeps sync-all out of the
 * critical path while a parallel chip edits other agents.
 */
import { AsyncLocalStorage } from "node:async_hooks";

// Read at log-emission time, not at module load — `process.env.AGENT_NAME`
// is typically set in `src/index.ts`, but lib/* imports often resolve before
// index.ts runs `??=` defaults, so a constant captured here would be stale.
function agentName(): string {
  return process.env.AGENT_NAME ?? "unknown-agent";
}

export type LogCategory =
  | "mcp_in"
  | "mcp_out"
  | "http_in"
  | "http_out"
  | "fal"
  | "llm"
  | "db"
  | "task"
  | "data"
  | "error";

export type LogStatus = "ok" | "error" | "started" | "completed" | "skipped";

export interface LogEntry {
  ts: string;
  agent: string;
  category: LogCategory;
  action: string;
  status: LogStatus;
  duration_ms?: number;
  request_id?: string;
  details?: Record<string, unknown>;
}

interface RequestContext {
  request_id: string;
  tool_name?: string;
}

const ctx = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return ctx.getStore()?.request_id;
}

export function withRequestContext<T>(
  request_id: string,
  tool_name: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return ctx.run({ request_id, tool_name }, fn);
}

export function log(entry: Omit<LogEntry, "ts" | "agent" | "request_id">): void {
  const c = ctx.getStore();
  const line: LogEntry = {
    ts: new Date().toISOString(),
    agent: agentName(),
    request_id: c?.request_id,
    ...entry,
  };
  process.stdout.write(JSON.stringify(line) + "\n");
}

/**
 * Wrap an async operation with a started/completed (or error) pair of log
 * lines. The category/action/extra details are echoed on both lines so log
 * filters always see the same shape.
 */
export async function span<T>(
  category: LogCategory,
  action: string,
  fn: () => Promise<T>,
  extra?: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  log({ category, action, status: "started", details: extra });
  try {
    const result = await fn();
    log({
      category,
      action,
      status: "completed",
      duration_ms: Date.now() - start,
      details: extra,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    log({
      category: "error",
      action,
      status: "error",
      duration_ms: Date.now() - start,
      details: {
        ...extra,
        from_category: category,
        error_message: message.slice(0, 500),
        error_code: code,
      },
    });
    throw err;
  }
}

/**
 * Convenience: log an error caught from a swallowed `.catch(() => null)` site
 * without rethrowing. Used to convert silent failures into observable ones.
 */
export function logError(
  action: string,
  err: unknown,
  fromCategory?: LogCategory,
  extra?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string }).code;
  log({
    category: "error",
    action,
    status: "error",
    details: {
      ...extra,
      from_category: fromCategory,
      error_message: message.slice(0, 500),
      error_code: code,
    },
  });
}
