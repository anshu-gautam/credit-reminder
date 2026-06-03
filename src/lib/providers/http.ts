// Shared HTTP helpers for provider adapters.

export class ProviderHttpError extends Error {
  status: number;
  body?: string;
  constructor(status: number, body?: string) {
    super(`Provider responded with HTTP ${status}`);
    this.name = "ProviderHttpError";
    this.status = status;
    this.body = body;
  }
}

// Raw error shape consumed by policy.classifyError.
export interface RawProviderError {
  status?: number;
  code?: string;
  type?: string;
  message?: string;
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => undefined);
      throw new ProviderHttpError(res.status, body);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Normalizes any thrown value into the shape policy.classifyError expects.
export function toRawError(error: unknown): RawProviderError {
  if (error instanceof ProviderHttpError) {
    return { status: error.status, message: error.body ?? error.message };
  }
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      status: typeof e.status === "number" ? e.status : undefined,
      code: typeof e.code === "string" ? e.code : undefined,
      type: typeof e.type === "string" ? e.type : undefined,
      message: typeof e.message === "string" ? e.message : String(error),
    };
  }
  return { message: String(error) };
}

// First day of the current UTC month.
export function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Recursively sums numeric `value`/`amount` fields in a provider cost payload.
// Defensive against the differing cost-report shapes across providers.
export function sumAmounts(node: unknown): number {
  if (node == null) return 0;
  if (Array.isArray(node)) return node.reduce((acc, n) => acc + sumAmounts(n), 0);
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    let total = 0;
    for (const [key, val] of Object.entries(obj)) {
      if ((key === "value" || key === "amount") && typeof val === "number") {
        total += val;
      } else if (key === "amount" && typeof val === "string" && !Number.isNaN(Number(val))) {
        total += Number(val);
      } else {
        total += sumAmounts(val);
      }
    }
    return total;
  }
  return 0;
}
