import { describe, expect, it } from 'vitest';
import { orderBetween, sortTasksByDue, sortWorkstreams } from './sort';
import type { Task, Workstream } from './types';

function ws(partial: Partial<Workstream> & { id: string }): Workstream {
  return {
    title: partial.id,
    customer: 'PP1',
    status: 'On Track',
    startDate: null,
    targetDate: null,
    goal: '',
    headline: '',
    url: '',
    order: null,
    ...partial,
  };
}

describe('sortWorkstreams', () => {
  it('orders by order ascending, ignoring status', () => {
    const result = sortWorkstreams([
      ws({ id: 'a', order: 3000, status: 'Blocked' }),
      ws({ id: 'b', order: 1000, status: 'Done' }),
      ws({ id: 'c', order: 2000, status: 'On Track' }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts null-order workstreams last', () => {
    const result = sortWorkstreams([
      ws({ id: 'a', order: null }),
      ws({ id: 'b', order: 1000 }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['b', 'a']);
  });

  it('breaks ties (equal or both-null order) by title', () => {
    const result = sortWorkstreams([
      ws({ id: 'x', title: 'Zebra', order: null }),
      ws({ id: 'y', title: 'Apple', order: null }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['y', 'x']);
  });

  it('does not mutate the input array', () => {
    const input = [ws({ id: 'a', order: 2000 }), ws({ id: 'b', order: 1000 })];
    const snapshot = input.map((w) => w.id);
    sortWorkstreams(input);
    expect(input.map((w) => w.id)).toEqual(snapshot);
  });
});

describe('orderBetween', () => {
  it('returns the midpoint of two numbers', () => {
    expect(orderBetween(2000, 3000)).toBe(2500);
  });
  it('appends after a previous value when next is null', () => {
    expect(orderBetween(3000, null)).toBe(4000);
  });
  it('prepends before a next value when prev is null', () => {
    expect(orderBetween(null, 1000)).toBe(0);
  });
  it('returns the default gap for an empty list', () => {
    expect(orderBetween(null, null)).toBe(1000);
  });
  it('returns a fractional midpoint for adjacent neighbors', () => {
    expect(orderBetween(2000, 2001)).toBe(2000.5);
  });
});

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    title: partial.id,
    status: 'Not Started',
    owners: [],
    due: null,
    priority: null,
    notes: '',
    workstreamId: null,
    projectId: null,
    url: '',
    ...partial,
  };
}

describe('sortTasksByDue', () => {
  it('sorts by due date ascending, earliest first', () => {
    const result = sortTasksByDue([
      task({ id: 'a', due: '2026-07-01' }),
      task({ id: 'b', due: '2026-05-15' }),
      task({ id: 'c', due: '2026-06-15' }),
    ]);
    expect(result.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts strictly by due date regardless of status', () => {
    const result = sortTasksByDue([
      task({ id: 'done-late', status: 'Done', due: '2026-06-01' }),
      task({ id: 'open-early', status: 'In Progress', due: '2026-05-01' }),
      task({ id: 'blocked-mid', status: 'Blocked', due: '2026-05-15' }),
    ]);
    expect(result.map((t) => t.id)).toEqual(['open-early', 'blocked-mid', 'done-late']);
  });

  it('puts tasks with no due date last', () => {
    const result = sortTasksByDue([
      task({ id: 'none', due: null }),
      task({ id: 'dated', due: '2026-05-15' }),
    ]);
    expect(result.map((t) => t.id)).toEqual(['dated', 'none']);
  });

  it('does not mutate the input array', () => {
    const input = [task({ id: 'a', due: '2026-07-01' }), task({ id: 'b', due: '2026-05-01' })];
    const snapshot = input.map((t) => t.id);
    sortTasksByDue(input);
    expect(input.map((t) => t.id)).toEqual(snapshot);
  });
});
