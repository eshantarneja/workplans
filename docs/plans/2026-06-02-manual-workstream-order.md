# Manual Workstream Ordering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the user drag workstream cards into any order they want, persisted to a new Notion `Order` number property, replacing the current status-based sort that shuffles on every reload.

**Architecture:** Each workstream gets a numeric `Order` (spaced `1000, 2000, 3000…`). `sortWorkstreams` sorts purely by `Order` ascending (nulls last, title as deterministic tiebreaker). Dragging a card sets its `Order` to the midpoint of its new neighbors → one drag = one Notion `PATCH`. UI reuses the existing native HTML5 DnD + react-query optimistic-update patterns already used for moving tasks between cards.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, @notionhq/client (data-source API), @tanstack/react-query, Vitest. Native HTML5 drag-and-drop (no DnD library).

**Design doc:** `docs/plans/2026-06-02-manual-workstream-order-design.md`

**Reference patterns to copy:**
- Task-move optimistic mutation: `components/WorkstreamCard.tsx:27-58`
- Native DnD MIME pattern: `components/WorkstreamCard.tsx:19,80-102,261-265`
- PATCH route shape: `app/api/workstreams/[id]/route.ts`
- Sort tests style: `lib/sort.test.ts`

---

### Task 1: Add `order` to the type model

**Files:**
- Modify: `lib/types.ts` (Workstream interface ~line 9-23; UpdateWorkstreamBody ~line 60-77)
- Modify: `lib/sort.test.ts` (ws() helper defaults, ~line 5-17)

**Step 1: Add the field to `Workstream`**

In `lib/types.ts`, inside `interface Workstream`, after `url`:

```ts
  /** Direct Notion URL (https://www.notion.so/<id>). */
  url: string;
  /**
   * Manual sort key (Notion "Order" number property). Lower = earlier.
   * null when not yet set (sorts last, by title). Values are spaced ~1000
   * apart so a reorder only rewrites the moved row (see lib/sort orderBetween).
   */
  order: number | null;
```

**Step 2: Add `order` to `UpdateWorkstreamBody`**

In the `UpdateWorkstreamBody` interface, add:

```ts
  goal?: string;
  /** New manual sort key. */
  order?: number;
```

**Step 3: Keep the sort-test helper compiling**

In `lib/sort.test.ts`, add `order: null` to the `ws()` defaults block (alongside `url: ''`). (Task 3 rewrites the assertions; this just keeps the type valid.)

**Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the field is required on `Workstream`; `workstreamFromPage` is fixed next task — if tsc flags it there, that's expected and Task 2 resolves it).

**Step 5: Commit**

```bash
git add lib/types.ts lib/sort.test.ts
git commit -m "feat: add order field to workstream types"
```

---

### Task 2: Read `Order` from Notion pages

**Files:**
- Modify: `lib/notion.ts` (AnyProperty type ~line 53-62; workstreamFromPage ~line 72-87)
- Test: `lib/notion.test.ts`

**Step 1: Write the failing test**

In `lib/notion.test.ts`, find the existing `workstreamFromPage` test block and add:

```ts
  it('reads the Order number property', () => {
    const page = makeWorkstreamPage({ Order: { type: 'number', number: 2000 } });
    expect(workstreamFromPage(page).order).toBe(2000);
  });

  it('defaults order to null when Order is absent', () => {
    const page = makeWorkstreamPage({});
    expect(workstreamFromPage(page).order).toBeNull();
  });
```

> NOTE: match the existing test's page-builder helper name/shape in `lib/notion.test.ts`. If there is no builder, construct the page object inline like the other tests in that file do.

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notion.test.ts -t "Order"`
Expected: FAIL — `order` is `undefined`, not `2000`/`null`.

**Step 3: Implement**

In `lib/notion.ts`, add `number` to the `AnyProperty` type:

```ts
  date?: { start: string | null; end?: string | null } | null;
  relation?: { id: string }[];
  number?: number | null;
```

In `workstreamFromPage`, add to the returned object (after `url: page.url,`):

```ts
    url: page.url,
    order: props.Order?.number ?? null,
