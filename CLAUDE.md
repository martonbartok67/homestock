<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# CLAUDE.md — HomeStock AI Context

## Project Overview
HomeStock is a household inventory, expiry tracking, shopping list, and recipe planning app built with Next.js 16 App Router. It is a private multi-household SaaS where each household's data is fully isolated by a Turso-backed household ID derived from Clerk authentication.

## Tech Stack
- **Runtime:** Node.js ≥22.13, ESM (`"type": "module"`)
- **Framework:** Next.js 16.3.1 (App Router, Turbopack in dev)
- **UI:** React 19 — single large client component (`app/home-stock-app.tsx`), no component library
- **Styling:** Tailwind CSS 4 + hand-written CSS (`app/globals.css`) — Tailwind used minimally; most styles are custom CSS classes
- **Database:** Turso (libSQL) via `@libsql/client` 0.17.4 + Drizzle ORM 0.45.2
- **Auth:** Clerk (`@clerk/nextjs` 7.7.6) — email sign-in only, no organizations
- **AI:** Google Gemini Flash Lite (via REST, no SDK) — used for recipe suggestion and grounding
- **Language:** TypeScript 5.9 strict mode throughout
- **Testing:** Node.js built-in `node:test` + `node:assert/strict` — no Jest, no Vitest

## Project Structure
```
app/
  home-stock-app.tsx     # Entire client UI — one large "use client" component
  globals.css            # All custom styles; Tailwind used sparingly
  layout.tsx             # Root layout with Clerk provider
  page.tsx               # Server component — guards auth, renders home-stock-app
  api/
    home-stock/route.ts  # Main GET/POST API — all inventory/shopping/recipe actions
    recipes/
      import/route.ts    # POST — scrape recipe from URL
      suggest/route.ts   # POST — AI/web recipe suggestion (mode, typeFilter, excludeIds, excludeNames, excludeUrls, excludeFamilies)

db/
  schema.ts              # Drizzle schema definitions — single source of truth for table shape

lib/
  homestock.ts           # Shared types (Recipe, InventoryItem, etc.), pure utility functions, STAPLES
  recipe-catalog.ts      # Static seed catalog — 14 hand-written recipes as typed TS
  welcome.ts             # Personalised greeting logic
  server/
    home-stock-repository.ts    # All DB reads/writes; runs schema migrations on first call
    home-stock-input.ts         # Input validation + action type union for the main API
    household-auth.ts           # requireHousehold() — maps Clerk session → householdId
    online-recipe-suggestion.ts # 4-tier engine (web search → Gemini grounding → Gemini AI → MealDB)
    recipe-importer.ts          # URL scraper → structured Recipe
    web-search.ts               # Multi-provider search (Brave, Tavily, SerpAPI, DuckDuckGo)
    mealdb.ts                   # TheMealDB free API integration

tests/
  home-stock.test.mjs    # Unit tests for pure functions (expiry, matching, input validation)
  rendered-html.test.mjs # Structural integrity tests — assert key strings exist in source files
```

## Coding Standards

1. **Strict TypeScript everywhere.** `strict: true` is set. No `any`, no type assertions without a comment justifying them. Every function parameter and return type must be inferable or explicitly typed. Server functions must type their return values.

2. **Server/client boundary is hard.** Files under `lib/server/` are server-only — never import them from `app/home-stock-app.tsx` or any `"use client"` file. Shared types live in `lib/homestock.ts`. The client calls API routes via `householdFetch`; it never touches the DB or Clerk server SDK directly.

3. **All DB access goes through the repository.** Never call `getDb()` or `client` from a route handler directly — always go via `lib/server/home-stock-repository.ts`. Every exported repository function must call `ensureDatabase()` at the top and scope every query to `householdId`.

4. **Input validation is the route's responsibility.** Every POST body must pass through `parseHomeStockAction` (or an equivalent typed parser) before reaching the repository. Never trust `body.anything` directly in a route handler.

5. **Schema changes require a migration guard.** When adding a column to `db/schema.ts`, also add an `ALTER TABLE … ADD COLUMN` check in the `ensureDatabase()` block in `home-stock-repository.ts`. The app does not use Drizzle migrations — it self-migrates at runtime.

6. **No `<form>` elements.** All interactions use `onClick`/`onChange` handlers. Forms cause unwanted browser navigation inside the SPA-style client component.

7. **Early returns over nesting.** API routes and repository functions use guard clauses (`if (!x) return null`) rather than deeply nested `if/else`. Async errors propagate as thrown `Error` instances with user-readable messages — callers render `error.message` directly.

## Testing Guidelines

- **Runner:** `node --test` (built-in, Node ≥22). No test framework to install.
- **Location:** `tests/*.test.mjs` — ESM `.mjs` files only.
- **Unit tests** (`home-stock.test.mjs`): test pure functions exported from `lib/homestock.ts` and `lib/server/home-stock-input.ts`. Import `.ts` files directly — Node resolves them via the build.
- **Structural tests** (`rendered-html.test.mjs`): read source files as strings and `assert.match` for key patterns. Use this to guard against regressions where a critical wire-up gets accidentally removed.
- **Run:** `npm test` (runs build first, then both test files). Always run before pushing schema or API changes.
- **Do not** write tests that hit the network, the database, or Clerk — all external dependencies must be avoided in tests.

## Anti-Patterns

1. **Never add a new DB column without a migration guard.** Adding to `schema.ts` alone silently breaks existing deployments. Every column addition needs the corresponding `ALTER TABLE` check in `ensureDatabase()`.

2. **Never import from `lib/server/` in client code.** This will either cause a build error or leak secrets. If a type is needed on both sides, extract it to `lib/homestock.ts`.

3. **Never use `JSON.stringify` on values that might contain DOM nodes or React fibers.** When passing data from event handlers to API calls, always extract the primitive value explicitly (e.g. `id: item.id`, not `item` itself) before serialising.

4. **Never add a third-party UI component library.** The UI is intentionally hand-built with custom CSS classes. Do not introduce shadcn, Radix, MUI, or similar — add a CSS class to `globals.css` and a plain HTML element instead.
