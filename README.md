# HomeStock

HomeStock is a calm home inventory, expiry tracking, shopping list, and recipe planning app.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set the Turso, Gemini, and Clerk values from `.env.example` in `.env.local`. The first authenticated database request creates or upgrades the tables; each household starts empty until its members add their own inventory, shopping data, and recipes.

## Database

The app uses Turso/libSQL through Drizzle. The schema lives in `db/schema.ts`, the generated migration is in `drizzle/0000_home_stock.sql`, and the server-side repository is `lib/server/home-stock-repository.ts`.

The core API is `GET/POST /api/home-stock`. Clerk verifies each individual email login. Turso remains the only app database: it maps approved emails to households, and every stored row carries that Turso household ID. API routes look up the household from the verified email on the server rather than trusting an ID sent by the browser.

## Household login

1. Create or claim the Clerk application with email sign-in enabled. Clerk Organizations are not needed.
2. Create each household and its approved email memberships in the Turso `households` and `household_members` tables.
3. Add the Clerk publishable and secret keys to `.env.local` and to Vercel.

Never put a Clerk secret key in browser code or commit `.env.local`.

## Verification

```bash
npm run build
npm run lint
npx tsc --noEmit
npm test
```

Vercel uses the `vercel-build` script and reads `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GEMINI_API_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` from project environment variables.
