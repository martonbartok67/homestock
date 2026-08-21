// TheMealDB free API — no key required, no quota
// Docs: https://www.themealdb.com/api.php

import type { Recipe } from "../homestock";

const BASE = "https://www.themealdb.com/api/json/v1/1";
const TIMEOUT_MS = 10_000;

type MealSummary = { strMeal: string; idMeal: string };
type MealDetail = {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strTags: string | null;
  strSource: string | null;
  [key: string]: string | null;
};

async function mealdbFetch<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as { meals: T[] | null };
    return data.meals?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchByIngredient(ingredient: string): Promise<MealSummary | null> {
  // MealDB uses underscore-joined ingredient names
  const query = ingredient.split(",")[0].trim().replace(/\s+/g, "_");
  const url = `${BASE}/filter.php?i=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as { meals: MealSummary[] | null };
    const meals = data.meals;
    if (!meals || meals.length === 0) return null;
    // Pick a random result so repeated calls vary
    return meals[Math.floor(Math.random() * Math.min(meals.length, 10))];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseMealDetail(meal: MealDetail): Omit<Recipe, "id"> {
  // Extract ingredients (strIngredient1–20, skip empty)
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim();
    if (!name) continue;
    ingredients.push(measure ? `${measure} ${name}` : name);
  }

  // Split instructions into steps on double newline or numbered lines
  const rawSteps = meal.strInstructions
    .split(/\r?\n\r?\n|\r?\n(?=\d+[\.\)]?\s)/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").replace(/\r?\n/g, " ").trim())
    .filter((s) => s.length > 10);

  const tags = [
    meal.strCategory,
    meal.strArea,
    ...(meal.strTags?.split(",").map((t) => t.trim()) ?? []),
  ].filter(Boolean) as string[];

  const sourceUrl = meal.strSource?.startsWith("http") ? meal.strSource : undefined;

  // Rough difficulty/time heuristics from step count and instructions length
  const stepCount = rawSteps.length;
  const difficulty: Recipe["difficulty"] =
    stepCount >= 8 ? "Medium" : "Easy";
  const timeMin = Math.max(15, Math.min(90, stepCount * 7));

  // Savory/sweet heuristic from category
  const sweetCategories = new Set(["Dessert", "Breakfast", "Starter"]);
  const recipeType: Recipe["recipeType"] = sweetCategories.has(meal.strCategory)
    ? "sweet"
    : "savory";

  return {
    name: meal.strMeal,
    description: `${meal.strArea} ${meal.strCategory.toLowerCase()} recipe from TheMealDB.`,
    sourceUrl,
    ingredients,
    ingredientsHu: [],
    time: `${timeMin} min`,
    difficulty,
    recipeType,
    tags,
    tagsHu: [],
    steps: rawSteps,
    stepsHu: [],
  };
}

/**
 * Try to find a MealDB recipe that uses one of the provided inventory ingredients.
 * Tries each ingredient in order and returns the first full match.
 */
export async function suggestFromMealDB(
  inventoryIngredients: string[],
): Promise<{ recipe: Omit<Recipe, "id">; source: "mealdb" } | null> {
  // Try up to 6 ingredients before giving up
  const candidates = inventoryIngredients.slice(0, 6);

  for (const ingredient of candidates) {
    const summary = await fetchByIngredient(ingredient);
    if (!summary) continue;

    const detail = await mealdbFetch<MealDetail>(
      `${BASE}/lookup.php?i=${summary.idMeal}`,
    );
    if (!detail || !detail.strInstructions) continue;

    const recipe = parseMealDetail(detail);
    if (recipe.ingredients.length === 0 || recipe.steps.length === 0) continue;

    return { recipe, source: "mealdb" };
  }

  return null;
}
