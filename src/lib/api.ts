/** Thin fetch wrapper. Sends cookies, prefixes with VITE_API_URL. */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data, (data as { message?: string })?.message || res.statusText);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
