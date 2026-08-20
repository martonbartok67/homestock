import assert from "node:assert/strict";
import test from "node:test";

import {
  expiryLabel,
  getExpiryStatus,
  matchingIngredients,
  missingIngredients,
} from "../lib/homestock.ts";
import {
  parseHomeStockAction,
  RequestValidationError,
} from "../lib/server/home-stock-input.ts";
import { importRecipeFromUrl } from "../lib/server/recipe-importer.ts";
import { getPersonalGreeting } from "../lib/welcome.ts";

test("welcome greetings match each household member", () => {
  for (const name of ["Lizi", "Emma"]) {
    const greetings = new Set(Array.from(
      { length: 24 },
      (_, hour) => getPersonalGreeting(hour, { name, tone: "sunshine" }),
    ));
    for (const word of ["cutie", "beautiful", "beauty", "sexy", "gorgeous", "lovely", "sunshine"]) {
      assert.ok(greetings.has(`Hey, ${word}, ${name}`));
    }
    assert.ok([...greetings].some((greeting) => greeting.includes("good ")));
  }
  const sharedRoasts = ["Hey, asshole", "Hey, dumbass", "Morning, menace", "Hey, gremlin", "What’s up, clown", "Hey, disaster", "Morning, troublemaker", "Look who’s awake", "Hey, unc", "Morning, fossil", "Hey, old man", "What’s up, dinosaur", "Hey, grandpa", "Morning, ancient one", "Hey, relic", "Look who survived another day"];
  for (const profile of [{ name: "Frici", tone: "asshole" }, { name: "Marci", tone: "unc" }]) {
    const greetings = new Set(Array.from(
      { length: 24 },
      (_, hour) => getPersonalGreeting(hour, profile),
    ));
    for (const greeting of sharedRoasts) assert.ok(greetings.has(greeting));
  }
  assert.equal(getPersonalGreeting(23, null), "Good night");
});

test("expiry labels use calendar days", () => {
  const reference = new Date(2026, 2, 28, 12);
  assert.equal(getExpiryStatus("2026-03-29", reference), "urgent");
  assert.equal(expiryLabel("2026-03-29", reference), "Expires tomorrow");
  assert.equal(getExpiryStatus("2026-04-04", reference), "okay");
});

test("recipe matching reports available and missing ingredients", () => {
  const inventory = [{
    id: "item-1",
    name: "Red onion",
    category: "Fridge",
    location: "Top shelf",
    quantity: 1,
    unit: "piece",
    basic: false,
  }];
  const recipe = {
    id: "recipe-1",
    name: "Soup",
    description: "Simple soup",
    ingredients: ["1 red onion", "2 tomatoes"],
    time: "30 min",
    difficulty: "Easy",
    tags: [],
    steps: ["Cook it"],
  };

  assert.deepEqual(matchingIngredients(recipe, inventory), ["1 red onion"]);
  assert.deepEqual(missingIngredients(recipe, inventory), ["2 tomatoes"]);
});

test("API input accepts one-language recipes and normalizes optional fields", () => {
  const result = parseHomeStockAction({
    action: "addRecipe",
    recipe: {
      name: "Paradicsomleves",
      description: "Házi recept",
      ingredients: ["paradicsom"],
      ingredientsHu: [],
      time: "30 min",
      difficulty: "Easy",
      tags: ["Leves"],
      tagsHu: [],
      steps: ["Főzd meg"],
      stepsHu: [],
    },
  });

  assert.equal(result.action, "addRecipe");
  assert.equal(result.recipe.name, "Paradicsomleves");
  assert.equal(result.recipe.sourceUrl, undefined);
});

test("API input accepts clearing or changing an inventory expiry", () => {
  const withDate = parseHomeStockAction({
    action: "updateInventoryExpiry",
    id: "item-1",
    expiry: "2026-08-25",
  });
  assert.equal(withDate.action, "updateInventoryExpiry");
  assert.equal(withDate.expiry, "2026-08-25");

  const cleared = parseHomeStockAction({
    action: "updateInventoryExpiry",
    id: "item-1",
    expiry: "",
  });
  assert.equal(cleared.action, "updateInventoryExpiry");
  assert.equal(cleared.expiry, undefined);
});

test("API input rejects malformed or unsafe writes", () => {
  assert.throws(() => parseHomeStockAction({ action: "deleteRecipe" }), RequestValidationError);
  assert.throws(() => parseHomeStockAction({
    action: "addInventory",
    item: { name: "Milk", category: "Fridge", location: "Door", quantity: -1, unit: "bottle", basic: false },
  }), /Quantity/);
  assert.throws(() => parseHomeStockAction({
    action: "updateInventoryExpiry",
    id: "item-1",
    expiry: "tomorrow",
  }), /valid date/);
  assert.throws(() => parseHomeStockAction({
    action: "addRecipe",
    recipe: { name: "Soup", description: "Soup", ingredients: ["water"], steps: ["Cook"], time: "10 min", difficulty: "Easy", tags: [], sourceUrl: "javascript:alert(1)" },
  }), /http or https/);
});

test("recipe importer blocks local and private addresses before fetching", async () => {
  await assert.rejects(importRecipeFromUrl("http://127.0.0.1/recipe"), /not public/);
  await assert.rejects(importRecipeFromUrl("http://192.168.1.2/recipe"), /not public/);
  await assert.rejects(importRecipeFromUrl("file:///etc/passwd"), /http or https/);
});
