import { refreshCurrentSession } from "@/lib/supabase-auth";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  cacheTtlMs?: number;
  skipCache?: boolean;
  timeoutMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_TIMEOUT_MS = 12000;

type ApiError = Error & {
  status?: number;
};

if (!baseUrl) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal, cacheTtlMs = 0, skipCache = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const isGet = method === "GET";
  const hasCustomSignal = Boolean(signal);

  const cacheKey = `${method}:${path}:${token ?? "anon"}`;

  if (isGet && cacheTtlMs > 0 && !skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  if (isGet && inFlightRequests.has(cacheKey)) {
    return (await inFlightRequests.get(cacheKey)) as T;
  }

  const controller = hasCustomSignal ? null : new AbortController();
  const timeoutHandle = !hasCustomSignal
    ? setTimeout(() => controller?.abort(), Math.max(1000, timeoutMs))
    : null;

  async function requestOnce(authToken?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ?? controller?.signal
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      const error = new Error(data?.message ?? "Request failed") as ApiError;
      error.status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  }

  function shouldRetryWithRefreshedToken(error: unknown) {
    if (!token) {
      return false;
    }

    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (status === 401) {
      return true;
    }

    return message.includes("invalid access token") || message.includes("jwt") || message.includes("token");
  }

  const requestPromise = (async () => {
    try {
      const payload = await requestOnce(token);
      if (isGet && cacheTtlMs > 0 && !skipCache) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          data: payload
        });
      }
      return payload;
    } catch (error) {
      if (!shouldRetryWithRefreshedToken(error)) {
        throw error;
      }

      const refreshed = await refreshCurrentSession().catch(() => null);
      const refreshedToken = refreshed?.data.session?.access_token;
      if (!refreshedToken || refreshedToken === token) {
        throw error;
      }

      const payload = await requestOnce(refreshedToken);
      if (isGet && cacheTtlMs > 0 && !skipCache) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          data: payload
        });
      }
      return payload;
    }
  })().finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    inFlightRequests.delete(cacheKey);
  });

  if (isGet) {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  return (await requestPromise) as T;
}
