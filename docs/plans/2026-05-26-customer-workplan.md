# Customer Workplan Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js dashboard on Vercel that reads a selected customer's workstreams + tasks from Notion, renders them as cards + a Gantt timeline, and lets the user add tasks and drag tasks between workstreams — all writing back to Notion in real time.

**Architecture:** Next.js 14 App Router with TypeScript. All Notion access happens in server-side API routes via `@notionhq/client` — the token never reaches the browser. The client uses TanStack Query for fetching, caching, and optimistic mutations. Drag-and-drop is HTML5 native. Auth: none (per user). Auto-refetch: off; explicit Reload button only.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, `@notionhq/client`, `@tanstack/react-query`, Vercel.

**Decisions taken from clarifying questions:**
- No auth — public URL.
- HTML5 native draggable for DnD.
- Headline shown as subtitle on cards; Meeting Notes not rendered (view in Notion).
- No background polling; Reload button only.
- Match screenshot's "Customer Workplan Live" title; omit Edit / Version / ⋯ / ✕ controls (not in spec).

---

## Task Order (Read-Path First, Then Write-Path)

The spec is explicit: build MVP end-to-end before adding polish, in order **read → write → DnD**. The tasks below follow that. Roughly 25 commits. Two phases:

- **Phase A (read path):** Tasks 1–13. By the end, opening `?customer=PP1` shows real workstream cards, the timeline, blockers, and tasks pulled from Notion.
- **Phase B (write path + polish):** Tasks 14–25. Add-task, DnD, scaffold endpoint, reload UX, error states, README, deploy.

---

## Task 0: Prereqs (user action, runs in parallel with Task 1)

**You (the user) do this while I scaffold:**

1. Go to https://www.notion.so/profile/integrations → New internal integration → name "Customer Workplan" → copy the token (starts with `secret_` or `ntn_`).
2. Open each DB in your browser and add the integration via `⋯ → Connections`:
   - Workstreams: https://www.notion.so/b1359e4c7c1340bea9d9ec0a59998dfd
   - Tasks: https://www.notion.so/1d03a4d84b0481b694bcc7546dac3aed
3. Paste me the token (or put it in `.env.local` yourself once I scaffold).

If you've already done this, just confirm.

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.example`

**Step 1:** Run `npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"` (in `/Users/eshantarneja/Documents/Git/workplans`).

**Step 2:** Add deps: `npm i @notionhq/client @tanstack/react-query`.

**Step 3:** Add devdep for testing pure functions: `npm i -D vitest @vitest/ui`.

**Step 4:** Create `.env.example` with `NOTION_TOKEN=` line. Add `.env.local` to `.gitignore` (Next adds it by default).

**Step 5:** Commit.

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TS, Tailwind, TanStack Query"
```

---

## Task 2: Project structure + constants

**Files:**
- Create: `lib/constants.ts`, `lib/types.ts`

**`lib/constants.ts`:**

```ts
export const CUSTOMERS = ['PP1', 'Penta', 'Siegel', 'Whetstone'] as const;
export const OWNERS = ['Bill', 'Eshan', 'Ash', 'Pepe', 'bn'] as const;
export const WORKSTREAM_STATUSES = ['On Track', 'At Risk', 'Blocked', 'Done', 'Not Started'] as const;
export const WORKSTREAMS_DB_ID = 'b1359e4c7c1340bea9d9ec0a59998dfd';
export const TASKS_DB_ID = '1d03a4d84b0481b694bcc7546dac3aed';
export const PP1_PROJECT_ID = '3323a4d84b048075bb11fa5a4b4cd3f3';
```

**`lib/types.ts`:**

```ts
import { CUSTOMERS, OWNERS, WORKSTREAM_STATUSES } from './constants';
export type Customer = typeof CUSTOMERS[number];
export type Owner = typeof OWNERS[number];
export type WorkstreamStatus = typeof WORKSTREAM_STATUSES[number];
export type TaskStatus = 'Not Started' | 'In Progress' | 'Waiting' | 'Blocked' | 'Backlog' | 'Done' | 'Archived';
export type Priority = 'Low' | 'Medium' | 'High';

