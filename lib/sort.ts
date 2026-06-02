import type { Task, Workstream } from './types';

const ORDER_GAP = 1000;

/**
 * Sort workstreams by their manual `order` ascending. Null orders sort last.
 * Ties (equal order, or both null) break by title so the result is fully
 * deterministic — no more reload-to-reload shuffling. Status no longer
 * affects order (it's display-only now).
 *
 * Pure: returns a new array; does not mutate the input.
 */
export function sortWorkstreams(list: Workstream[]): Workstream[] {
  return [...list].sort((a, b) => {
    if (a.order !== b.order) {
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      return a.order - b.order;
    }
    return a.title.localeCompare(b.title);
  });
}

/**
 * Compute an order value that places an item between `prev` and `next`
 * (the order values of its new neighbors in the sorted list; null = no
 * neighbor on that side). Midpoint for an interior drop; ±ORDER_GAP at the
 * ends; ORDER_GAP for an empty list.
 */
export function orderBetween(prev: number | null, next: number | null): number {
  if (prev !== null && next !== null) return (prev + next) / 2;
  if (prev !== null) return prev + ORDER_GAP;
  if (next !== null) return next - ORDER_GAP;
  return ORDER_GAP;
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
