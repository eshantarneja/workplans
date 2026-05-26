# Customer Workplan Live

A live dashboard for weekly customer syncs, backed by Notion. Pick a customer
at the top, see their workstreams, tasks, blockers, and a Gantt-style timeline.
Add tasks and drag them between workstreams — every change syncs back to
Notion immediately.

Built with Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 +
TanStack Query, on top of the official Notion SDK (`@notionhq/client`).

## Setup

You only need to do this once. It takes about two minutes.

### 1. Create a Notion integration

1. Go to https://www.notion.so/profile/integrations
2. Click **+ New integration**.
3. Name it (e.g. `Customer Workplan`), pick your workspace, leave it as
   **Internal**, click **Save**.
4. Copy the **Internal Integration Secret** — it starts with `ntn_` (newer)
   or `secret_` (older). This is your `NOTION_TOKEN`.

### 2. Share each database with the integration

For **each** of these pages, click `⋯` (top right of the page) →
**Connections** → search for your integration name → click it → confirm:

| Resource           | URL |
| ------------------ | --- |
| Workstreams DB     | https://www.notion.so/b1359e4c7c1340bea9d9ec0a59998dfd |
| Tasks DB           | https://www.notion.so/1d03a4d84b0481b694bcc7546dac3aed |
| Projects DB        | (whichever DB contains your PP1 Project page) |
| PP1 Project page   | https://www.notion.so/3323a4d84b048075bb11fa5a4b4cd3f3 |

If the dashboard later shows `object_not_found` for any of these, this
step is the cause.

### 3. Set the environment variable

For local dev:

```bash
cp .env.example .env.local
# then edit .env.local and paste your token after NOTION_TOKEN=
```

For Vercel, add `NOTION_TOKEN` under **Project settings → Environment
Variables** (set it for Production, Preview, and Development).

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Tests:

```bash
npm test          # one-shot
npm run test:watch
```

Lint + type check:

```bash
npm run lint
npx tsc --noEmit
```

## Deploy on Vercel

1. Push this repo to GitHub.
2. In the Vercel dashboard: **New Project** → **Import Git Repository** →
   pick this repo.
3. Vercel auto-detects Next.js. Leave the build command as-is.
4. In **Environment Variables**, add `NOTION_TOKEN` with your token.
5. Click **Deploy**.

Once it's deployed, the URL works exactly like the local dev server:
`<your-url>/?customer=PP1` (or `Penta`, `Siegel`, `Whetstone`).

### Rotating the token

If you ever need to rotate the token (e.g. it leaks into a screenshot or
chat log), regenerate it on the Notion integrations page, then:

1. Update it in Vercel → Project settings → Environment Variables.
2. Trigger a redeploy (Deployments tab → ⋯ → Redeploy).
3. For local dev, update `.env.local` and restart `npm run dev`.

## How it works

- **Read path** — API routes under `app/api/...` use the Notion SDK to
  query the Workstreams and Tasks data sources, filtered by customer.
  Notion SDK v5 uses `dataSources.query`, not `databases.query`.
- **Write path** — `POST /api/tasks` creates a task with the correct
  Workstream relation and (for PP1) the Project relation.
  `PATCH /api/tasks/[id]` moves a task to another workstream when you
  drag it, or updates status/name.
- **Client state** — TanStack Query caches per `(customer)` key with
  `staleTime: Infinity` and `refetchOnWindowFocus: false`. The Reload
  button invalidates the cache. Add and drag use optimistic updates.
- **Agenda** — the per-customer textarea at the top is local-only
  (localStorage key `agenda-<customer>`). Not synced to Notion.

## Project layout

```
app/
  layout.tsx                     React root, font, providers
  page.tsx                       Dashboard (client component)
  api/
    workstreams/route.ts         GET workstreams for a customer
    workstreams/scaffold/route.ts POST: create 3 starter workstreams
    tasks/route.ts               GET tasks; POST create
    tasks/[id]/route.ts          PATCH update
components/
  Header.tsx                     Title + Reload + last-updated
  CustomerPicker.tsx             Top-bar dropdown
  AgendaTextarea.tsx             Per-customer local-only textarea
  Timeline.tsx                   Gantt-style timeline
  WorkstreamCard.tsx             Card with goal, blockers, tasks, DnD
  AddTaskForm.tsx                Inline add-task form
  StatusPill.tsx                 Status chip
  Providers.tsx                  TanStack Query provider
lib/
  notion.ts                      SDK client + Notion-page -> domain mappers
  constants.ts                   DB/data source ids, customers, owners
  types.ts                       Workstream, Task, etc.
  sort.ts                        sortWorkstreams
  dates.ts                       formatMonthDay, daysOver, weeklyTicks
  api.ts                         client-side fetchers
```

## Schema dependencies (Notion-side)

If you re-key the DBs in Notion or rename properties, update
`lib/constants.ts` and the property names in `lib/notion.ts` /
`app/api/...`. Property names this app reads/writes:

- **Workstreams DB:** `Workstream` (title), `Customer` (select),
  `Status` (select), `Dates` (date), `Goal` (rich_text),
  `Headline` (rich_text).
- **Tasks DB:** `Task name` (title), `Status` (**status** type — not
  select), `Owner` (multi_select), `Due` (date), `Priority` (select),
  `Notes` (rich_text), `Workstream` (relation), `Project` (relation).

## Limitations / not implemented

- **No auth.** Anyone with the URL can read/write your Notion data.
  Treat the URL as a secret.
- HTML5 native drag-and-drop only — works on desktop trackpad/mouse;
  mobile touch DnD would need `@dnd-kit/core`.
- Inline edit of workstream goal / status / dates — view-only here;
  edit them in Notion and hit Reload.
- Status toggling (Open ↔ Done) — same; do it in Notion.
