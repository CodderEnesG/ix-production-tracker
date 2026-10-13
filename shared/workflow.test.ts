import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  canReportUnits,
  isOverdue,
  nextStage,
  statusBeforeHold,
  transitionError,
} from './workflow.js';
import type { Order } from './schema.js';

const at = '2026-10-01T08:00:00.000Z';

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'PO-2026-0001',
    product: 'Busbar section',
    line: 'Line A',
    quantity: 10,
    completedQty: 0,
    priority: 'normal',
    status: 'planned',
    dueDate: '2026-10-20',
    createdAt: at,
    updatedAt: at,
    history: [{ status: 'planned', at }],
    ...overrides,
  };
}

describe('nextStage', () => {
  it('follows the main stages in order', () => {
    expect(nextStage('planned')).toBe('in_progress');
    expect(nextStage('in_progress')).toBe('quality_check');
    expect(nextStage('quality_check')).toBe('completed');
  });

  it('has no next stage for completed or on-hold orders', () => {
    expect(nextStage('completed')).toBeNull();
    expect(nextStage('on_hold')).toBeNull();
  });
});

describe('transitionError', () => {
  it('allows starting production on a planned order', () => {
    expect(transitionError(order(), 'in_progress')).toBeNull();
  });

  it('rejects skipping stages', () => {
    expect(transitionError(order(), 'completed')).toMatch(/Cannot move from Planned to Completed/);
  });

  it('requires every unit before quality check', () => {
    const running = order({ status: 'in_progress', completedQty: 6 });
    expect(transitionError(running, 'quality_check')).toMatch(/All 10 units/);
    expect(transitionError({ ...running, completedQty: 10 }, 'quality_check')).toBeNull();
  });

  it('lets a failed quality check go back to production', () => {
    expect(transitionError(order({ status: 'quality_check', completedQty: 10 }), 'in_progress')).toBeNull();
  });

  it('never reopens a completed order', () => {
    expect(allowedTransitions(order({ status: 'completed' }))).toEqual([]);
  });
});

describe('on hold', () => {
  const paused = order({
    status: 'on_hold',
    history: [
      { status: 'planned', at },
      { status: 'in_progress', at },
      { status: 'on_hold', at },
    ],
  });

  it('resumes to the stage before the hold', () => {
    expect(statusBeforeHold(paused.history)).toBe('in_progress');
    expect(allowedTransitions(paused)).toEqual(['in_progress']);
    expect(transitionError(paused, 'quality_check')).not.toBeNull();
  });
});

describe('canReportUnits', () => {
  it('only accepts produced units while in production', () => {
    expect(canReportUnits('in_progress')).toBe(true);
    expect(canReportUnits('planned')).toBe(false);
    expect(canReportUnits('quality_check')).toBe(false);
  });
});

describe('isOverdue', () => {
  it('flags open orders past their due date', () => {
    expect(isOverdue(order({ dueDate: '2026-10-01' }), '2026-10-02')).toBe(true);
    expect(isOverdue(order({ dueDate: '2026-10-02' }), '2026-10-02')).toBe(false);
  });

  it('ignores completed orders', () => {
    expect(isOverdue(order({ status: 'completed', dueDate: '2026-10-01' }), '2026-10-05')).toBe(false);
  });
});
