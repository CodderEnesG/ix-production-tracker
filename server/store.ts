import {
  LINES,
  PRIORITIES,
  PRODUCTS,
  todayIso,
  type CreateOrderInput,
  type Order,
  type OrderFilters,
  type OrderStatus,
} from '../shared/schema.js';

// In-memory store. Good enough for a demo; on Vercel it resets whenever a new
// function instance starts. A real deployment would put this behind a database.

export type OrderPatch = { status?: OrderStatus; completedQty?: number };

export type OrderStore = {
  list(filters?: OrderFilters): Order[];
  get(id: string): Order | undefined;
  all(): Order[];
  create(input: CreateOrderInput, now?: Date): Order;
  /** Applies an already validated patch. */
  update(id: string, patch: OrderPatch, now?: Date): Order;
};

export function createStore(seed: Order[] = seedOrders()): OrderStore {
  const orders = new Map(seed.map(order => [order.id, structuredClone(order)]));
  let lastNumber = Math.max(100, ...seed.map(order => Number(order.id.slice(-4))));

  return {
    list({ status, line, q } = {}) {
      const needle = q?.trim().toLowerCase();
      return [...orders.values()]
        .filter(order => !status || order.status === status)
        .filter(order => !line || order.line === line)
        .filter(
          order =>
            !needle ||
            order.id.toLowerCase().includes(needle) ||
            order.product.toLowerCase().includes(needle),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
        .map(order => structuredClone(order));
    },

    get(id) {
      const order = orders.get(id);
      return order && structuredClone(order);
    },

    all() {
      return [...orders.values()].map(order => structuredClone(order));
    },

    create(input, now = new Date()) {
      lastNumber += 1;
      const at = now.toISOString();
      const order: Order = {
        id: `PO-${now.getUTCFullYear()}-${String(lastNumber).padStart(4, '0')}`,
        ...input,
        completedQty: 0,
        status: 'planned',
        createdAt: at,
        updatedAt: at,
        history: [{ status: 'planned', at }],
      };
      orders.set(order.id, order);
      return structuredClone(order);
    },

    update(id, patch, now = new Date()) {
      const order = orders.get(id);
      if (!order) throw new Error(`Order ${id} not found`);
      const at = now.toISOString();
      if (patch.completedQty !== undefined) order.completedQty = patch.completedQty;
      if (patch.status !== undefined && patch.status !== order.status) {
        order.status = patch.status;
        order.history.push({ status: patch.status, at });
      }
      order.updatedAt = at;
      return structuredClone(order);
    },
  };
}

// ---------------------------------------------------------------------------
// Seed data: deterministic, with dates relative to "now" so there are always
// open, overdue and completed orders to look at.

const DAY = 86_400_000;
const HOUR = 3_600_000;

const SEED_STATUSES: OrderStatus[] = [
  'completed', 'in_progress', 'planned', 'quality_check', 'completed', 'in_progress',
  'planned', 'on_hold', 'completed', 'in_progress', 'planned', 'completed',
  'in_progress', 'quality_check', 'planned', 'completed', 'in_progress', 'on_hold',
  'planned', 'in_progress', 'completed', 'quality_check', 'planned', 'in_progress',
];

const PATHS: Record<OrderStatus, OrderStatus[]> = {
  planned: ['planned'],
  in_progress: ['planned', 'in_progress'],
  quality_check: ['planned', 'in_progress', 'quality_check'],
  completed: ['planned', 'in_progress', 'quality_check', 'completed'],
  on_hold: ['planned', 'in_progress', 'on_hold'],
};

/** Small seeded PRNG so the demo data is the same on every start. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOrders(now: number = Date.now()): Order[] {
  const rand = mulberry32(2026);
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const year = new Date(now).getUTCFullYear();

  return SEED_STATUSES.map((status, i) => {
    const created = now - between(3, 28) * DAY - between(0, 8) * HOUR;
    const due = created + between(7, 30) * DAY;
    const quantity = between(2, 24) * 5;

    let end =
      status === 'completed'
        ? Math.min(now - 3 * HOUR, due + between(-5, 3) * DAY)
        : now - between(1, 30) * HOUR;
    end = Math.max(end, created + 2 * DAY);

    const path = PATHS[status];
    const history = path.map((step, k) => ({
      status: step,
      at: new Date(k === 0 ? created : created + ((end - created) * k) / (path.length - 1)).toISOString(),
    }));

    const completedQty =
      status === 'planned'
        ? 0
        : status === 'in_progress' || status === 'on_hold'
          ? between(0, quantity / 5 - 1) * 5
          : quantity;

    return {
      id: `PO-${year}-${String(101 + i).padStart(4, '0')}`,
      product: pick(PRODUCTS),
      line: LINES[i % LINES.length],
      quantity,
      completedQty,
      priority: pick(PRIORITIES),
      status,
      dueDate: todayIso(new Date(due)),
      createdAt: history[0].at,
      updatedAt: history[history.length - 1].at,
      history,
    };
  });
}
