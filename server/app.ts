import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import {
  CreateOrderSchema,
  LineSchema,
  OrderStatusSchema,
  UpdateOrderSchema,
  type ApiErrorBody,
} from '../shared/schema.js';
import { canReportUnits, STATUS_LABELS, transitionError } from '../shared/workflow.js';
import { computeStats } from './stats.js';
import { createStore, type OrderStore } from './store.js';

function validationFailed(c: Context, error: z.ZodError) {
  const body: ApiErrorBody = {
    error: 'Validation failed',
    issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
  };
  return c.json(body, 400);
}

function conflict(c: Context, message: string) {
  return c.json<ApiErrorBody>({ error: message }, 409);
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Request body must be valid JSON' });
  }
}

export function createApp(store: OrderStore = createStore()) {
  const app = new Hono().basePath('/api');

  // Optional artificial latency so loading states can be shown in a demo.
  app.use(async (_c, next) => {
    const latency = Number(process.env.DEMO_LATENCY_MS ?? 0);
    if (latency > 0) await new Promise(resolve => setTimeout(resolve, latency));
    await next();
  });

  app.get('/orders', c => {
    const status = OrderStatusSchema.optional().safeParse(c.req.query('status') || undefined);
    const line = LineSchema.optional().safeParse(c.req.query('line') || undefined);
    if (!status.success) return validationFailed(c, status.error);
    if (!line.success) return validationFailed(c, line.error);

    return c.json(store.list({ status: status.data, line: line.data, q: c.req.query('q') }));
  });

  app.get('/orders/:id', c => {
    const order = store.get(c.req.param('id'));
    if (!order) return c.json<ApiErrorBody>({ error: 'Order not found' }, 404);
    return c.json(order);
  });

  app.post('/orders', async c => {
    const parsed = CreateOrderSchema.safeParse(await readJson(c));
    if (!parsed.success) return validationFailed(c, parsed.error);

    const order = store.create(parsed.data);
    c.header('Location', `/api/orders/${order.id}`);
    return c.json(order, 201);
  });

  app.patch('/orders/:id', async c => {
    const id = c.req.param('id');
    const order = store.get(id);
    if (!order) return c.json<ApiErrorBody>({ error: 'Order not found' }, 404);

    const parsed = UpdateOrderSchema.safeParse(await readJson(c));
    if (!parsed.success) return validationFailed(c, parsed.error);
    const patch = parsed.data;

    if (patch.completedQty !== undefined) {
      if (patch.completedQty > order.quantity) {
        return c.json<ApiErrorBody>(
          {
            error: 'Validation failed',
            issues: [{ path: 'completedQty', message: `Cannot exceed the order quantity (${order.quantity})` }],
          },
          400,
        );
      }
      if (!canReportUnits(order.status)) {
        return conflict(c, `Units can only be reported while the order is ${STATUS_LABELS.in_progress}`);
      }
    }

    if (patch.status !== undefined && patch.status !== order.status) {
      // Check the transition against the order as it will be after this patch,
      // so units and the stage change can be sent together.
      const reason = transitionError({ ...order, ...patch, status: order.status }, patch.status);
      if (reason) return conflict(c, reason);
    }

    return c.json(store.update(id, patch));
  });

  app.get('/stats', c => c.json(computeStats(store.all())));

  app.notFound(c => c.json<ApiErrorBody>({ error: 'Not found' }, 404));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json<ApiErrorBody>({ error: err.message }, err.status);
    }
    // Log the details on the server, never send them to the client.
    console.error(err);
    return c.json<ApiErrorBody>({ error: 'Something went wrong on the server' }, 500);
  });

  return app;
}

const app = createApp();
export default app;
