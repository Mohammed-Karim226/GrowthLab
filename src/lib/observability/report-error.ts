import * as Sentry from "@sentry/nextjs";

export type ErrorContext = {
  /** A static call-site label, never a URL, email address or provider message. */
  operation: string;
  requestId?: string;
  jobId?: string;
  actorId?: string;
  tenantId?: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const captured = new WeakMap<object, Map<string, string | undefined>>();
const categories: Record<string, string> = {
  CREDENTIAL_CONFIG: "credential_config",
  XX000: "database_error",
  "08000": "database_connection",
  "08001": "database_connection",
  "08003": "database_connection",
  "08006": "database_connection",
  "42501": "database_permission",
  "42P01": "database_schema",
  "42703": "database_schema",
  PGRST000: "database_connection",
  PGRST001: "database_connection",
  PGRST002: "database_connection",
  PGRST003: "database_connection",
  ECONNREFUSED: "connection_failed",
  ECONNRESET: "connection_failed",
  ETIMEDOUT: "connection_timeout",
};

function categoryOf(cause: unknown): string {
  try {
    const code = cause && typeof cause === "object" ? (cause as { code?: unknown }).code : undefined;
    return typeof code === "string" && Object.prototype.hasOwnProperty.call(categories, code)
      ? categories[code]
      : "operation_failed";
  } catch {
    return "operation_failed";
  }
}

/** Keep source positions, without copying the message, function arguments or URL secrets. */
function safeStack(cause: unknown): string | undefined {
  try {
    if (!(cause instanceof Error) || typeof cause.stack !== "string") return undefined;
    const frames: string[] = [];
    for (const line of cause.stack.split("\n").slice(1, 51)) {
      // V8/Node and Firefox stacks. Only the location is needed for source maps.
      const location = line.trim().replace(/^at\s+/, "").replace(/^.*\(/, "").replace(/\)$/, "").replace(/^.*@(?=(?:https?|file|webpack):)/, "");
      const match = /^(.*):(\d{1,9}):(\d{1,9})$/.exec(location);
      if (!match) continue;
      const filename = match[1].split(/[?#]/, 1)[0].replace(/\\/g, "/");
      // Runtime source locations only; free text in a forged stack is discarded.
      if (!/^(?:https?:\/\/[^/@\s]+\/_next\/static\/|(?:file:\/\/)?(?:[A-Za-z]:)?\/[^\s]*?(?:\.next\/|src\/|node_modules\/)|webpack(?:-internal)?:\/\/[^\s]*\/|node:internal\/)/.test(filename)) continue;
      if (!/^[A-Za-z0-9_./:@+~$()\[\]-]+$/.test(filename)) continue;
      frames.push(`    at ${filename}:${match[2]}:${match[3]}`);
    }
    return frames.length ? `ApplicationError: Application operation failed\n${frames.join("\n")}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Report a handled failure without handing provider text, bodies or credentials
 * to the SDK. The SDK's beforeSend scrubber protects automatic capture as well.
 * Telemetry failure must never change the application's response or job result.
 */
export function reportError(cause: unknown, context: ErrorContext): string | undefined {
  try {
    const operation = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/.test(context.operation) ? context.operation : "application";
    const identifiers: Record<string, string> = {};
    for (const key of ["requestId", "jobId", "actorId", "tenantId"] as const) {
      const value = context[key];
      if (typeof value === "string" && uuid.test(value)) identifiers[key] = value.toLowerCase();
    }
    const captureKey = `${operation}:${identifiers.requestId ?? ""}:${identifiers.jobId ?? ""}`;
    const reference = cause && typeof cause === "object" ? cause : undefined;
    const previous = reference ? captured.get(reference) : undefined;
    if (previous?.has(captureKey)) return previous.get(captureKey);

    const category = categoryOf(cause);
    const error = new Error("Application operation failed");
    error.name = "ApplicationError";
    const originalStack = safeStack(cause);
    if (originalStack) error.stack = originalStack;

    let eventId: string | undefined;
    Sentry.withScope((scope) => {
      scope.setLevel("error");
      scope.setTags({ operation, category });
      scope.setContext("application", identifiers);
      scope.setFingerprint(["{{ default }}", operation, category]);
      eventId = Sentry.captureException(error);
    });
    if (reference) {
      const entries = previous ?? new Map<string, string | undefined>();
      entries.set(captureKey, eventId);
      captured.set(reference, entries);
    }
    return eventId;
  } catch {
    return undefined;
  }
}

/** Give a serverless failure callback a bounded opportunity to deliver its event. */
export async function flushErrors(): Promise<void> {
  try {
    await Sentry.flush(2000);
  } catch {
    // Delivery is best effort. Do not turn an exhausted job into another failure.
  }
}
