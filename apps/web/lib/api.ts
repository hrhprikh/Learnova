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

  const requestPromise = fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ?? controller?.signal
  }).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(data?.message ?? "Request failed");
    }

    const payload = (await response.json()) as T;

    if (isGet && cacheTtlMs > 0 && !skipCache) {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        data: payload
      });
    }

    return payload;
  }).finally(() => {
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