export interface Workstream {
  id: string;
  title: string;          // already stripped of "{Customer} — " prefix
  customer: Customer;
  status: WorkstreamStatus;
  startDate: string | null;
  targetDate: string | null;
  goal: string;
  headline: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  owners: Owner[];
  due: string | null;
  priority: Priority | null;
  notes: string;
  workstreamId: string | null;
  url: string;
}
```

Commit.

---

## Task 3: Notion client + mappers (with unit tests)

**Files:**
- Create: `lib/notion.ts`, `lib/notion.test.ts`

**`lib/notion.ts`:**
- Export a singleton `notion = new Client({ auth: process.env.NOTION_TOKEN })`.
- Export `workstreamFromPage(page)` and `taskFromPage(page)` pure functions that take a Notion API page object and return our `Workstream` / `Task` types.
- Export helpers `stripCustomerPrefix(title, customer)` and `notionUrl(id)`.

**Step 1: Write failing tests** for `stripCustomerPrefix`, `workstreamFromPage` (with a synthetic page object), and `taskFromPage`. Cover the gotchas: `Status` is type "status" not "select"; relation arrays; null dates; missing rich_text.

**Step 2:** Run `npx vitest run` — should fail (file not implemented).

**Step 3:** Implement mappers minimally. Re-run — should pass.

**Step 4:** Commit.

---

## Task 4: Workstream sort + date utilities (with tests)

**Files:**
- Create: `lib/sort.ts`, `lib/sort.test.ts`, `lib/dates.ts`, `lib/dates.test.ts`

**`lib/sort.ts`:** `sortWorkstreams(list)` — sort by status order (`Blocked`, `At Risk`, `On Track`, `Not Started`, `Done`) then by target date ascending.

**`lib/dates.ts`:**
- `formatMonthDay(iso)` → `"May 4"` (matches screenshot).
- `daysOver(targetDateIso, todayIso)` → integer days overdue, or null if not over.
- `weeklyTicks(startIso, endIso)` → array of ISO dates for the Gantt axis at weekly intervals.

TDD all three. Commit.

---

## Task 5: API route — `GET /api/workstreams`

**Files:**
- Create: `app/api/workstreams/route.ts`

**Behavior:** Read `customer` from query string. `notion.databases.query` against `WORKSTREAMS_DB_ID` with filter `{ property: 'Customer', select: { equals: customer } }`. Map pages via `workstreamFromPage`. Return JSON array.

**Step 1:** Implement.

**Step 2:** Manual integration test — `npm run dev`, then `curl 'http://localhost:3000/api/workstreams?customer=PP1' | jq '.[] | {title, status}'`. Confirm we get real data back.

**Step 3:** Add error handling: try/catch returning 500 with `{ error: message }`.

**Step 4:** Commit.

---

## Task 6: API route — `GET /api/tasks`

**Files:**
- Create: `app/api/tasks/route.ts`

**Behavior:**
1. Fetch this customer's workstream ids (reuse the query from Task 5).
2. Query tasks with `{ property: 'Workstream', relation: { contains: <id> } }` — but Notion's `contains` only takes one id, so we OR them: `{ or: [...] }`.
3. Exclude `Status = Archived` server-side.
4. Map via `taskFromPage`. Return JSON.

**Step 1:** Implement.

**Step 2:** Manual: `curl 'http://localhost:3000/api/tasks?customer=PP1' | jq 'length, .[0]'`.

**Step 3:** Commit.

---

## Task 7: Root layout + TanStack Query provider + global styles

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `components/Providers.tsx`

**`app/globals.css`:** Tailwind directives + CSS vars from the spec palette.

```css
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --surface-2: #f5f5f4;
  --border: #e7e5e4;
  --text: #1c1917;
  --text-muted: #78716c;
  --text-subtle: #a8a29e;
  --accent: #4338ca;
}
body { background: var(--bg); color: var(--text); font-size: 14px; }
```

Font stack: Inter via `next/font/google` with system fallback.

**`components/Providers.tsx`:** Client component wrapping children in `QueryClientProvider` with `staleTime: Infinity` (no auto-refetch) and `refetchOnWindowFocus: false`.

Wire it into `app/layout.tsx`. Commit.

---

## Task 8: Page shell — Header + Customer picker + Agenda textarea

**Files:**
- Modify: `app/page.tsx`
- Create: `components/Header.tsx`, `components/CustomerPicker.tsx`, `components/AgendaTextarea.tsx`

**`Header.tsx`:** Title "Customer Workplan Live" left, "Data updated …" + Reload button right. Last-updated indicator ticks each second from `dataUpdatedAt`.

**`CustomerPicker.tsx`:** `<select>` populated from `CUSTOMERS`. Reads `?customer=` query param, falls back to localStorage `customer`, default `PP1`. On change: update URL via `useRouter().replace()` *and* localStorage. Shows immediately on page load — does NOT wait for Notion options fetch (per pitfall #7).

**`AgendaTextarea.tsx`:** Auto-resizing textarea. Key: `agenda-{customer}`. Reads/writes localStorage. Placeholder matches screenshot.

**`app/page.tsx`:** Stitch them together — `<Header />`, then `Weekly workplan: <CustomerPicker />` row, then `<AgendaTextarea customer={customer} />`. Pure layout for now, no data yet.

Run dev server, eyeball against screenshot's top section. Commit.

---

## Task 9: StatusPill component

**Files:**
- Create: `components/StatusPill.tsx`

Small component: `{status: WorkstreamStatus}` → rounded-full pill with the spec's soft bg / fg colors. Uppercase text (BLOCKED, AT RISK, etc — matches screenshot). Used in cards and (for the colored bar fill) the Gantt.

Commit.

---

## Task 10: Workstream cards (read-only) + TaskRow + Blocker callout

**Files:**
- Create: `components/WorkstreamCard.tsx`, `components/BlockerCallout.tsx`
- Modify: `app/page.tsx`

**`app/page.tsx`** adds:
```ts
const { data: workstreams = [], dataUpdatedAt: wsUpdatedAt } = useQuery({
  queryKey: ['workstreams', customer],
  queryFn: () => fetch(`/api/workstreams?customer=${customer}`).then(r => r.json()),
});
const { data: tasks = [] } = useQuery({
  queryKey: ['tasks', customer],
  queryFn: () => fetch(`/api/tasks?customer=${customer}`).then(r => r.json()),
});
```

Pass `sortWorkstreams(workstreams)` to a grid of `<WorkstreamCard>`s.

**`WorkstreamCard`** renders, in order:
1. 4px colored top border (status color).
2. Title (link to Notion URL) + StatusPill.
3. "Start {Apr 27}   Target {Jun 30}" subtitle. If overdue + not Done, append "(Xd over)" in red.
4. Headline as a one-liner under the subtitle if non-empty.
5. **GOAL** box — `surface-2` bg, 3px left indigo border, "GOAL" label.
6. **BLOCKERS** section (only if any) — `tasks.filter(t => t.workstreamId === id && t.status === 'Blocked')`. Header "BLOCKERS" + count badge. Each as a `BlockerCallout` (red bg, "!" icon, title, "Owner: X · Date: Y").
7. **TASKS** section — non-Archived, non-Blocked tasks belonging to this workstream. Open first (sorted by due asc), Done last with strikethrough. Header "TASKS" + count badge like `3` or `3 · 2 done`. Each task row: gray empty circle, title (link), owner chip, due date (red if past, gray-strike if Done).
8. Empty: "No tasks yet — add one below or drag from another workstream." in muted italic.
9. `+ Add task` button (no behavior yet — wired in Task 16).

Eyeball against screenshot. Commit.

---

## Task 11: Gantt timeline

**Files:**
- Create: `components/Timeline.tsx`
- Modify: `app/page.tsx`

**`Timeline.tsx`:** Receives sorted workstreams. Computes min start / max target across them. Generates weekly tick array. Renders:
- Left column: workstream names (width ~ 180px).
- Right area: header row with weekly tick labels.
- One bar per workstream — absolutely positioned at `(start, end)` within the date range, colored by status (using the same palette as StatusPill bg). Bar shows `"{startMonthDay} → {endMonthDay}"` text.
- Vertical "today" line if today is in range, with "today" label below.

Use percentage math: `left = (start - rangeStart) / rangeWidth * 100%`, same for width. The container is `overflow-x-auto` with a min-width on mobile.

Visual check vs screenshot. Commit.

---

## Task 12: Empty state + workstream count summary

**Files:**
- Create: `app/api/workstreams/scaffold/route.ts`, `components/EmptyState.tsx`
- Modify: `app/page.tsx`

**Scaffold endpoint:** POST `/api/workstreams/scaffold` with body `{ customer }`. Creates 3 pages in the Workstreams DB:
- `"{customer} — ERP Integration"` / `"{customer} — Data Integration"` / `"{customer} — Pricing"`
- All with `Status = Not Started`, `Customer = customer`.

**`EmptyState.tsx`:** When `workstreams.length === 0` for a customer, render "No workstreams for {customer} yet." + a button that POSTs to the scaffold endpoint, then invalidates the query.

**Summary count:** On the picker row, add `● 3 workstreams · 4 tasks` (green dot when ≥1 workstream loaded, gray otherwise).

Commit.

---

## Task 13: Error + loading states for read path

**Files:**
- Modify: `app/page.tsx`, `components/Header.tsx`

- Loading skeleton: light gray placeholder cards (3 of them) while initial fetch is in flight.
- Error: inline banner above the cards "Couldn't load workstreams — [Retry]". Same for tasks.
- Reload button: calls `queryClient.invalidateQueries({ queryKey: ['workstreams', customer] })` and the same for `['tasks', customer]`.

Commit. **End of Phase A — read path is fully working.**

Manual smoke test: open `http://localhost:3000?customer=PP1`, eyeball against the screenshot, verify the workstreams + tasks match what's in Notion right now.

