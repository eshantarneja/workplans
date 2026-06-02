import { describe, expect, it } from 'vitest';
import { sortTasksByDue, sortWorkstreams } from './sort';
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
  it('orders by status: Blocked, At Risk, On Track, Not Started, Done', () => {
    const result = sortWorkstreams([
      ws({ id: 'a', status: 'Done' }),
      ws({ id: 'b', status: 'On Track' }),
      ws({ id: 'c', status: 'Blocked' }),
      ws({ id: 'd', status: 'Not Started' }),
      ws({ id: 'e', status: 'At Risk' }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });

  it('within the same status, sorts by target date ascending', () => {
    const result = sortWorkstreams([
      ws({ id: 'a', status: 'On Track', targetDate: '2026-07-01' }),
      ws({ id: 'b', status: 'On Track', targetDate: '2026-05-15' }),
      ws({ id: 'c', status: 'On Track', targetDate: '2026-06-15' }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('null target dates sort after dated ones in the same status', () => {
    const result = sortWorkstreams([
      ws({ id: 'a', status: 'On Track', targetDate: null }),
      ws({ id: 'b', status: 'On Track', targetDate: '2026-05-15' }),
    ]);
    expect(result.map((w) => w.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const input = [ws({ id: 'a', status: 'Done' }), ws({ id: 'b', status: 'Blocked' })];
    const snapshot = input.map((w) => w.id);
    sortWorkstreams(input);
    expect(input.map((w) => w.id)).toEqual(snapshot);
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
