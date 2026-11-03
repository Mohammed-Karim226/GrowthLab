import type { Breadcrumb, Event, StackFrame } from "@sentry/nextjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/;
const hexId = /^(?:[a-f0-9]{16}|[a-f0-9]{32})$/i;
const methods = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const errorTypes = new Set(["Error", "ApplicationError", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "AggregateError"]);
const breadcrumbCategories = new Set(["fetch", "xhr", "http", "navigation", "ui.click", "ui.input", "sentry.event", "sentry.transaction"]);

/** Source locations only. Strip URL secrets and machine/user directory prefixes. */
function sourceLocation(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const filename = value.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  if (/^https?:\/\//.test(filename)) {
    try {
      const url = new URL(filename);
      if (!url.pathname.startsWith("/_next/static/")) return undefined;
      url.username = "";
      url.password = "";
      return url.href;
    } catch { return undefined; }
  }
  if (!/^[A-Za-z0-9_./:@+~$()\[\]-]+$/.test(filename)) return undefined;
  if (/^(?:webpack(?:-internal)?:\/\/|node:internal\/)/.test(filename)) return filename;
  const source = /(?:^|\/)((?:src|\.next|node_modules)\/.*)$/.exec(filename);
  return source?.[1];
}

function cleanFrame(frame: StackFrame): StackFrame {
  return {
    filename: sourceLocation(frame.filename),
    abs_path: sourceLocation(frame.abs_path),
    function: frame.function && /^[\w.$<>\[\]-]{1,120}$/.test(frame.function) ? frame.function : undefined,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    debug_id: frame.debug_id && uuid.test(frame.debug_id) ? frame.debug_id : undefined,
  };
}

/** Breadcrumb messages, DOM attributes and network URLs can contain user data. */
export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (!breadcrumb.category || !breadcrumbCategories.has(breadcrumb.category)) return null;
  const data: Record<string, string | number> = {};
  const method = breadcrumb.data?.method;
  const status = breadcrumb.data?.status_code;
  if (typeof method === "string" && methods.test(method)) data.method = method;
  if (typeof status === "number" && status >= 100 && status <= 599) data.status_code = status;
  return { category: breadcrumb.category, level: breadcrumb.level, timestamp: breadcrumb.timestamp, data };
}

/**
 * Apply an allowlist to diagnostic payloads. Original file/line, operation,
 * opaque application IDs and trace timings remain available for diagnosis.
 * Dropping malformed telemetry is preferable to affecting the request.
 */
export function sanitizeSentryEvent<T extends Event>(event: T): T | null {
  try {
    delete event.user;
    delete event.extra;
    delete event.server_name;
    delete event.logentry;
    delete event.threads;
    if (event.message) event.message = "Application operation failed";
    event.request = event.request?.method && methods.test(event.request.method)
      ? { method: event.request.method } : undefined;

    const tags: NonNullable<Event["tags"]> = {};
    for (const name of ["operation", "category"] as const) {
      const value = event.tags?.[name];
      if (typeof value === "string" && identifier.test(value)) tags[name] = value;
    }
    event.tags = tags;
    event.fingerprint = event.fingerprint?.filter((value) => value === "{{ default }}" || value === tags.operation || value === tags.category);
    if (!event.fingerprint?.length) delete event.fingerprint;

    const contexts: NonNullable<Event["contexts"]> = {};
    const application: Record<string, string> = {};
    for (const name of ["requestId", "jobId", "actorId", "tenantId"] as const) {
      const value = event.contexts?.application?.[name];
      if (typeof value === "string" && uuid.test(value)) application[name] = value;
    }
    if (Object.keys(application).length) contexts.application = application;
    const trace = event.contexts?.trace;
    if (trace && hexId.test(trace.trace_id) && hexId.test(trace.span_id)) {
      contexts.trace = {
        trace_id: trace.trace_id,
        span_id: trace.span_id,
        parent_span_id: trace.parent_span_id && hexId.test(trace.parent_span_id) ? trace.parent_span_id : undefined,
        op: trace.op && identifier.test(trace.op) ? trace.op : undefined,
        status: trace.status && identifier.test(trace.status) ? trace.status : undefined,
      };
    }
    const replayId = event.contexts?.replay?.replay_id;
    if (typeof replayId === "string" && (uuid.test(replayId) || hexId.test(replayId))) contexts.replay = { replay_id: replayId };
    event.contexts = contexts;
    event.breadcrumbs = event.breadcrumbs?.flatMap((breadcrumb) => {
      const safe = sanitizeSentryBreadcrumb(breadcrumb);
      return safe ? [safe] : [];
    });
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((exception) => ({
        type: errorTypes.has(exception.type ?? "") ? exception.type : "ApplicationError",
        value: "Application operation failed",
        mechanism: exception.mechanism ? {
          type: exception.mechanism.type && identifier.test(exception.mechanism.type) ? exception.mechanism.type : "generic",
          handled: exception.mechanism.handled,
        } : undefined,
        stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.slice(-50).map(cleanFrame) } : undefined,
      }));
    }
    // Route templates are useful; raw URLs, SQL and span attributes are not safe.
    if (event.transaction && (event.transaction_info?.source !== "route" || !/^(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )?\/[A-Za-z0-9_./[\]()-]{0,180}$/.test(event.transaction))) {
      event.transaction = "application.request";
    }
    event.spans = event.spans?.map((span) => ({
      trace_id: span.trace_id, span_id: span.span_id, parent_span_id: span.parent_span_id,
      start_timestamp: span.start_timestamp, timestamp: span.timestamp,
      op: span.op && identifier.test(span.op) ? span.op : undefined,
      status: span.status && identifier.test(span.status) ? span.status : undefined,
      data: {},
    }));
    if (event.debug_meta?.images) {
      event.debug_meta.images = event.debug_meta.images.flatMap((entry) => {
        const codeFile = sourceLocation(entry.code_file);
        return entry.type === "sourcemap" && codeFile && uuid.test(entry.debug_id)
          ? [{ type: "sourcemap" as const, code_file: codeFile, debug_id: entry.debug_id }] : [];
      });
    }
    return event;
  } catch { return null; }
}

export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
};