---

## Task 14: API route — `POST /api/tasks`

**Files:**
- Modify: `app/api/tasks/route.ts`

**Body:** `{ name, workstreamId, customer, owner?, due? }`.

**Behavior:**
- Build properties: `Task name` (title), `Status` (`{status: {name: 'Not Started'}}`), `Workstream` relation `[{id: workstreamId}]`, `Owner` multi-select if provided, `Due` date if provided.
- If `customer === 'PP1'`, also set `Project` relation `[{id: PP1_PROJECT_ID}]`.
- `notion.pages.create({ parent: { database_id: TASKS_DB_ID }, properties })`.
- Map response via `taskFromPage`, return it.

Manual test with curl:
```bash
curl -X POST http://localhost:3000/api/tasks -H 'Content-Type: application/json' \
  -d '{"name":"test task","workstreamId":"<a real ws id>","customer":"PP1","owner":"Eshan"}'
```
Verify the row appears in Notion. Delete it. Commit.

---

## Task 15: API route — `PATCH /api/tasks/[id]`

**Files:**
- Create: `app/api/tasks/[id]/route.ts`

**Body:** `{ workstreamId? | status? | name? }`. Only update fields present.
- `workstreamId` → set `Workstream` relation to `[{ id: workstreamId }]`.
- `status` → `{ status: { name: status } }`.
- `name` → `{ title: [{ text: { content: name } }] }`.

