import type {
  ApiErrorBody,
  CreateOrderInput,
  Order,
  OrderFilters,
  Stats,
  UpdateOrderInput,
} from '../../shared/schema';

export type FieldIssue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly issues: FieldIssue[];

  constructor(status: number, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch (err) {
    // Aborts are expected (e.g. filters changed); let callers ignore them.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  // fetch() resolves on 4xx/5xx too, so the status has to be checked explicitly.
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body as Partial<ApiErrorBody> | null;
    throw new ApiError(res.status, error?.error ?? `Request failed (${res.status})`, error?.issues);
  }
  return body as T;
}

function toQuery(filters: OrderFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const api = {
  listOrders: (filters: OrderFilters, signal?: AbortSignal) =>
    request<Order[]>(`/orders${toQuery(filters)}`, { signal }),

  getOrder: (id: string, signal?: AbortSignal) =>
    request<Order>(`/orders/${encodeURIComponent(id)}`, { signal }),

  createOrder: (input: CreateOrderInput) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) }),

  updateOrder: (id: string, patch: UpdateOrderInput) =>
    request<Order>(`/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getStats: (signal?: AbortSignal) => request<Stats>('/stats', { signal }),
};