```

**Step 4: Run tests**

Run: `npx vitest run lib/notion.test.ts`
Expected: PASS (all, including the two new).

**Step 5: Commit**

```bash
git add lib/notion.ts lib/notion.test.ts
git commit -m "feat: map Notion Order property to workstream.order"
```

---

### Task 3: Sort by order + `orderBetween` helper (TDD)

**Files:**
- Modify: `lib/sort.ts` (rewrite `sortWorkstreams` ~line 11-23; add `orderBetween`)
- Modify: `lib/sort.test.ts` (replace the `sortWorkstreams` describe block; add `orderBetween` block)

**Step 1: Replace the `sortWorkstreams` tests**

In `lib/sort.test.ts`, replace the entire `describe('sortWorkstreams', …)` block with:

```ts
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
});
```

Update the import line to: `import { orderBetween, sortTasksByDue, sortWorkstreams } from './sort';`

**Step 2: Run to verify it fails**

Run: `npx vitest run lib/sort.test.ts`
Expected: FAIL — `orderBetween` not exported; old `sortWorkstreams` gives wrong order.

**Step 3: Implement**

In `lib/sort.ts`, replace the `sortWorkstreams` function (and drop the now-unused `WORKSTREAM_STATUS_ORDER` import) with:

```ts
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
```

Remove `import { WORKSTREAM_STATUS_ORDER } from './constants';` (no longer used). Keep the `Task`/`Workstream` type import.

**Step 4: Run tests**

Run: `npx vitest run lib/sort.test.ts`
Expected: PASS (all blocks).

**Step 5: Commit**

```bash
git add lib/sort.ts lib/sort.test.ts
git commit -m "feat: sort workstreams by manual order; add orderBetween"
```

---

### Task 4: PATCH route writes `Order`

**Files:**
- Modify: `app/api/workstreams/[id]/route.ts` (destructure ~line 18; build properties ~line 36-57)

**Step 1: Accept `order` from the body**

Change the destructure line to include `order`:

```ts
  const { name, customer, status, startDate, targetDate, goal, order } = body;
```

**Step 2: Write it to Notion**

After the `Dates` block (around line 57), before the "Nothing to update" guard, add:

```ts
  if (order !== undefined) {
    properties.Order = { number: order };
  }
```

**Step 3: Verify it typechecks and the route still builds**

Run: `npx tsc --noEmit`
Expected: no errors (`order?: number` exists on `UpdateWorkstreamBody` from Task 1).

**Step 4: Commit**

```bash
git add app/api/workstreams/[id]/route.ts
git commit -m "feat: PATCH /api/workstreams/[id] writes Order"
```

---

### Task 5: Create the Notion property + backfill existing rows

> This task needs the dev server running and the Notion `Order` property to exist. It is a one-time data migration, not code.

**Step 1 (USER, manual): Add the property in Notion**

In the Workstreams database: **Add property → Number → name it exactly `Order`**. Confirm done before continuing. (Doing this in the API is avoided — schema writes are the fragile part of this SDK version.)

**Step 2: Start the dev server** (if not already up)

Run: `PORT=3001 npm run dev` (background). Confirm `Ready` in the log.

**Step 3: Backfill via the API (no new files)**

For each customer, fetch its workstreams (already returned in deterministic title order since all `order` are null) and stamp `1000, 2000, 3000…` in that order. Run this once:

```bash
BASE=http://localhost:3001
for c in PP1 Penta Siegel Whetstone; do
  ids=$(curl -s "$BASE/api/workstreams?customer=$c" | python3 -c 'import sys,json; print("\n".join(w["id"] for w in json.load(sys.stdin)))')
  i=0
  for id in $ids; do
    i=$((i+1)); ord=$((i*1000))
    curl -s -o /dev/null -w "$c $id -> $ord (%{http_code})\n" \
      -X PATCH "$BASE/api/workstreams/$id" \
      -H 'Content-Type: application/json' -d "{\"order\":$ord}"
  done
done
```

Expected: each line prints `200`. (Customers with no workstreams print nothing — fine.)

**Step 4: Verify**

Run: `curl -s "$BASE/api/workstreams?customer=PP1" | python3 -c 'import sys,json; [print(w["order"], w["title"]) for w in json.load(sys.stdin)]'`
Expected: orders `1000, 2000, 3000` with no nulls.

(No commit — data-only change in Notion.)

---

### Task 6: Drag-to-reorder UI

**Files:**
- Modify: `components/WorkstreamCard.tsx` (add drag handle + reorder drag source/target)
- Modify: `app/page.tsx` (reorder mutation with optimistic update; pass neighbors/handlers to cards)

**Approach:** lift the reorder mutation to `page.tsx` (it owns the sorted `workstreams` list and the `['workstreams', customer]` query). Each `WorkstreamCard` gets a grip handle that is the drag source, and the card acts as a drop target for the workstream MIME (separate from the existing task MIME so the two don't collide).

**Step 1: Add the reorder mutation + handler in `app/page.tsx`**

Near the other hooks in `Home`, add the MIME constant at module top:

```ts
const WS_DRAG_MIME = 'application/x-workplan-workstream-id';
```

Inside `Home`, after `const workstreams = sortWorkstreams(wsQuery.data ?? []);` add:

```ts
  const wsKey = ['workstreams', customer] as const;
  const reorderMutation = useMutation<
    Workstream,
    Error,
    { id: string; order: number },
    { prev: Workstream[] | undefined }
  >({
    mutationFn: async ({ id, order }) => {
      const res = await fetch(`/api/workstreams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Reorder failed: ${res.status}`);
      }
      return res.json();
    },
    onMutate: async ({ id, order }) => {
      await qc.cancelQueries({ queryKey: wsKey });
      const prev = qc.getQueryData<Workstream[]>(wsKey);
      qc.setQueryData<Workstream[]>(wsKey, (curr) =>
        (curr ?? []).map((w) => (w.id === id ? { ...w, order } : w)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(wsKey, ctx.prev);
    },
  });

  // Drop `draggedId` immediately before the card at `targetIndex` in the
  // currently sorted list. Order = midpoint of that slot's neighbors.
  const reorderTo = (draggedId: string, targetIndex: number) => {
    const list = workstreams.filter((w) => w.id !== draggedId);
    const prev = targetIndex > 0 ? list[targetIndex - 1]?.order ?? null : null;
    const next = list[targetIndex]?.order ?? null;
    reorderMutation.mutate({ draggedId, ...{ id: draggedId, order: orderBetween(prev, next) } });
  };
```

> Simplify the `reorderMutation.mutate` call to `reorderMutation.mutate({ id: draggedId, order: orderBetween(prev, next) })`.

Add imports: `import { sortWorkstreams, orderBetween } from '@/lib/sort';` and `import type { Customer, Workstream } from '@/lib/types';` and ensure `useMutation` is imported (it already is).

**Step 2: Pass index + handlers to each card**

In the `workstreams.map((w) => …)` JSX, change to:

```tsx
              workstreams.map((w, i) => (
                <WorkstreamCard
                  key={w.id}
                  workstream={w}
                  tasks={tasks}
                  customer={customer}
                  index={i}
                  onReorder={reorderTo}
                />
              ))
```

**Step 3: Add the drag handle + reorder drop target in `WorkstreamCard.tsx`**

Add to `Props`: `index: number;` and `onReorder: (draggedId: string, targetIndex: number) => void;`. Add the MIME constant at top:

```ts
const WS_DRAG_MIME = 'application/x-workplan-workstream-id';
```

On the root `<article>`, extend the existing `onDragOver`/`onDrop` to ALSO handle the workstream MIME (keep the task-move logic intact):

```tsx
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes(DRAG_MIME) ||
          e.dataTransfer.types.includes(WS_DRAG_MIME)
        ) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
