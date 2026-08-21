// TheMealDB free API — no key required, no quota
// Free key: "1" | Docs: https://www.themealdb.com/api.php

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
  strMealThumb: string | null;
  strTags: string | null;
  strSource: string | null;
  [key: string]: string | null;
};

async function mealdbGet<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as { meals: T[] | null };
    return data.meals?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mealdbGetAll<T>(path: string): Promise<T[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as { meals: T[] | null };
    return data.meals ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchDetail(idMeal: string): Promise<MealDetail | null> {
  return mealdbGet<MealDetail>(`/lookup.php?i=${idMeal}`);
}

function parseMealDetail(meal: MealDetail): Omit<Recipe, "id"> {
  // Ingredients: strIngredient1–20 paired with strMeasure1–20
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim();
    if (!name) continue;
    ingredients.push(measure ? `${measure} ${name}` : name);
  }

  // Steps: split on double newline or numbered lines
  const rawSteps = meal.strInstructions
    .split(/\r?\n\r?\n|\r?\n(?=\d+[\.\)]\s)/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").replace(/\r?\n/g, " ").trim())
    .filter((s) => s.length > 10);

  const tags = [
    meal.strCategory,
    meal.strArea,
    ...(meal.strTags?.split(",").map((t) => t.trim()).filter(Boolean) ?? []),
  ].filter(Boolean) as string[];

  const sourceUrl = meal.strSource?.startsWith("http") ? meal.strSource : undefined;
  const thumbUrl = meal.strMealThumb ?? undefined;

  const stepCount = rawSteps.length;
  const difficulty: Recipe["difficulty"] = stepCount >= 8 ? "Medium" : "Easy";
  const timeMin = Math.max(15, Math.min(90, stepCount * 7));

  const sweetCategories = new Set(["Dessert", "Breakfast", "Starter"]);
  const recipeType: Recipe["recipeType"] = sweetCategories.has(meal.strCategory) ? "sweet" : "savory";

  return {
    name: meal.strMeal,
    description: `${meal.strArea} ${meal.strCategory.toLowerCase()} from TheMealDB.`,
    sourceUrl,
    thumbUrl,
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
 * Strategy:
 * 1. Search by ingredient name (up to 6 ingredients tried)
 * 2. Search by ingredient keyword via name search
 * 3. Fall back to a random meal
 * Always returns something.
 */
export async function suggestFromMealDB(
  inventoryIngredients: string[],
): Promise<{ recipe: Omit<Recipe, "id">; source: "mealdb" } | null> {
  const candidates = inventoryIngredients.slice(0, 6);

  // 1. Filter by ingredient — try each inventory item
  for (const ingredient of candidates) {
    const query = ingredient.split(",")[0].trim().replace(/\s+/g, "_");
    const summaries = await mealdbGetAll<MealSummary>(`/filter.php?i=${encodeURIComponent(query)}`);
    if (!summaries || summaries.length === 0) continue;

    const summary = pickRandom(summaries.slice(0, 10));
    const detail = await fetchDetail(summary.idMeal);
    if (!detail?.strInstructions) continue;

    const recipe = parseMealDetail(detail);
    if (recipe.ingredients.length === 0 || recipe.steps.length === 0) continue;

    return { recipe, source: "mealdb" };
  }

  // 2. Name search — search for the first ingredient as a keyword
  if (candidates.length > 0) {
    const keyword = candidates[0].split(",")[0].trim();
    const summaries = await mealdbGetAll<MealSummary>(`/search.php?s=${encodeURIComponent(keyword)}`);
    if (summaries && summaries.length > 0) {
      const detail = await fetchDetail(pickRandom(summaries.slice(0, 5)).idMeal);
      if (detail?.strInstructions) {
        const recipe = parseMealDetail(detail);
        if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
          return { recipe, source: "mealdb" };
        }
      }
    }
  }

  // 3. Random meal — always available, never fails
  const random = await mealdbGet<MealDetail>(`/random.php`);
  if (random?.strInstructions) {
    const recipe = parseMealDetail(random);
    if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
      return { recipe, source: "mealdb" };
    }
  }

  return null;
}
