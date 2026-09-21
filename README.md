# Signal System · Signal Society

> **Signal System turns scattered business activity into one clear operational signal.**

Internal business operating system — marketing, projects, clients, pipeline, finances, tasks, content, operations and intelligence in one calm, premium workspace.

## Run

No build step. Open `index.html` directly, or serve statically:

```bash
npx serve .
# or
python -m http.server 8080
```

Deploy to Vercel as-is (see `vercel.json`) — pure static, `index.html` is the entry.

## Stack

- Semantic HTML + Tailwind CSS (v4 browser) + vanilla JS
- **Supabase-ready, not Supabase-coupled.** All data flows through:
  - `assets/js/config.js` — brand, constants, Supabase keys
  - `assets/js/seed.js` — relational mock (mirrors the SQL schema)
  - `assets/js/store.js` — state + CRUD + derived logic (health, progress, expected revenue)
  - `assets/js/db.js` — `DB.from(table).select/insert/update/remove`, plus `Auth`, `Realtime`, `Storage` stubs
- Connect Supabase later in **Settings → Supabase connection** (or `localStorage: signal_supabase_url / signal_supabase_key`) — UI code doesn't change, only the adapter swaps from local to remote.
- Full schema in `supabase/schema.sql` (UUIDs, timestamps, soft-delete, RLS, realtime tables).

## Structure

```
index.html                  app shell (sidebar / topbar / view / bottom nav)
assets/css/styles.css       brand system + motion + kanban/calendar/table
assets/js/config.js         brand + pipeline/task/finance constants
assets/js/seed.js           relational seed (clients→projects→tasks…)
assets/js/store.js          CRUD + activity log + notifications + derived
assets/js/db.js             Supabase abstraction (local adapter today)
assets/js/ui.js             toast/modal/drawer/charts/tables/states
assets/js/views.js          all 22 modules, rendered from Store
assets/js/app.js            router, ⌘K search, quick-create, drag&drop
supabase/schema.sql         Postgres schema + RLS + realtime notes
```

## Brand

Derived from `logosignalsociety/` — vivid signal orange `#FF6600` used sparingly (accents, active states, highlights) over a monochrome base of white / off-white `#FAFAF9` / graphite `#1C1C1F` / near-black `#111113`.

## Shortcuts

- `⌘K / Ctrl K` — global search + command menu
- `C` — quick create
- `Esc` — close modal / drawer
