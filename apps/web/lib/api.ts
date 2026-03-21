type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!baseUrl) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Request failed");
  }

  return (await response.json()) as T;
}
