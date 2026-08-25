// Multi-provider recipe web search
// Tries providers in order; returns the first usable recipe URL found.
// Set env vars for whichever APIs you have keys for — unset = skipped.
//   BRAVE_SEARCH_API_KEY   — https://api.search.brave.com (2,000 req/month free)
//   TAVILY_API_KEY         — https://tavily.com           (1,000 req/month free)
//   SERP_API_KEY           — https://serpapi.com          (100 req/month free)
// DuckDuckGo: no key needed, used as last resort (unofficial, rate-limited)

const TIMEOUT_MS = 8_000;

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isLikelyRecipeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    // Skip aggregators, ads, social, video
    const blocked = ["youtube.com", "facebook.com", "instagram.com", "tiktok.com",
      "pinterest.com", "twitter.com", "reddit.com", "amazon.com", "google.com"];
    if (blocked.some((b) => u.hostname.includes(b))) return false;
    return true;
  } catch {
    return false;
  }
}

function pickBestUrl(urls: string[]): string | null {
  return urls.find(isLikelyRecipeUrl) ?? null;
}

async function searchBrave(query: string): Promise<string | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&result_filter=web`;
  const res = await timedFetch(url, {
    headers: { "Accept": "application/json", "X-Subscription-Token": key },
  });
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null) as {
    web?: { results?: Array<{ url?: string }> };
  } | null;
  const urls = data?.web?.results?.map((r) => r.url ?? "").filter(Boolean) ?? [];
  return pickBestUrl(urls);
}

async function searchBraveAll(query: string): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&result_filter=web`;
  const res = await timedFetch(url, {
    headers: { "Accept": "application/json", "X-Subscription-Token": key },
  });
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null) as { web?: { results?: Array<{ url?: string }> } } | null;
  return (data?.web?.results?.map((r) => r.url ?? "").filter(Boolean) ?? []).filter(isLikelyRecipeUrl);
}

async function searchSerpAll(query: string): Promise<string[]> {
  const key = process.env.SERP_API_KEY;
  if (!key) return [];
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=10&api_key=${key}`;
  const res = await timedFetch(url);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null) as { organic_results?: Array<{ link?: string }> } | null;
  return (data?.organic_results?.map((r) => r.link ?? "").filter(Boolean) ?? []).filter(isLikelyRecipeUrl);
}

async function searchTavily(query: string): Promise<string | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  const res = await timedFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null) as {
    results?: Array<{ url?: string }>;
  } | null;
  const urls = data?.results?.map((r) => r.url ?? "").filter(Boolean) ?? [];
  return pickBestUrl(urls);
}

async function searchSerp(query: string): Promise<string | null> {
  const key = process.env.SERP_API_KEY;
  if (!key) return null;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${key}`;
  const res = await timedFetch(url);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null) as {
    organic_results?: Array<{ link?: string }>;
  } | null;
  const urls = data?.organic_results?.map((r) => r.link ?? "").filter(Boolean) ?? [];
  return pickBestUrl(urls);
}

async function searchDuckDuckGo(query: string): Promise<string | null> {
  // DDG lite endpoint — more reliable for server-side scraping
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + " recipe site:allrecipes.com OR site:bbcgoodfood.com OR site:seriouseats.com")}`;
  const res = await timedFetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html",
    },
  });
  if (!res?.ok) return null;
  const html = await res.text().catch(() => "");
  // DDG lite uses plain href links in results
  const matches = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !u.includes("duckduckgo.com"));
  return pickBestUrl(matches);
}

/**
 * Search for recipe URLs using available search APIs.
 * Tries: Brave → Tavily → SerpAPI → DuckDuckGo
 * Returns ALL candidate URLs so the caller can try each until one scrapes.
 */
export async function searchRecipeUrls(
  ingredients: string[],
  typeHint = "",
  excludeNames: string[] = [],
  excludeUrls: string[] = [],
): Promise<string[]> {
  const avoidPart = excludeNames.length > 0 ? ` -"${excludeNames[0]}"` : "";
  const excluded = new Set(excludeUrls.map((url) => url.trim().toLowerCase()).filter(Boolean));
  const query = `${typeHint || "dinner"} recipe using ${ingredients.slice(0, 5).join(", ")}${avoidPart}`;
  const seen = new Set<string>();
  const results: string[] = [];
  const addResult = (url: string) => {
    if (!excluded.has(url.trim().toLowerCase()) && !seen.has(url)) {
      seen.add(url);
      results.push(url);
    }
  };

  // Multi-result providers first for more candidates
  for (const url of await searchBraveAll(query)) addResult(url);
  for (const url of await searchSerpAll(query)) addResult(url);
  // Single-result fallbacks
  if (results.length < 3) {
    for (const provider of [searchTavily, searchDuckDuckGo]) {
      const url = await provider(query);
      if (url) addResult(url);
    }
  }
  // Shuffle so repeated calls with same ingredients vary
  results.sort(() => Math.random() - 0.5);
  return results.slice(0, 8);
}
