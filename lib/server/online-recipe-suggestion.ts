import { InventoryItem, matchingIngredients, missingIngredients, Recipe } from "../homestock";
import { suggestFromMealDB } from "./mealdb";
import { searchRecipeUrl } from "./web-search";
import { importRecipeFromUrl } from "./recipe-importer";

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          title?: string;
          uri?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type SuggestedRecipe = Omit<Recipe, "id">;

const geminiModel = "gemini-flash-lite-latest";
const maxIngredients = 40;
const foodCategories = new Set(["Fridge", "Freezer", "Pantry"]);
const groundingRetryDelayMs = 15 * 60 * 1_000;
let groundingUnavailableUntil = 0;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 500) || fallback : fallback;
}

function cleanList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => cleanText(entry)).filter(Boolean).slice(0, limit);
}

function cleanInventory(inventory: InventoryItem[]) {
  return inventory
    .filter((item) => item.quantity > 0 && foodCategories.has(item.category))
    .map((item) => item.name.replace(/[^\p{L}\p{N}\s,.'"-]/gu, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxIngredients);
}

function bestLocalRecipe(recipes: Recipe[], inventory: InventoryItem[]) {
  return recipes
    .filter((recipe) => recipe.ingredients.length > 0 && missingIngredients(recipe, inventory).length === 0)
    .sort((a, b) => matchingIngredients(b, inventory).length - matchingIngredients(a, inventory).length)[0];
}

function parseJsonObject(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return a recipe format I can read.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function firstWebSource(body: GeminiResponse) {
  const chunks = body.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const source = chunks.map((chunk) => chunk.web).find((web) => web?.uri);
  return source ? { title: cleanText(source.title, "Recipe source"), url: cleanText(source.uri) } : undefined;
}

function assertPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeRecipe(value: Record<string, unknown>, options: { fallbackSource?: { title: string; url: string }; requireSource: boolean }): SuggestedRecipe {
  const ingredients = cleanList(value.ingredients, 40);
  const steps = cleanList(value.steps, 30);
  const name = cleanText(value.name, options.requireSource ? "Online recipe idea" : "AI recipe idea");
  const sourceUrl = assertPublicHttpUrl(cleanText(value.sourceUrl)) ?? assertPublicHttpUrl(options.fallbackSource?.url ?? "");

  if (!name || ingredients.length === 0 || steps.length === 0) {
    throw new Error("Gemini returned an incomplete recipe.");
  }
  if (options.requireSource && !sourceUrl) throw new Error("Gemini did not return a real recipe source link.");

  return {
    name,
    description: cleanText(value.description, options.requireSource ? `Found online from ${options.fallbackSource?.title ?? "a recipe source"}.` : "AI recipe idea based on your inventory."),
    sourceUrl,
    ingredients,
    ingredientsHu: [],
    time: cleanText(value.time, "30 min").slice(0, 40),
    difficulty: cleanText(value.difficulty).toLowerCase().includes("medium") ? "Medium" : "Easy",
    recipeType: "savory" as const,
    tags: cleanList(value.tags, 6).length ? cleanList(value.tags, 6) : [options.requireSource ? "Online" : "AI idea", "Inventory"],
    tagsHu: [],
    steps,
    stepsHu: [],
  };
}

async function callGemini(apiKey: string, requestBody: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json().catch(() => ({ error: { message: "Gemini returned an unreadable response." } })) as GeminiResponse;
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Recipe suggestions are taking too long. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function quotaBlocked(message: string) {
  return /quota|rate|billing|RESOURCE_EXHAUSTED/i.test(message);
}

export async function suggestRecipeFromInventory({
  inventory,
  recipes,
  ingredientNames,
}: {
  inventory: InventoryItem[];
  recipes: Recipe[];
  ingredientNames?: string[];
}) {
  const localRecipe = ingredientNames ? undefined : bestLocalRecipe(recipes, inventory);
  if (localRecipe) return { source: "local" as const, recipe: localRecipe };

  const ingredients = ingredientNames?.map((name) => cleanText(name)).filter(Boolean).slice(0, maxIngredients) ?? cleanInventory(inventory);
  if (ingredients.length === 0) throw new Error("Add some food items to inventory first.");

  // Tier 1: Web search (Brave / Tavily / SerpAPI / DuckDuckGo) → scrape URL
  try {
    const recipeUrl = await searchRecipeUrl(ingredients);
    if (recipeUrl) {
      const imported = await importRecipeFromUrl(recipeUrl);
      return { source: "web" as const, recipe: imported };
    }
  } catch {
    // Search or scrape failed — fall through to Gemini
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini key is missing.");

  const groundedRequest = {
    contents: [{
      parts: [{
        text: [
          "Use Google Search to find exactly one real recipe page from the public web.",
          "Do not invent a recipe.",
          "Choose a practical dinner recipe based on the household's available ingredients.",
          "Use these available ingredients first:",
          ingredients.join(", "),
          "You may assume basic pantry staples only: water, salt, pepper, and a small amount of oil.",
          "Keep missing ingredients to zero if possible. If impossible, keep them very few.",
          "Return only JSON with these keys: name, description, sourceUrl, ingredients, steps, time, difficulty, tags.",
          "sourceUrl must be the real recipe page you found.",
          "No markdown. No extra text.",
        ].join("\n"),
      }],
    }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 900,
    },
  };

  if (Date.now() >= groundingUnavailableUntil) {
    const grounded = await callGemini(apiKey, groundedRequest);
    if (grounded.response.ok) {
      const text = grounded.body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!text) throw new Error("Gemini returned an empty recipe.");
      return { source: "web" as const, recipe: normalizeRecipe(parseJsonObject(text), { fallbackSource: firstWebSource(grounded.body), requireSource: true }) };
    }

    const groundedMessage = grounded.body.error?.message ?? "Gemini could not search for a recipe.";
    if (!quotaBlocked(groundedMessage)) throw new Error(groundedMessage);
    groundingUnavailableUntil = Date.now() + groundingRetryDelayMs;
  }

  // Tier 2: TheMealDB — free, no key, no quota
  const mealdb = await suggestFromMealDB(ingredients);
  if (mealdb) return mealdb;

  const aiIdeaRequest = {
    contents: [{
      parts: [{
        text: [
          "Create exactly one practical dinner recipe idea.",
          "This is a fallback because real Google Search recipe scouting is unavailable.",
          "Use these available ingredients first:",
          ingredients.join(", "),
          "You may assume basic pantry staples only: water, salt, pepper, and a small amount of oil.",
          "Keep missing ingredients to zero if possible. If impossible, keep them very few.",
          "Return only JSON with these keys: name, description, ingredients, steps, time, difficulty, tags.",
          "Do not include a sourceUrl, because this is not from a real recipe page.",
          "No markdown. No extra text.",
        ].join("\n"),
      }],
    }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
    },
  };
  const aiIdea = await callGemini(apiKey, aiIdeaRequest);
  if (!aiIdea.response.ok) throw new Error(aiIdea.body.error?.message ?? "Gemini could not suggest a recipe.");

  const text = aiIdea.body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty recipe.");

  return { source: "ai" as const, recipe: normalizeRecipe(parseJsonObject(text), { requireSource: false }) };
}
