import { LINES, todayIso, type Order, type Stats } from '../shared/schema.js';
import { isOverdue } from '../shared/workflow.js';

const RECENT_LIMIT = 8;

export function computeStats(orders: Order[], today: string = todayIso()): Stats {
  const open = orders.filter(order => order.status !== 'completed');
  const completed = orders.filter(order => order.status === 'completed');

  const onTime = completed.filter(order => {
    const finishedAt = order.history.findLast(change => change.status === 'completed')?.at;
    return finishedAt !== undefined && finishedAt.slice(0, 10) <= order.dueDate;
  });

  const recent = orders
    .flatMap(order =>
      order.history.map(change => ({
        orderId: order.id,
        product: order.product,
        status: change.status,
        at: change.at,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_LIMIT);

  return {
    kpis: {
      openOrders: open.length,
      inProduction: orders.filter(order => order.status === 'in_progress').length,
      overdue: open.filter(order => isOverdue(order, today)).length,
      onTimeRate: completed.length ? Math.round((onTime.length / completed.length) * 100) : null,
    },
    byLine: LINES.map(line => {
      const lineOrders = open.filter(order => order.line === line);
      const produced = lineOrders.reduce((sum, order) => sum + order.completedQty, 0);
      const total = lineOrders.reduce((sum, order) => sum + order.quantity, 0);
      return { line, produced, remaining: total - produced };
    }),
    recent,
  };
}