`notion.pages.update`. Return mapped task. Test by curl-moving a task between workstreams in Notion. Commit.

---

## Task 16: AddTaskForm component (inline) + optimistic create

**Files:**
- Create: `components/AddTaskForm.tsx`
- Modify: `components/WorkstreamCard.tsx`

**`AddTaskForm.tsx`:**
- Collapsed: `+ Add task` button.
- Expanded: name input (autofocus), Owner dropdown (5 owners + "—"), Due date input, [Add] / [Cancel].
- Enter submits; Esc cancels.

**Mutation:**
```ts
const mutation = useMutation({
  mutationFn: (body) => fetch('/api/tasks', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json()),
  onMutate: async (body) => {
    await qc.cancelQueries({ queryKey: ['tasks', customer] });
    const prev = qc.getQueryData<Task[]>(['tasks', customer]);
    const optimistic = { id: `temp-${Date.now()}`, title: body.name, status: 'Not Started', owners: body.owner ? [body.owner] : [], due: body.due, ... };
    qc.setQueryData(['tasks', customer], [...(prev || []), optimistic]);
    return { prev };
  },
  onError: (_e, _b, ctx) => qc.setQueryData(['tasks', customer], ctx?.prev),
  onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', customer] }),
});
```

Manual test: add a task to a workstream, watch it appear immediately, verify it shows in Notion. Commit.

---

## Task 17: Drag-and-drop tasks between workstreams

**Files:**
- Modify: `components/WorkstreamCard.tsx`, `app/page.tsx`

**TaskRow:** `draggable`, `onDragStart={e => e.dataTransfer.setData('task-id', task.id)}`.

**WorkstreamCard:** `onDragOver={e => e.preventDefault()}` + visual highlight when dragging over. `onDrop`: read task id, if `task.workstreamId !== this.id`, fire move mutation.

