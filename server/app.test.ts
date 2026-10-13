import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Order, Stats } from '../shared/schema.js';
import { createApp } from './app.js';
import { createStore } from './store.js';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  // Fresh store per test so writes never leak between tests.
  app = createApp(createStore());
});

function json(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function futureDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const validOrder = () => ({
  product: 'Circuit breaker module',
  line: 'Line B',
  quantity: 40,
  priority: 'high',
  dueDate: futureDate(14),
});

async function findOrder(status: Order['status']) {
  const res = await app.request(`/api/orders?status=${status}`);
  const orders = (await res.json()) as Order[];
  return orders[0];
}

describe('GET /api/orders', () => {
  it('returns all seeded orders sorted by due date', async () => {
    const res = await app.request('/api/orders');
    expect(res.status).toBe(200);
    const orders = (await res.json()) as Order[];
    expect(orders).toHaveLength(24);
    const dueDates = orders.map(order => order.dueDate);
    expect(dueDates).toEqual([...dueDates].sort());
  });

  it('filters by status, line and search text', async () => {
    const res = await app.request('/api/orders?status=in_progress&line=Line%20B');
    const orders = (await res.json()) as Order[];
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every(order => order.status === 'in_progress' && order.line === 'Line B')).toBe(true);

    const search = await app.request('/api/orders?q=busbar');
    const matches = (await search.json()) as Order[];
    expect(matches.every(order => order.product.toLowerCase().includes('busbar'))).toBe(true);
  });

  it('rejects an unknown status filter with 400', async () => {
    const res = await app.request('/api/orders?status=shipped');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 404 for an unknown order', async () => {
    const res = await app.request('/api/orders/PO-1999-0001');
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiErrorBody).error).toBe('Order not found');
  });
});

describe('POST /api/orders', () => {
  it('creates a planned order and returns 201 with a Location header', async () => {
    const res = await json('POST', '/api/orders', validOrder());
    expect(res.status).toBe(201);
    const created = (await res.json()) as Order;
    expect(created).toMatchObject({ status: 'planned', completedQty: 0, line: 'Line B' });
    expect(res.headers.get('Location')).toBe(`/api/orders/${created.id}`);

    const fetched = await app.request(`/api/orders/${created.id}`);
    expect(fetched.status).toBe(200);
  });

  it('returns 400 with field issues for an invalid body', async () => {
    const res = await json('POST', '/api/orders', {
      ...validOrder(),
      quantity: 0,
      dueDate: '2020-01-01',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.issues?.map(issue => issue.path).sort()).toEqual(['dueDate', 'quantity']);
  });

  it('rejects unknown fields and malformed JSON', async () => {
    expect((await json('POST', '/api/orders', { ...validOrder(), status: 'completed' })).status).toBe(400);
    expect((await json('POST', '/api/orders', '{not json')).status).toBe(400);
  });
});

describe('PATCH /api/orders/:id', () => {
  it('moves a planned order into production and records the change', async () => {
    const planned = await findOrder('planned');
    const res = await json('PATCH', `/api/orders/${planned.id}`, { status: 'in_progress' });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as Order;
    expect(updated.status).toBe('in_progress');
    expect(updated.history.at(-1)?.status).toBe('in_progress');
  });

  it('returns 409 for a transition the workflow does not allow', async () => {
    const planned = await findOrder('planned');
    const res = await json('PATCH', `/api/orders/${planned.id}`, { status: 'completed' });
    expect(res.status).toBe(409);
  });

  it('returns 409 when quality check is requested before all units are produced', async () => {
    const running = await findOrder('in_progress');
    const res = await json('PATCH', `/api/orders/${running.id}`, { status: 'quality_check' });
    expect(res.status).toBe(409);
  });

  it('accepts the final units and the stage change in one request', async () => {
    const running = await findOrder('in_progress');
    const res = await json('PATCH', `/api/orders/${running.id}`, {
      completedQty: running.quantity,
      status: 'quality_check',
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 when produced units exceed the order quantity', async () => {
    const running = await findOrder('in_progress');
    const res = await json('PATCH', `/api/orders/${running.id}`, { completedQty: running.quantity + 1 });
    expect(res.status).toBe(400);
  });

  it('returns 409 when units are reported outside production', async () => {
    const planned = await findOrder('planned');
    const res = await json('PATCH', `/api/orders/${planned.id}`, { completedQty: 1 });
    expect(res.status).toBe(409);
  });

  it('returns 400 for an empty patch and 404 for an unknown order', async () => {
    const planned = await findOrder('planned');
    expect((await json('PATCH', `/api/orders/${planned.id}`, {})).status).toBe(400);
    expect((await json('PATCH', '/api/orders/PO-1999-0001', { status: 'in_progress' })).status).toBe(404);
  });
});

describe('GET /api/stats', () => {
  it('returns KPIs, per-line totals and recent activity', async () => {
    const res = await app.request('/api/stats');
    expect(res.status).toBe(200);
    const stats = (await res.json()) as Stats;
    expect(stats.kpis.openOrders).toBe(18);
    expect(stats.byLine.map(row => row.line)).toEqual(['Line A', 'Line B', 'Line C']);
    expect(stats.recent).toHaveLength(8);
  });
});

it('answers unknown API routes with a JSON 404', async () => {
  const res = await app.request('/api/unknown');
  expect(res.status).toBe(404);
  expect(((await res.json()) as ApiErrorBody).error).toBe('Not found');
});
