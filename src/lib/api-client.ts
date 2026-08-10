/**
 * Typed fetch wrapper for this app's route handlers.
 *
 * The server always answers errors as `{ errorKey, details? }`, so failures
 * arrive as an ApiRequestError carrying a translation key — never a raw
 * message, stack, or database error.
 */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly errorKey: string;
  readonly details?: string[];

  constructor(status: number, errorKey: string, details?: string[]) {
    super(errorKey);
    this.name = "ApiRequestError";
    this.status = status;
    this.errorKey = errorKey;
    this.details = details;
  }
}

async function toError(response: Response): Promise<ApiRequestError> {
  let errorKey = "serverError";
  let details: string[] | undefined;

  try {
    const body = (await response.json()) as { errorKey?: unknown; details?: unknown };
    if (typeof body.errorKey === "string") errorKey = body.errorKey;
    if (Array.isArray(body.details)) {
      details = body.details.filter((d): d is string => typeof d === "string");
    }
  } catch {
    // Non-JSON response (proxy/network layer). Keep the generic key.
  }

  return new ApiRequestError(response.status, errorKey, details);
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw await toError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) });
}

/**
 * DELETE, optionally with a body.
 *
 * Some deletes carry the id of the thing they expect to remove, so the server
 * can refuse when the client is acting on a stale view (e.g. unpublishing a
 * version that is no longer the published one).
 */
export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "DELETE",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
