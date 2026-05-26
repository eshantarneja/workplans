import { describe, expect, it } from 'vitest';
import { sortWorkstreams } from './sort';
import type { Workstream } from './types';

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