**Move mutation:** PATCH `/api/tasks/:id` with `{ workstreamId: destId }`. Optimistic local update of the task's `workstreamId`. Rollback on error.

Manual test: drag a task from ERP Integration to Pricing in PP1, confirm it lands in Notion. Commit.

---

## Task 18: Task title links + workstream title links to Notion

**Files:** already wired in Task 10, just verify URLs are correct (`https://www.notion.so/{id_no_dashes}` from page's actual `url` field). Commit any cleanup.

---

## Task 19: "Days overdue" + Done strikethrough polish pass

**Files:** `components/WorkstreamCard.tsx`, `lib/dates.ts`

- Workstream "X days over" red text next to "Target Jun 30" when overdue and not Done.
- Task due dates: red if past + not Done.
- Done tasks: strikethrough title, gray dot replaced by filled checkmark dot, sorted last.

Visual verification. Commit.

---

## Task 20: Footer + final visual pass against screenshot

**Files:** `app/page.tsx`

Add footer line: "Data pulled live from your Notion Workstreams DB · Edit anything in Notion and hit Reload above" — muted text, centered, separator border above.

Eyeball whole page vs the screenshot. Tweak spacings until it matches. Commit.

---

## Task 21: Error states (full coverage of pitfall #9)

**Files:** `app/page.tsx`, components that mutate

- Mutation errors: red toast/banner with the message + Retry. Don't silent-fail.
- API routes log errors server-side with the offending payload.
- 429 (Notion rate limit) → "Notion is rate-limiting us, try again in a moment".

Commit.

---

## Task 22: README

**Files:** Create `README.md`

Contents:
- What this is, one screenshot link or description.
- Setup steps (1, 2, 3 from spec — integration token, share to both DBs, set env var).
- Local dev: `npm i`, `cp .env.example .env.local`, `npm run dev`.
- Vercel deploy: link GitHub repo → Import in Vercel → set `NOTION_TOKEN` in env vars → deploy.
- How to re-deploy after rotating the token.

Commit.

---

## Task 23: Final dev test against real Notion

**No new files.** Walk through the success criteria:
- Open `http://localhost:3000?customer=PP1` — see workstreams + timeline + tasks.
- Add 2 tasks; one to ERP, one to Pricing.
- Drag the ERP task to Pricing.
- Hit Reload — state matches Notion.
- Refresh the page — agenda textarea persists per customer.
- Switch to `Penta` — empty state with "Create starter workstreams" button works.
- Verify the PP1 new tasks have the Project relation set; non-PP1 don't.

If anything's broken, fix and re-commit before continuing.

---

## Task 24: Push branch, open PR

**Files:** none.

```bash
git checkout -b feat/customer-workplan-dashboard   # if not already on a branch
git push -u origin feat/customer-workplan-dashboard
gh pr create --fill
```

(If you'd rather I push straight to `main` since you're the only user, tell me at this step.)

---

## Task 25: Vercel deploy walkthrough

**No new files.** I'll guide you through:
1. `vercel login` (or use the dashboard).
2. From the dashboard: New Project → Import Git Repository → pick this repo.
3. Framework auto-detected as Next.js. Build command default.
4. Add env var: `NOTION_TOKEN=...`.
5. Deploy. Open the URL. Sanity check with `?customer=PP1`.

Note: since there's no auth, treat the URL as a secret. Don't share publicly. If you ever want to lock it down later, the simplest add is a 5-line `middleware.ts` checking a cookie set by a one-time password prompt — can do it post-MVP.

---

## Out of scope (nice-to-haves, defer)

- Inline edit of workstream goal/status/dates.
- Click task status to cycle Open → Done.
- Keyboard shortcut `n`.
- Mobile DnD (HTML5 native doesn't work well on touch; add `@dnd-kit` later if needed).

## Notes on pitfalls (reference during build)

- `Status` is type "status" not "select" — both filter and update use `{ status: { name: '...' } }`.
- Relations: always `{ relation: [{ id: 'id-no-dashes' }] }`.
- Set `Tasks.Workstream` only — Notion auto-updates the workstream's side.
- Customer name prefix on titles — strip in UI, write it in `scaffold` route.
- Use `Owner` (multi-select), NOT `Assignee` (person).
- Don't make the customer dropdown depend on a Notion fetch — hardcoded constant.
- Query Tasks DB by Workstream relation contains — don't trust the workstream's relation list.