```

In `onDrop`, before the existing task logic, add:

```tsx
        const wsId = e.dataTransfer.getData(WS_DRAG_MIME);
        if (wsId) {
          if (wsId !== workstream.id) onReorder(wsId, index);
          return;
        }
```

Add a grip handle in the header `<div className="flex items-center gap-1.5 shrink-0">` (before `<StatusPill>`), draggable:

```tsx
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(WS_DRAG_MIME, workstream.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                aria-label="Drag to reorder"
                title="Drag to reorder"
                className="cursor-grab active:cursor-grabbing text-[var(--text-subtle)] hover:text-[var(--text)] select-none px-0.5"
              >
                ⠿
              </span>
```

**Step 4: Verify it builds + typechecks**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

**Step 5: Manual drive (browser)**

With the dev server on :3001, load the page, drag a card's grip handle onto another card, confirm it snaps into the new position and stays after Reload. (Reorder persists to Notion `Order`.)

**Step 6: Commit**

```bash
git add components/WorkstreamCard.tsx app/page.tsx
git commit -m "feat: drag-to-reorder workstream cards"
```

---

### Task 7: New workstreams get an initial `Order`

**Files:**
- Modify: `app/api/workstreams/scaffold/route.ts` (set Order on create, ~line 28-34)

**Step 1: Stamp spaced orders on scaffolded rows**

In the `for` loop, give each starter a spaced order so they don't start null:

```ts
    let i = 0;
    for (const name of STARTER_NAMES) {
      i += 1;
      const page = await notion.pages.create({
        parent: { data_source_id: WORKSTREAMS_DATA_SOURCE_ID },
        properties: {
          Workstream: { title: [{ text: { content: `${customer} — ${name}` } }] },
          Customer: { select: { name: customer } },
          Status: { select: { name: 'Not Started' } },
          Order: { number: i * 1000 },
        },
      });
```

> NOTE: if a separate single-workstream create path is added later, default its order to `last + 1000`; out of scope here.

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add app/api/workstreams/scaffold/route.ts
git commit -m "feat: scaffold workstreams with spaced Order values"
```

---

### Task 8: Full verification

**Step 1: Tests + lint + build**

Run: `npm run test && npm run lint && npm run build`
Expected: all tests pass, lint clean, build succeeds (all routes compile).

**Step 2: Live drive**

With dev server on :3001: reorder cards by dragging the grip handle; reload the page (browser) and confirm order is preserved; switch customers and confirm each keeps its own independent order; confirm dragging a *task* between cards still works (no regression).

**Step 3: Push (deploy)**

Per the user's earlier request, this branch deploys from `main`:

```bash
git push origin main
```

> Reminder unrelated to this feature: production still needs `NOTION_TOKEN` set in Vercel env or it will show "API token is invalid" regardless of this change.

---

## YAGNI / out of scope
- Cross-company global ordering (each row has one Customer; never sorted together).
- DnD libraries — native HTML5 DnD already in use.
- Re-numbering the whole list on drop — midpoint spacing avoids it.
- Status in the sort — explicitly pure-manual now.
