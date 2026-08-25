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
