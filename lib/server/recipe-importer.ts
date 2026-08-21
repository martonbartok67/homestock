import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Recipe } from "../homestock";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

const blockedHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);
const maxHtmlBytes = 1_000_000;
const maxRedirects = 4;

function assertPublicRecipeUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use a full recipe URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Recipe links must start with http or https.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (blockedHosts.has(host) || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error("That recipe URL is not public.");
  }
  return url;
}

function isPrivateAddress(value: string) {
  const address = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (address.startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168))
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (isIP(address) === 6) {
    return address === "::"
      || address === "::1"
      || address.startsWith("fc")
      || address.startsWith("fd")
      || /^fe[89ab]/.test(address)
      || address.startsWith("2001:db8:");
  }
  return true;
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That recipe URL is not public.");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not find that recipe website.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("That recipe URL is not public.");
  }
}

async function readBoundedHtml(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("That link is not a recipe webpage.");
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxHtmlBytes) throw new Error("That recipe page is too large to import safely.");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxHtmlBytes) {
      await reader.cancel();
      throw new Error("That recipe page is too large to import safely.");
    }
    html += decoder.decode(value, { stream: true });
  }
  return html + decoder.decode();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[▢☐]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textsByClass(html: string, tag: string, className: string) {
  const matcher = new RegExp(`<${tag}[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...html.matchAll(matcher)].map((match) => stripTags(match[1])).filter(Boolean);
}

function firstTextByClass(html: string, tag: string, className: string) {
  return textsByClass(html, tag, className)[0];
}

function extractRecipeCard(html: string, url: URL): Omit<Recipe, "id"> | undefined {
  const name = firstTextByClass(html, "h2", "wprm-recipe-name") ?? firstTextByClass(html, "h1", "wprm-recipe-name");
  const description = firstTextByClass(html, "div", "wprm-recipe-summary") ?? `Imported from ${url.hostname}`;
  const ingredients = textsByClass(html, "li", "wprm-recipe-ingredient").slice(0, 80);
  const steps = textsByClass(html, "li", "wprm-recipe-instruction").slice(0, 80);

  if (!name || ingredients.length === 0 || steps.length === 0) return undefined;

  return {
    name,
    description,
    sourceUrl: url.toString(),
    ingredients,
    ingredientsHu: [],
    time: "30 min",
    difficulty: "Easy",
    recipeType: "savory" as const,
    tags: ["Imported"],
    tagsHu: [],
    steps,
    stepsHu: [],
  };
}

export async function importRecipeFromUrl(value: string): Promise<Omit<Recipe, "id">> {
  let url = assertPublicRecipeUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let response: Response | undefined;
  let html = "";
  try {
    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      await assertPublicHost(url);
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "HomeStock recipe importer",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirect === maxRedirects) throw new Error("That recipe page redirects too many times.");
      url = assertPublicRecipeUrl(new URL(location, url).toString());
    }
    if (!response?.ok) throw new Error("Could not open that recipe page.");
    html = await readBoundedHtml(response);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("That recipe page took too long to respond.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const recipe = extractRecipe(html);
  const recipeCard = recipe ? undefined : extractRecipeCard(html, url);
  if (!recipe && !recipeCard) throw new Error("No recipe data was found on that page.");

  if (recipeCard) return recipeCard;
  const structuredRecipe = recipe;
  if (!structuredRecipe) throw new Error("No recipe data was found on that page.");

  const name = asString(structuredRecipe.name) ?? firstMeta(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ?? "Imported recipe";
  const description = asString(structuredRecipe.description) ?? `Imported from ${url.hostname}`;
  const ingredients = asStringArray(structuredRecipe.recipeIngredient).slice(0, 80);
  const steps = mapInstructions(structuredRecipe.recipeInstructions).slice(0, 80);
  if (ingredients.length === 0 || steps.length === 0) throw new Error("That page did not include enough recipe detail to import.");

  const tags = [
    ...asStringArray(structuredRecipe.recipeCategory),
    ...asStringArray(structuredRecipe.recipeCuisine),
    "Imported",
  ].slice(0, 8);

  return {
    name,
    description,
    sourceUrl: url.toString(),
    ingredients,
    ingredientsHu: [],
    time: parseDuration(asString(structuredRecipe.totalTime) ?? asString(structuredRecipe.cookTime) ?? asString(structuredRecipe.prepTime)),
    difficulty: "Easy",
    recipeType: "savory" as const,
    tags,
    tagsHu: [],
    steps,
    stepsHu: [],
  };
}
