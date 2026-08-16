import type { Recipe } from "../homestock";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

const blockedHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);
const maxHtmlBytes = 1_000_000;

function assertPublicRecipeUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use a full recipe URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Recipe links must start with http or https.");
  const host = url.hostname.toLowerCase();
  if (blockedHosts.has(host) || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error("That recipe URL is not public.");
  }
  return url;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function asRecord(value: JsonValue | undefined): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function asString(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") return stripTags(value);
  if (typeof value === "number") return String(value);
  return undefined;
}

function asStringArray(value: JsonValue | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => {
    if (typeof entry === "string") return [stripTags(entry)];
    const record = asRecord(entry);
    const text = asString(record?.text ?? record?.name);
    return text ? [text] : [];
  }).filter(Boolean);
  const text = asString(value);
  return text ? [text] : [];
}

function normalizeType(value: JsonValue | undefined) {
  return asStringArray(value).map((entry) => entry.toLowerCase());
}

function parseDuration(value: string | undefined) {
  if (!value) return "30 min";
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (iso) {
    const hours = Number(iso[1] ?? 0);
    const minutes = Number(iso[2] ?? 0);
    const total = hours * 60 + minutes;
    return total ? `${total} min` : "30 min";
  }
  return value;
}

function collectJsonLd(value: JsonValue): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(collectJsonLd);
  const record = asRecord(value);
  if (!record) return [];
  const graph = record["@graph"];
  return [record, ...(Array.isArray(graph) ? graph.flatMap(collectJsonLd) : [])];
}

function extractRecipe(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const records = collectJsonLd(JSON.parse(decodeHtml(script[1])) as JsonValue);
      const recipe = records.find((record) => normalizeType(record["@type"]).includes("recipe"));
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }
  return undefined;
}

function mapInstructions(value: JsonValue | undefined): string[] {
  if (!value) return [];
  if (typeof value === "string") return [stripTags(value)];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") return [stripTags(entry)];
      const record = asRecord(entry);
      if (!record) return [];
      if (Array.isArray(record.itemListElement)) return mapInstructions(record.itemListElement);
      const text = asString(record.text ?? record.name);
      return text ? [text] : [];
    }).filter(Boolean);
  }
  const record = asRecord(value);
  const text = asString(record?.text ?? record?.name);
  return text ? [text] : [];
}

function firstMeta(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripTags(match[1]);
  }
  return undefined;
}

export async function importRecipeFromUrl(value: string): Promise<Omit<Recipe, "id">> {
  const url = assertPublicRecipeUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HomeStock recipe importer",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) throw new Error("Could not open that recipe page.");
  const html = (await response.text()).slice(0, maxHtmlBytes);
  const recipe = extractRecipe(html);
  if (!recipe) throw new Error("No recipe data was found on that page.");

  const name = asString(recipe.name) ?? firstMeta(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ?? "Imported recipe";
  const description = asString(recipe.description) ?? `Imported from ${url.hostname}`;
  const ingredients = asStringArray(recipe.recipeIngredient).slice(0, 80);
  const steps = mapInstructions(recipe.recipeInstructions).slice(0, 80);
  if (ingredients.length === 0 || steps.length === 0) throw new Error("That page did not include enough recipe detail to import.");

  const tags = [
    ...asStringArray(recipe.recipeCategory),
    ...asStringArray(recipe.recipeCuisine),
    "Imported",
  ].slice(0, 8);

  return {
    name,
    description,
    sourceUrl: url.toString(),
    ingredients,
    ingredientsHu: [],
    time: parseDuration(asString(recipe.totalTime) ?? asString(recipe.cookTime) ?? asString(recipe.prepTime)),
    difficulty: "Easy",
    tags,
    tagsHu: [],
    steps,
    stepsHu: [],
  };
}
