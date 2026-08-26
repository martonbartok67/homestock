import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HomeStock is wired to the Turso-backed API", async () => {
  const [page, pageGuard, route, inputValidation, repository, householdAuth, importRoute, importer, suggestRoute, suggestionHelper, welcomeHelper, schema, packageJson, nextConfig, proxy, layout] = await Promise.all([
    readFile(new URL("../app/home-stock-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/home-stock/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/home-stock-input.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/home-stock-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/household-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/recipes/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/recipe-importer.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/recipes/suggest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/online-recipe-suggestion.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/welcome.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /householdFetch\("\/api\/home-stock"/);
  assert.match(page, /householdFetch\("\/api\/recipes\/import"/);
  assert.match(page, /householdFetch\("\/api\/recipes\/suggest"/);
  assert.match(page, /Find real recipe online/);
  assert.match(page, /AI idea fallback/);
  assert.match(page, /not a recipe copied from a website/);
  assert.match(page, /recipe-control-label/);
  assert.match(page, /Recipe mood/);
  assert.match(page, /Edit recipe/);
  assert.match(page, /Delete \$\{recipe\.name\}/);
  assert.match(page, /household\.name/);
  assert.doesNotMatch(page, /OrganizationSwitcher/);
  assert.doesNotMatch(page, /OrganizationList/);
  assert.match(welcomeHelper, /Good afternoon|Good evening|Good morning|Good night/);
  assert.match(welcomeHelper, /Hey, \$\{timeGreeting\.toLowerCase\(\)\} sunshine, \$\{profile\.name\}/);
  assert.match(welcomeHelper, /Hey, asshole/);
  assert.match(welcomeHelper, /Hey, unc/);
  assert.doesNotMatch(page, /@gmail\.com/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /updateRecipe/);
  assert.match(route, /deleteRecipe/);
  assert.match(route, /parseHomeStockAction/);
  assert.match(inputValidation, /RequestValidationError/);
  assert.match(repository, /db\.transaction/);
  assert.match(repository, /householdId: string/);
  assert.match(repository, /eq\(inventoryItems\.householdId, householdId\)/);
  assert.match(repository, /eq\(shoppingListItems\.householdId, householdId\)/);
  assert.match(repository, /eq\(recipeTable\.householdId, householdId\)/);
  assert.match(repository, /eq\(recipeIngredients\.householdId, householdId\)/);
  assert.match(route, /requireHousehold/);
  assert.match(householdAuth, /const \{ userId \} = await auth\(\)/);
  assert.match(householdAuth, /await currentUser\(\)/);
  assert.match(householdAuth, /getHouseholdForEmail/);
  assert.match(householdAuth, /HOUSEHOLD_REQUIRED/);
  assert.match(householdAuth, /welcomeProfilesByEmail/);
  assert.match(route, /welcomeProfile/);
  assert.match(importRoute, /importRecipeFromUrl/);
  assert.match(importer, /lookup\(host/);
  assert.match(importer, /redirect: "manual"/);
  assert.match(importer, /maxHtmlBytes/);
  assert.match(suggestRoute, /suggestRecipeFromInventory/);
  assert.doesNotMatch(suggestRoute, /ingredientNames/);
  assert.match(suggestionHelper, /GEMINI_API_KEY/);
  assert.match(suggestionHelper, /gemini-flash-lite-latest/);
  assert.match(suggestionHelper, /google_search/);
  assert.match(suggestionHelper, /sourceUrl must be the real recipe page/);
  assert.match(suggestionHelper, /AI recipe idea/);
  assert.match(suggestionHelper, /source: "ai"/);
  assert.match(suggestionHelper, /classifyRecipeFamily/);
  assert.match(suggestionHelper, /excludeFamilies/);
  assert.match(schema, /inventory_items/);
  assert.match(schema, /shopping_list_items/);
  assert.match(schema, /recipe_ingredients/);
  assert.match(schema, /source_url/);
  assert.match(schema, /household_id/);
  assert.match(schema, /household_members/);
  assert.match(proxy, /clerkMiddleware\(\{/);
  assert.match(proxy, /clockSkewInMs: process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(proxy, /createRouteMatcher/);
  assert.match(pageGuard, /when="signed-in"/);
  assert.match(pageGuard, /when="signed-out"/);
  assert.match(pageGuard, /RedirectToSignIn/);
  assert.doesNotMatch(pageGuard, /@clerk\/nextjs\/server/);
  assert.match(layout, /ClerkProvider/);
  assert.match(packageJson, /"@libsql\/client": "0\.17\.4"/);
  assert.match(packageJson, /"@clerk\/nextjs": "7\.7\.6"/);
  assert.match(packageJson, /"next": "16\.3\.1"/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
});

test("push notifications are wired end to end", async () => {
  const [page, schema, repository, packageJson, subscribeRoute, unsubscribeRoute, preferencesRoute, cronRoute, serviceWorker, envExample, vercelJson, globalsCss] = await Promise.all([
    readFile(new URL("../app/home-stock-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/home-stock-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/subscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/unsubscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/expiry-reminders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // --- Schema ---------------------------------------------------------
  assert.match(schema, /pushSubscriptions\s*=\s*sqliteTable\(\s*"push_subscriptions"/);
  assert.match(schema, /notifyOneDay: integer\("notify_one_day", \{ mode: "boolean" \}\)/);
  assert.match(schema, /notifyThreeDays: integer\("notify_three_days", \{ mode: "boolean" \}\)/);
  assert.match(schema, /notifySevenDays: integer\("notify_seven_days", \{ mode: "boolean" \}\)/);

  // --- Repository: schema, migration guard, and the functions routes call
  assert.match(repository, /CREATE TABLE IF NOT EXISTS push_subscriptions/);
  assert.match(repository, /ALTER TABLE households ADD COLUMN notify_one_day/);
  assert.match(repository, /ALTER TABLE households ADD COLUMN notify_three_days/);
  assert.match(repository, /ALTER TABLE households ADD COLUMN notify_seven_days/);
  assert.match(repository, /export async function savePushSubscription/);
  assert.match(repository, /export async function removePushSubscription/);
  assert.match(repository, /export async function getNotificationPreferences/);
  assert.match(repository, /export async function updateNotificationPreferences/);
  assert.match(repository, /export async function getHouseholdsWithPushSubscriptions/);
  assert.match(repository, /export async function getExpiringItems/);

  // --- API routes use requireHousehold (never trust a browser-supplied id)
  assert.match(subscribeRoute, /requireHousehold/);
  assert.match(unsubscribeRoute, /requireHousehold/);
  assert.match(preferencesRoute, /requireHousehold/);
  assert.match(subscribeRoute, /savePushSubscription/);
  assert.match(unsubscribeRoute, /removePushSubscription/);
  assert.match(preferencesRoute, /updateNotificationPreferences/);

  // --- Cron route is bearer-protected and uses web-push
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.doesNotMatch(cronRoute, /searchParams\.get\("cronSecret"\)/);
  assert.match(cronRoute, /webpush\.sendNotification/);

  // --- Service worker handles push and notificationclick
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /addEventListener\("notificationclick"/);
  assert.match(serviceWorker, /clients\.openWindow/);

  // --- Settings UI registers the service worker at /sw.js
  assert.match(page, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(page, /Notification\.requestPermission/);
  assert.match(page, /\/api\/push\/subscribe/);
  assert.match(page, /\/api\/push\/unsubscribe/);
  assert.match(page, /\/api\/push\/preferences/);
  assert.match(page, /1 day before expiry/);
  assert.match(page, /3 days before expiry/);
  assert.match(page, /7 days before expiry/);
  assert.match(page, /Add HomeStock to your Home Screen to enable push notifications/);
  assert.match(page, /Enable notifications/);
  // The new panel uses onClick handlers rather than <form> elements — the
  // brief is explicit. We assert on the structural shape instead of a string
  // scan because the file is one giant minified line and a substring search
  // would also match the unrelated <form> elements in AddItemModal etc.
  assert.match(page, /onClick=\{\(\) => void enableNotifications\(\)\}/);
  assert.match(page, /onClick=\{\(\) => void setPreference\("notifyOneDay"/);
  assert.match(page, /onClick=\{\(\) => void setPreference\("notifyThreeDays"/);
  assert.match(page, /onClick=\{\(\) => void setPreference\("notifySevenDays"/);
  assert.match(page, /onClick=\{\(\) => void disableNotifications\(\)\}/);

  // --- VAPID + CRON env vars are documented. The VAPID public key is
  // served to the browser at runtime via /api/push/vapid-public-key, so
  // the matching NEXT_PUBLIC_VAPID_PUBLIC_KEY is no longer required.
  assert.match(envExample, /VAPID_PUBLIC_KEY=/);
  assert.match(envExample, /VAPID_PRIVATE_KEY=/);
  assert.match(envExample, /VAPID_EMAIL=/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_VAPID_PUBLIC_KEY=/);
  assert.match(envExample, /vapid-public-key/);
  assert.match(envExample, /CRON_SECRET=/);

  // --- Vercel cron is wired at 0 8 * * *
  assert.match(vercelJson, /"path": "\/api\/cron\/expiry-reminders"/);
  assert.match(vercelJson, /"schedule": "0 8 \* \* \*"/);

  // --- web-push is a real dependency
  assert.match(packageJson, /"web-push":/);

  // --- Off-state toggle styling exists so the new toggles look right
  assert.match(globalsCss, /\.toggle\.off/);
});

test("push notification hardening (unique endpoint, partial update, per-device unsubscribe)", async () => {
  const [schema, repository, subscribeRoute, unsubscribeRoute, preferencesRoute, cronRoute, page] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/home-stock-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/subscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/unsubscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/expiry-reminders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/home-stock-app.tsx", import.meta.url), "utf8"),
  ]);

  // --- Unique index on endpoint: re-subscribing the same device cannot
  // create a duplicate row, and a single household can have many devices.
  assert.match(schema, /uniqueIndex\([^)]*push_subscriptions_endpoint/);

  // --- savePushSubscription upserts by endpoint (one row per device).
  assert.match(
    repository,
    /savePushSubscription[\s\S]*?eq\(pushSubscriptions\.endpoint, endpoint\)[\s\S]*?existing\.length > 0[\s\S]*?\.update\(pushSubscriptions\)/,
  );

  // --- getExpiringItems filters in SQL rather than pulling everything and
  // trimming in JS. The implementation uses `sql\`...\`` template literals
  // (not Drizzle's gte/lte helpers), so we assert on the structural shape
  // including the `${...}` template substitutions.
  assert.match(
    repository,
    /export async function getExpiringItems\([\s\S]*?orderBy\(asc\(inventoryItems\.expiry\)\)/,
  );
  assert.match(repository, /\$\{inventoryItems\.expiry\} IS NOT NULL/);
  assert.match(repository, /\$\{inventoryItems\.expiry\} >= \$\{todayStr\}/);
  assert.match(repository, /\$\{inventoryItems\.expiry\} <= \$\{targetDateStr\}/);

  // --- getHouseholdsWithPushSubscriptions pre-filters in SQL: only
  // households with at least one preference enabled are returned, so the
  // cron route can drop its redundant JS filter. Each `eq(...)` is on its
  // own line, so the regex allows whitespace between the calls.
  assert.match(
    repository,
    /getHouseholdsWithPushSubscriptions[\s\S]*?or\(\s*[\s\S]*?eq\(households\.notifyOneDay, true\)[\s\S]*?eq\(households\.notifyThreeDays, true\)[\s\S]*?eq\(households\.notifySevenDays, true\)/,
  );
  // The cron route must NOT filter again in JS — trust the SQL.
  assert.doesNotMatch(cronRoute, /notifyOneDay \|\| household\.notifyThreeDays \|\| household\.notifySevenDays/);

  // --- updateNotificationPreferences takes a partial object so a single
  // PATCH can update one field without overwriting the others.
  assert.match(
    repository,
    /updateNotificationPreferences\(\s*householdId: string,\s*prefs: \{[\s\S]*?notifyOneDay\?: boolean[\s\S]*?notifyThreeDays\?: boolean[\s\S]*?notifySevenDays\?: boolean/,
  );
  // The PATCH route must NOT merge with current values server-side any more —
  // the repository does the partial update now.
  assert.doesNotMatch(preferencesRoute, /getNotificationPreferences/);
  assert.match(preferencesRoute, /updateNotificationPreferences\(household\.householdId, \{/);

  // --- A dedicated removePushSubscriptionByEndpoint repo function exists.
  assert.match(repository, /export async function removePushSubscriptionByEndpoint\(endpoint: string\): Promise<void>/);

  // --- The unsubscribe route accepts an endpoint in the body and uses
  // removePushSubscriptionByEndpoint when one is supplied.
  assert.match(unsubscribeRoute, /removePushSubscriptionByEndpoint/);
  assert.match(unsubscribeRoute, /typeof raw\.endpoint === "string"/);
  // Falls back to removePushSubscription (kill all for household) only if
  // no endpoint is provided.
  assert.match(unsubscribeRoute, /removePushSubscription\(household\.householdId\)/);

  // --- The client sends its own endpoint when unsubscribing.
  assert.match(page, /body: JSON\.stringify\(\{ endpoint \}\)/);
  // The endpoint is captured from the local subscription before the browser
  // unsubscribes, otherwise it is gone.
  assert.match(page, /endpoint = subscription\?\.endpoint/);

  // --- The cron route cleans up ONLY the dead endpoint, not every device
  // belonging to the household.
  assert.match(cronRoute, /removePushSubscriptionByEndpoint\(household\.endpoint\)/);
  assert.doesNotMatch(cronRoute, /removePushSubscription\(household\.householdId\)/);
});

test("VAPID public key is served via API, not baked into the client bundle", async () => {
  const [page, vapidRoute] = await Promise.all([
    readFile(new URL("../app/home-stock-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/vapid-public-key/route.ts", import.meta.url), "utf8"),
  ]);

  // --- The new server route exists and reads VAPID_PUBLIC_KEY (server-only,
  // not NEXT_PUBLIC_*), and returns 503 when unset.
  assert.match(vapidRoute, /process\.env\.VAPID_PUBLIC_KEY/);
  assert.doesNotMatch(vapidRoute, /NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  assert.match(vapidRoute, /status: 503/);
  assert.match(vapidRoute, /requireHousehold/);

  // --- The client fetches the key from the new route instead of reading
  // process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY. The old env-var read is gone.
  assert.match(page, /\/api\/push\/vapid-public-key/);
  assert.match(page, /householdFetch\("\/api\/push\/vapid-public-key"\)/);
  assert.doesNotMatch(page, /process\.env\.NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
});
