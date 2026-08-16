import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HomeStock is wired to the Turso-backed API", async () => {
  const [page, route, schema, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/home-stock/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/home-stock"/);
  assert.match(page, /Emma &amp; Marci&apos;s household/);
  assert.match(page, /Good afternoon|Good evening|Good morning|Good night/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(schema, /inventory_items/);
  assert.match(schema, /shopping_list_items/);
  assert.match(schema, /recipe_ingredients/);
  assert.match(packageJson, /"@libsql\/client": "0\.17\.4"/);
  assert.match(packageJson, /"next": "16\.3\.1"/);
});
