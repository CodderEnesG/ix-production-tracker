import { z } from 'zod';

// Single source of truth for the data model. The API validates requests with
// these schemas and the frontend reuses them for form validation and types.

export const ORDER_STATUSES = [
  'planned',
  'in_progress',
  'quality_check',
  'completed',
  'on_hold',
] as const;
export const LINES = ['Line A', 'Line B', 'Line C'] as const;
export const PRIORITIES = ['low', 'normal', 'high'] as const;
export const PRODUCTS = [
  'Air-insulated switchgear panel 12 kV',
  'Air-insulated switchgear panel 24 kV',
  'Circuit breaker module',
  'Busbar section',
  'Protection relay cabinet',
  'Low-voltage compartment',
] as const;

export const MAX_ORDER_QUANTITY = 500;

export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const LineSchema = z.enum(LINES, { error: 'Select a production line' });
export const PrioritySchema = z.enum(PRIORITIES, { error: 'Select a priority' });
export const ProductSchema = z.enum(PRODUCTS, { error: 'Select a product' });

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Line = z.infer<typeof LineSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Product = z.infer<typeof ProductSchema>;

/** Today's date as YYYY-MM-DD (UTC), the same format the API stores. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const CreateOrderSchema = z.strictObject({
  product: ProductSchema,
  line: LineSchema,
  quantity: z
    .number({ error: 'Enter a quantity' })
    .int('Use whole units')
    .min(1, 'At least 1 unit')
    .max(MAX_ORDER_QUANTITY, `At most ${MAX_ORDER_QUANTITY} units per order`),
  priority: PrioritySchema,
  dueDate: z.iso
    .date({ error: 'Pick a due date' })
    .refine(date => date >= todayIso(), 'Due date cannot be in the past'),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UpdateOrderSchema = z
  .strictObject({
    status: OrderStatusSchema.optional(),
    completedQty: z.number().int('Use whole units').min(0, 'Cannot be negative').optional(),
  })
  .refine(patch => patch.status !== undefined || patch.completedQty !== undefined, {
    error: 'Provide a status or completedQty',
  });
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;

export type StatusChange = { status: OrderStatus; at: string };

export type Order = {
  id: string;
  product: Product;
  line: Line;
  quantity: number;
  completedQty: number;
  priority: Priority;
  status: OrderStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  history: StatusChange[];
};

export type OrderFilters = {
  status?: OrderStatus;
  line?: Line;
  q?: string;
};

export type Stats = {
  kpis: {
    openOrders: number;
    inProduction: number;
    overdue: number;
    /** Share of completed orders finished on or before their due date, 0-100. */
    onTimeRate: number | null;
  };
  byLine: { line: Line; produced: number; remaining: number }[];
  recent: { orderId: string; product: Product; status: OrderStatus; at: string }[];
};

/** Error body returned by every non-2xx API response. */
export type ApiErrorBody = {
  error: string;
  issues?: { path: string; message: string }[];
};
