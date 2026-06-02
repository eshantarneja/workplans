# Manual Workstream Ordering — Design

**Date:** 2026-06-02
**Status:** Validated, ready for implementation

## Problem

Workstream order on the page shuffles on every reload. `sortWorkstreams`
orders by status (Blocked → At Risk → On Track → Not Started → Done) then by
target date, but workstreams sharing a status with the same/no target date
tie. The `/api/workstreams` query sends Notion **no sort order**, so the
underlying result order is unspecified and varies between requests. JS sort is
stable, so tied rows just inherit that unstable input order → visible flicker.

The user wants to **control** the order manually, via drag-to-reorder, with the
choice persisted. Status should no longer affect ordering at all (status stays
on the card as display only).

## Data model

Each workstream row belongs to exactly one `Customer` (single-select,
`lib/notion.ts`), and the page always filters to one customer at a time
(`/api/workstreams?customer=X`). Two companies' workstreams are never shown or
sorted together, so a **single `Order` number per workstream** is sufficient —
no cross-company coordination. Reordering within one customer only rewrites
that customer's rows.

- New Notion **`Order`** number property on the Workstreams DB.
- Sort purely by `Order` ascending; nulls last; **title** as final
  deterministic tiebreaker.

### Spacing / midpoint scheme

Order values are spaced (`1000, 2000, 3000…`) rather than contiguous. Dropping
a card between two others sets its `Order` to the **midpoint** of its new
neighbors (drop between 2000 and 3000 → 2500). Dropping at the end uses
`lastOrder + 1000`. Result: **one drag = one Notion write**, no re-numbering of
the whole list.

**Known limitation:** repeatedly splitting the same gap yields ever-smaller
fractional values and, in pathological cases, could collapse a gap or produce
two equal order values. Equal orders are handled deterministically by the title
tiebreaker in `sortWorkstreams`. There is no re-normalization pass, which is
acceptable at the expected 3–8 cards/customer scale.

## Reorder UX & write path

> **Update (post-implementation):** drag-and-drop was replaced with **← / → move
> buttons** on each card. Dragging a 1-D order across a wrapping multi-column
> grid proved awkward — cards picked up fine but had no clear drop target and
> snapped back. Click-to-move is more reliable, discoverable, and accessible.
> Each card header has "move earlier"/"move later" arrows (disabled at the
> ends); a click sets the card's `Order` to the midpoint of the slot it moves
> into via `orderBetween`, reusing the same optimistic mutation. The original
> drag design is kept below for history.

### (Historical) Drag UX & write path

Reuse the existing native HTML5 DnD pattern (tasks already drag with MIME
`application/x-workplan-task-id`) and the react-query optimistic-update +
rollback pattern (see the task-move mutation in `WorkstreamCard.tsx`).

- New MIME type `application/x-workplan-workstream-id`. Each drop handler checks
  for its own type, so dragging a *task* onto a card still moves the task and
  dragging a *card* reorders — no collision.
- **Dedicated drag handle** (grip icon ⠿) in the card header is the only
  draggable part of the card. Avoids fighting the clickable title (opens
  Notion), the edit button, and the draggable task rows inside the card.
- **Drop = direction-aware insert.** Dragging a card DOWN the list inserts it
  after the target card; dragging UP inserts it before — so any position,
  including the very last slot, is reachable. New `Order` = midpoint of the
  resulting neighbors.
- **Optimistic update:** on drop, reorder the cached `['workstreams', customer]`
  list immediately, fire the PATCH, roll back on failure.

**Caveat:** cards render in a responsive grid (1/2/3 columns). Reordering a
linear sequence by dragging across a wrapping grid is workable for a handful of
cards (~3–8 per customer) but slightly awkward visually. Accepted for now.

## Backfill & setup

1. **Create the property** in Notion manually (Add property → Number → "Order").
   ~10s, zero risk. Avoids gambling on schema-writes through this SDK version.
   Exact property name confirmed before wiring code.
2. **One-time backfill script** (uses local token): per customer, walk
   workstreams in current on-screen order and stamp `1000, 2000, 3000…`. Run
   once locally. Needed because the midpoint math requires real numbers on
   neighbors.
3. New/scaffolded workstreams default `Order` to `last + 1000`.

## Code touch-points

- `lib/types.ts`: `order: number | null` on `Workstream`; `order?: number` on
  `UpdateWorkstreamBody`.
- `lib/notion.ts`: `workstreamFromPage` reads `props.Order?.number ?? null`.
- `lib/sort.ts`: `sortWorkstreams` → by `order` asc, nulls last, title
  tiebreaker. New pure helper `orderBetween(prev, next)` for midpoint math.
- `app/api/workstreams/[id]/route.ts`: write `properties.Order` when `order`
  provided.
- `components/WorkstreamCard.tsx` + `app/page.tsx`: drag handle, drop-to-reorder,
  optimistic cache update.

## Testing

- Unit tests (pure functions): new `sortWorkstreams` (order asc, nulls last,
  tie → title) and `orderBetween` (midpoint; end-of-list; adjacent values).
- DnD wiring verified by running the app locally and dragging cards.

## Out of scope (YAGNI)

- Cross-company / global ordering (data model makes it unnecessary).
- Reorder libraries (`@dnd-kit` etc.) — native DnD already in use, few items.
- Re-introducing status into the sort — explicitly pure-manual.
