import { todayIso, type Order, type OrderStatus } from './schema.js';

// Production workflow rules, shared so the UI only offers actions the API accepts.

export const STATUS_LABELS: Record<OrderStatus, string> = {
  planned: 'Planned',
  in_progress: 'In production',
  quality_check: 'Quality check',
  completed: 'Completed',
  on_hold: 'On hold',
};

/** The main stages in order; `on_hold` can interrupt any of the first three. */
export const STAGES = ['planned', 'in_progress', 'quality_check', 'completed'] as const;

const TRANSITIONS: Record<Exclude<OrderStatus, 'on_hold'>, readonly OrderStatus[]> = {
  planned: ['in_progress', 'on_hold'],
  in_progress: ['quality_check', 'on_hold'],
  // A failed quality check sends the order back to production.
  quality_check: ['completed', 'in_progress', 'on_hold'],
  completed: [],
};

type WorkflowOrder = Pick<Order, 'status' | 'history' | 'quantity' | 'completedQty'>;

/** The stage an on-hold order returns to: the last status before it was paused. */
export function statusBeforeHold(history: Order['history']): OrderStatus {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status !== 'on_hold') return history[i].status;
  }
  return 'planned';
}

export function allowedTransitions(order: WorkflowOrder): readonly OrderStatus[] {
  if (order.status === 'on_hold') return [statusBeforeHold(order.history)];
  return TRANSITIONS[order.status];
}

/** The next stage on the happy path, or null when the order is completed or on hold. */
export function nextStage(status: OrderStatus): OrderStatus | null {
  if (status === 'on_hold' || status === 'completed') return null;
  return STAGES[STAGES.indexOf(status) + 1];
}

/** Why a transition is not allowed, or null when it is. */
export function transitionError(order: WorkflowOrder, to: OrderStatus): string | null {
  if (!allowedTransitions(order).includes(to)) {
    return `Cannot move from ${STATUS_LABELS[order.status]} to ${STATUS_LABELS[to]}`;
  }
  if (to === 'quality_check' && order.completedQty < order.quantity) {
    return `All ${order.quantity} units must be produced before quality check`;
  }
  return null;
}

/** Produced units are only reported while the order is on the line. */
export function canReportUnits(status: OrderStatus): boolean {
  return status === 'in_progress';
}

export function isOverdue(order: Pick<Order, 'status' | 'dueDate'>, today = todayIso()): boolean {
  return order.status !== 'completed' && order.dueDate < today;
}
