# HomeStock

HomeStock is a calm home inventory, expiry tracking, shopping list, and recipe planning app.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `TURSO_AUTH_TOKEN` in `.env.local` before using durable data. The first database request creates the tables and seeds the sample inventory, shopping list, recipes, and preferences.

## Database

The app uses Turso/libSQL through Drizzle. The schema lives in `db/schema.ts`, the generated migration is in `drizzle/0000_home_stock.sql`, and the server-side repository is `lib/server/home-stock-repository.ts`.

The core API is `GET/POST /api/home-stock`. The single-user MVP keeps the data model ready for authentication and household ownership later without adding that complexity now.

## Verification

```bash
npm run build
npm run lint
npx tsc --noEmit
```

Vercel uses the `vercel-build` script and reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from project environment variables.
