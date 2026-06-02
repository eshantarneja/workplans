import { WORKSTREAM_STATUS_ORDER } from './constants';
import type { Task, Workstream } from './types';

/**
 * Sort workstreams by spec order: Blocked → At Risk → On Track →
 * Not Started → Done. Within the same status, by target date ascending.
 * Workstreams with no target date come after dated ones.
 *
 * Pure: returns a new array; does not mutate the input.
 */
export function sortWorkstreams(list: Workstream[]): Workstream[] {
  return [...list].sort((a, b) => {
    const sa = WORKSTREAM_STATUS_ORDER[a.status];
    const sb = WORKSTREAM_STATUS_ORDER[b.status];
    if (sa !== sb) return sa - sb;

    // null dates sort last
    if (a.targetDate === null && b.targetDate === null) return 0;
    if (a.targetDate === null) return 1;
    if (b.targetDate === null) return -1;
    return a.targetDate.localeCompare(b.targetDate);
  });
}

/**
 * Sort tasks strictly by due date ascending (earliest first), regardless of
 * status. Tasks with no due date sort last. The '9999-12-31' sentinel keeps
 * null dates at the bottom via plain string compare (ISO dates sort
 * lexically).
 *
 * Pure: returns a new array; does not mutate the input.
 */
export function sortTasksByDue(list: Task[]): Task[] {
  return [...list].sort((a, b) =>
    (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31'),
  );
}
