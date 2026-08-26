"use client";

import Image from "next/image";
import {
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  categories,
  expiryLabel,
  getExpiryStatus,
  InventoryItem,
  matchingIngredients,
  missingIngredients,
  Recipe,
  ShoppingListItem,
  Category,
} from "../lib/homestock";
import { getPersonalGreeting, type WelcomeProfile } from "../lib/welcome";
import { BarcodeScanner } from "./barcode-scanner";

type View = "dashboard" | "inventory" | "expiring" | "shopping" | "recipes" | "settings";
type RecipeMode = "use-soon" | "use-what-i-have" | "minimal-shopping";
type RecipeTypeFilter = "All" | Recipe["recipeType"];
type RecipeSuggestionSource = "local" | "web" | "ai";
type HouseholdSummary = { id: string; name: string; memberCount: number };
type HouseholdLoadStatus = "loading" | "ready" | "unassigned" | "error";

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview", icon: "⌂" },
  { id: "inventory", label: "Inventory", icon: "▦" },
  { id: "expiring", label: "Expiring soon", icon: "◷" },
  { id: "shopping", label: "Shopping list", icon: "✓" },
  { id: "recipes", label: "Recipes", icon: "✦" },
];

const mobileNavItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview", icon: "⌂" },
  { id: "inventory", label: "Inventory", icon: "▦" },
  { id: "expiring", label: "Soon", icon: "◷" },
  { id: "shopping", label: "Shop", icon: "✓" },
  { id: "recipes", label: "Recipes", icon: "✦" },
];

const statusCopy = {
  expired: { label: "Expired", className: "critical" },
  urgent: { label: "Use today", className: "urgent" },
  warning: { label: "Use soon", className: "warning" },
  okay: { label: "In date", className: "okay" },
  none: { label: "No expiry", className: "neutral" },
};

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function useCloseOnEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (enabled && event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [enabled, onClose]);
}

function useHouseholdFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers, cache: "no-store" });
    },
    [getToken],
  );
}

function sourceHostname(sourceUrl?: string) {
  if (!sourceUrl) return "";
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "recipe source";
  }
}

function IconButton({ label, children, onClick, onPointerDown, onPointerUp, onPointerLeave, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; onPointerDown?: () => void; onPointerUp?: () => void; onPointerLeave?: () => void; className?: string }) {
  return <button type="button" aria-label={label} title={label} className={`icon-button ${className}`} onClick={onClick}>{children}</button>;
}

function AppMark() {
  return <div className="app-mark" aria-hidden="true"><Image src="/favicon.svg" alt="" width={24} height={24} priority /></div>;
}

function HouseholdRequired() {
  return <main className="household-gate">
    <section>
      <div className="brand"><AppMark /><div><strong>HomeStock</strong><span>your home, in order</span></div></div>
      <div><span className="eyebrow">One small step</span><h1>Your email needs a home.</h1><p>This email is not on the HomeStock household list yet. Sign out and use an invited email, or ask the HomeStock owner to add it.</p></div>
      <div className="household-account"><span>Wrong email?</span><UserButton /></div>
    </section>
    <section className="household-gate-note"><span className="eyebrow">How it works</span><h2>One login, one private household.</h2><p>Clerk checks your email. Turso then opens only the inventory, shopping list, and recipes connected to that email.</p></section>
  </main>;
}

function HouseholdLoadError() {
  return <main className="household-gate">
    <section>
      <div className="brand"><AppMark /><div><strong>HomeStock</strong><span>your home, in order</span></div></div>
      <div><span className="eyebrow">Connection problem</span><h1>We could not open your household.</h1><p>Please refresh the page in a moment. Your saved data has not been changed.</p></div>
      <div className="household-account"><button className="secondary-button" onClick={() => window.location.reload()}>Try again</button><UserButton /></div>
    </section>
  </main>;
}

function StatusPill({ status }: { status: ReturnType<typeof getExpiryStatus> }) {
  const copy = statusCopy[status];
  return <span className={`status-pill ${copy.className}`}><span className="status-dot" />{copy.label}</span>;
}


// Long-press hook — shows tooltip on short tap, fires action on hold (500ms)
function useLongPress(onLongPress: () => void, tooltip: string, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hint, setHint] = useState("");
  const start = () => {
    timer.current = setTimeout(() => { setHint(""); onLongPress(); }, ms);
  };
  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  const tap = () => { cancel(); setHint(tooltip); setTimeout(() => setHint(""), 2000); };
  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onClick: tap,
    hint,
  };
}

function ItemRow({ item, onFinish, onDelete, onEdit = () => {}, onEditExpiry, compact = false }: { item: InventoryItem; onFinish: () => void; onDelete: () => void; onEdit?: () => void; onEditExpiry: () => void; compact?: boolean }) {
  const status = getExpiryStatus(item.expiry);
  const { onPointerDown, onPointerUp, onPointerLeave, onClick, hint } = useLongPress(onEdit, "Press and hold to edit", 550);
  return <div className={`item-row ${status} ${compact ? "compact" : ""}`}>
    <div className={`category-mark category-${item.category.toLowerCase()}`}>{item.category === "Fridge" ? "❄" : item.category === "Pantry" ? "▤" : item.category === "Freezer" ? "◌" : "•"}</div>
    <div className="item-main" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave} onClick={onClick} onDoubleClick={onEdit}>
      <div className="item-title-line"><strong>{item.name}</strong>{item.basic && <span className="basic-tag">Basic</span>}</div><span className="item-meta">{item.quantity} {item.unit} · {item.location}</span>{hint && <span className="longpress-hint" role="status">{hint}</span>}
    </div>
    <div className="item-expiry"><StatusPill status={status} /><span>{expiryLabel(item.expiry)}</span><button type="button" className="expiry-edit-button" onClick={(event) => { event.stopPropagation(); onEditExpiry(); }}>{item.expiry ? "Edit date" : "Add date"}</button></div>
    {!compact && <div className="row-actions"><IconButton label={`Edit ${item.name}`} onClick={onEdit}>✎</IconButton><IconButton label={`Mark ${item.name} finished`} onClick={onFinish}>✓</IconButton><IconButton label={`Delete ${item.name}`} onClick={onDelete}>×</IconButton></div>}
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">⌁</div><strong>{title}</strong><p>{body}</p>{action}</div>;
}

function useCurrentGreeting(profile: WelcomeProfile | null) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    dateLabel: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now),
    greeting: getPersonalGreeting(now.getHours(), profile),
  };
}

export default function Home() {
  const { isLoaded: authLoaded } = useAuth();
  const householdFetch = useHouseholdFetch();
  const [view, setView] = useState<View>("dashboard");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingListItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpiryItem, setEditingExpiryItem] = useState<InventoryItem | null>(null);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeMode, setRecipeMode] = useState<RecipeMode>("use-soon");
  const [recipeTagFilter, setRecipeTagFilter] = useState("All");
  const [recipeTypeFilter, setRecipeTypeFilter] = useState<RecipeTypeFilter>("All");
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [recipeList, setRecipeList] = useState<Recipe[]>([]);
  const [household, setHousehold] = useState<HouseholdSummary | null>(null);
  const [welcomeProfile, setWelcomeProfile] = useState<WelcomeProfile | null>(null);
  const [householdLoadStatus, setHouseholdLoadStatus] = useState<HouseholdLoadStatus>("loading");
  const [suggestedRecipe, setSuggestedRecipe] = useState<Recipe | null>(null);
  const [suggestionSource, setSuggestionSource] = useState<RecipeSuggestionSource | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState("");
  const [isSuggestingRecipe, setIsSuggestingRecipe] = useState(false);
  const shownOnlineRecipeNames = useRef<string[]>([]);
  const shownOnlineRecipeUrls = useRef<string[]>([]);
  const shownOnlineRecipeFamilies = useRef<string[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);
  const greeting = useCurrentGreeting(welcomeProfile);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const apiAction = async (action: string, payload: Record<string, unknown> = {}) => {
    try {
      const response = await householdFetch("/api/home-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const snapshot = await response.json() as { household?: HouseholdSummary; inventory?: InventoryItem[]; shopping?: ShoppingListItem[]; recipes?: Recipe[]; error?: string };
      if (!response.ok) throw new Error(snapshot.error ?? "Database request failed.");
      if (!Array.isArray(snapshot.inventory) || !Array.isArray(snapshot.shopping) || !Array.isArray(snapshot.recipes)) {
        throw new Error("The saved data response was incomplete.");
      }
      setInventory(snapshot.inventory);
      setShopping(snapshot.shopping);
      setRecipeList(snapshot.recipes);
      if (snapshot.household) setHousehold(snapshot.household);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn’t save that change. Please try again.");
      return false;
    }
  };

  useEffect(() => {
    if (!authLoaded) return;
    let active = true;
    void householdFetch("/api/home-stock")
      .then(async (response) => {
        const snapshot = await response.json() as { household?: HouseholdSummary; welcomeProfile?: WelcomeProfile | null; inventory?: InventoryItem[]; shopping?: ShoppingListItem[]; recipes?: Recipe[]; code?: string };
        if (response.status === 403 && snapshot.code === "HOUSEHOLD_REQUIRED") {
          if (active) setHouseholdLoadStatus("unassigned");
          return;
        }
        if (!response.ok || !Array.isArray(snapshot.inventory) || !Array.isArray(snapshot.shopping) || !Array.isArray(snapshot.recipes)) throw new Error("Database unavailable");
        if (!active) return;
        setInventory(snapshot.inventory);
        setShopping(snapshot.shopping);
        setRecipeList(snapshot.recipes);
        setHousehold(snapshot.household ?? null);
        setWelcomeProfile(snapshot.welcomeProfile ?? null);
        setHouseholdLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setInventory([]);
        setShopping([]);
        setRecipeList([]);
        setHouseholdLoadStatus("error");
        notify("Couldn’t load your household data.");
      });
    return () => { active = false; };
  }, [authLoaded, householdFetch, notify]);

  const expiring = useMemo(() => inventory.filter((item) => ["expired", "urgent", "warning"].includes(getExpiryStatus(item.expiry))).sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999")), [inventory]);
  const basics = inventory.filter((item) => item.basic && item.quantity <= 2);
  const filteredInventory = inventory.filter((item) => {
    const matchesQuery = `${item.name} ${item.location} ${item.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const finishItem = async (item: InventoryItem) => {
    const willRestock = item.basic && !shopping.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase() && !entry.checked);
    if (await apiAction("finishInventory", { id: item.id })) {
      notify(willRestock ? `${item.name} finished · added to shopping list` : `${item.name} marked as finished`);
    }
  };

  const deleteItem = async (id: string) => { await apiAction("deleteInventory", { id }); };
  const toggleShopping = async (id: string) => { await apiAction("toggleShopping", { id }); };
  const removeShopping = async (id: string) => { await apiAction("deleteShopping", { id }); };
  const addShopping = async (name: string, category: Category = "Pantry", source: ShoppingListItem["source"] = "manual") => {
    if (!name.trim()) return false;
    const item = { name: name.trim(), quantity: "1", category, source };
    const saved = await apiAction("addShopping", { item });
    if (saved) notify(`${name.trim()} added to shopping list`);
    return saved;
  };

  const addMissing = async (recipe: Recipe) => {
    const missing = missingIngredients(recipe, inventory);
    const items = missing.filter((name) => !shopping.some((item) => item.name.toLowerCase() === name.toLowerCase() && !item.checked)).map((name) => ({ name, quantity: "1", category: "Pantry" as Category, source: "recipe" as const }));
    if (items.length === 0) {
      notify("Those missing ingredients are already on your shopping list");
      return;
    }
    if (await apiAction("addShoppingBatch", { items })) {
      notify(`${items.length} missing ingredient${items.length === 1 ? "" : "s"} added`);
    }
  };

  const addInventoryItem = async (item: Omit<InventoryItem, "id">) => {
    const saved = await apiAction("addInventory", { item });
    if (saved) {
      notify(`${item.name} added to inventory`);
    }
    return saved;
  };

  const updateInventoryItem = async (item: InventoryItem) => {
    const saved = await apiAction("updateInventory", { id: item.id, item: { ...item, id: undefined } });
    if (saved) notify(`${item.name} updated`);
    return saved;
  };

  const updateInventoryExpiry = async (item: InventoryItem, expiry?: string) => {
    const saved = await apiAction("updateInventoryExpiry", { id: item.id, expiry });
    if (saved) {
      notify(expiry ? `${item.name} expiry updated` : `${item.name} expiry cleared`);
    }
    return saved;
  };

  const addRecipe = async (recipe: Omit<Recipe, "id">) => {
    const saved = await apiAction("addRecipe", { recipe });
    if (saved) {
      notify(`${recipe.name} added to recipes`);
    }
    return saved;
  };

  const updateRecipe = async (recipe: Omit<Recipe, "id">) => {
    if (!editingRecipe) return false;
    const id = editingRecipe.id;
    const saved = await apiAction("updateRecipe", { id, recipe });
    if (saved) {
      notify(`${recipe.name} updated`);
    }
    return saved;
  };

  const deleteRecipe = async (recipe: Recipe) => {
    if (!window.confirm(`Delete ${recipe.name}?`)) return;
    if (await apiAction("deleteRecipe", { id: recipe.id })) {
      if (activeRecipe?.id === recipe.id) setActiveRecipe(null);
      notify(`${recipe.name} deleted`);
    }
  };

  const suggestOnlineRecipe = async () => {
    if (isSuggestingRecipe) return;
    setIsSuggestingRecipe(true);
    setSuggestionStatus("Checking your saved recipes first...");
    try {
      const response = await householdFetch("/api/recipes/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludeNames: shownOnlineRecipeNames.current,
          excludeUrls: shownOnlineRecipeUrls.current,
           excludeFamilies: shownOnlineRecipeFamilies.current,
        }),
      });
      const body = await response.json() as { source?: RecipeSuggestionSource; recipe?: Recipe | Omit<Recipe, "id">; family?: string; error?: string };
      if (!response.ok || !body.recipe || !body.source) throw new Error(body.error ?? "Could not suggest a recipe.");
      const recipe = "id" in body.recipe ? body.recipe : { ...body.recipe, id: makeId("web") };
      if (body.source !== "local") {
        shownOnlineRecipeNames.current = [...shownOnlineRecipeNames.current, recipe.name].slice(-30);
        if (recipe.sourceUrl) shownOnlineRecipeUrls.current = [...shownOnlineRecipeUrls.current, recipe.sourceUrl].slice(-30);
        if (body.family) shownOnlineRecipeFamilies.current = [...shownOnlineRecipeFamilies.current, body.family].slice(-30);
      }
      setSuggestedRecipe(recipe);
      setSuggestionSource(body.source);
      setSuggestionStatus(body.source === "local" ? "You already have a saved recipe you can make." : body.source === "web" ? "Found a real recipe online with a source link." : "A real web recipe wasn’t available, so this is an AI idea without a source link.");
    } catch (error) {
      setSuggestedRecipe(null);
      setSuggestionSource(null);
      setSuggestionStatus(error instanceof Error ? error.message : "Could not suggest a recipe.");
    } finally {
      setIsSuggestingRecipe(false);
    }
  };

  const saveSuggestedRecipe = async () => {
    if (!suggestedRecipe || (suggestionSource !== "web" && suggestionSource !== "ai")) return;
    const { id: _id, ...recipe } = suggestedRecipe;
    void _id;
    if (await addRecipe(recipe)) {
      setSuggestedRecipe(null);
      setSuggestionSource(null);
      setSuggestionStatus("");
    }
  };

  const renderView = () => {
    if (view === "inventory") return <InventoryView inventory={filteredInventory} query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onAdd={() => setShowAdd(true)} onFinish={finishItem} onDelete={deleteItem} onEdit={setEditingInventoryItem} onEditExpiry={setEditingExpiryItem} />;
    if (view === "expiring") return <ExpiringView items={expiring} onFinish={finishItem} onDelete={deleteItem} onAdd={() => setShowAdd(true)} onEdit={setEditingInventoryItem} onEditExpiry={setEditingExpiryItem} />;
    if (view === "shopping") return <ShoppingView shopping={shopping} onToggle={toggleShopping} onRemove={removeShopping} onAdd={(name) => addShopping(name)} />;
    if (view === "recipes") return <RecipesView mode={recipeMode} setMode={setRecipeMode} tagFilter={recipeTagFilter} setTagFilter={setRecipeTagFilter} typeFilter={recipeTypeFilter} setTypeFilter={setRecipeTypeFilter} recipes={recipeList} inventory={inventory} suggestedRecipe={suggestedRecipe} suggestionSource={suggestionSource} suggestionStatus={suggestionStatus} isSuggesting={isSuggestingRecipe} onSuggest={suggestOnlineRecipe} onOpen={setActiveRecipe} onOpenSuggestion={() => suggestedRecipe && setActiveRecipe(suggestedRecipe)} onSaveSuggestion={saveSuggestedRecipe} onEdit={setEditingRecipe} onDelete={deleteRecipe} onAddMissing={addMissing} onAdd={() => setShowRecipeForm(true)} />;
    if (view === "settings") return <SettingsView householdName={household?.name ?? "Your household"} memberCount={household?.memberCount} inventory={inventory} shopping={shopping} recipes={recipeList} householdFetch={householdFetch} notify={notify} />;
    return <Dashboard inventory={inventory} expiring={expiring} basics={basics} shopping={shopping} recipes={recipeList} greeting={greeting} onAdd={() => setShowAdd(true)} onView={setView} onFinish={finishItem} onDelete={deleteItem} onRecipe={() => setView("recipes")} onAddShopping={(item) => addShopping(item.name, item.category, "inventory")} />;
  };

  if (!authLoaded || householdLoadStatus === "loading") {
    return <main className="session-loading"><AppMark /><span>Opening your household…</span></main>;
  }

  if (householdLoadStatus === "unassigned") return <HouseholdRequired />;
  if (householdLoadStatus === "error" || !household) return <HouseholdLoadError />;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><AppMark /><div><strong>HomeStock</strong><span>your home, in order</span></div></div>
      <div className="home-label"><span>Workspace</span><strong>{household.name}</strong></div>
      <nav className="side-nav" aria-label="Primary navigation">
        {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "expiring" && expiring.length > 0 && <span className="nav-count">{expiring.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><span className="nav-icon">⚙</span>Settings</button></div>
    </aside>
    <section className="content-shell">
      <header className="topbar"><div className="breadcrumb"><span>Home</span><span className="slash">/</span><strong>{mobileNavItems.find((item) => item.id === view)?.label ?? navItems.find((item) => item.id === view)?.label ?? "Settings"}</strong></div><div className="topbar-actions"><button className="quick-add" onClick={() => setShowAdd(true)}><span>＋</span> Add item</button><IconButton label="Settings" className={view === "settings" ? "active settings-button" : "settings-button"} onClick={() => setView("settings")}>⚙</IconButton></div></header>
      <nav className="mobile-nav" aria-label="Mobile navigation">{mobileNavItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="view-content">{renderView()}</div>
    </section>
    {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSubmit={addInventoryItem} />}
    {editingInventoryItem && <EditItemModal item={editingInventoryItem} onClose={() => setEditingInventoryItem(null)} onSubmit={updateInventoryItem} />}
    {editingExpiryItem && <EditExpiryModal item={editingExpiryItem} onClose={() => setEditingExpiryItem(null)} onSubmit={(expiry) => updateInventoryExpiry(editingExpiryItem, expiry)} />}
    {showRecipeForm && <RecipeFormModal onClose={() => setShowRecipeForm(false)} onSubmit={addRecipe} />}
    {editingRecipe && <RecipeFormModal initialRecipe={editingRecipe} onClose={() => setEditingRecipe(null)} onSubmit={updateRecipe} />}
    {activeRecipe && <RecipeModal recipe={activeRecipe} inventory={inventory} onClose={() => setActiveRecipe(null)} onAddMissing={() => addMissing(activeRecipe)} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

function Dashboard({ inventory, expiring, basics, shopping, recipes: recipeList, greeting, onAdd, onView, onFinish, onDelete, onRecipe, onAddShopping }: { inventory: InventoryItem[]; expiring: InventoryItem[]; basics: InventoryItem[]; shopping: ShoppingListItem[]; recipes: Recipe[]; greeting: { dateLabel: string; greeting: string }; onAdd: () => void; onView: (view: View) => void; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void; onRecipe: () => void; onAddShopping: (item: InventoryItem) => void }) {
  const featuredRecipe = [...recipeList].sort((a, b) => {
    const expiringDifference = matchingIngredients(b, expiring).length - matchingIngredients(a, expiring).length;
    if (expiringDifference) return expiringDifference;
    const availableDifference = matchingIngredients(b, inventory).length - matchingIngredients(a, inventory).length;
    if (availableDifference) return availableDifference;
    return missingIngredients(a, inventory).length - missingIngredients(b, inventory).length;
  })[0];
  return <div className="dashboard"><div className="page-intro"><div><div className="eyebrow" suppressHydrationWarning>{greeting.dateLabel}</div><h1 suppressHydrationWarning>{greeting.greeting}<span className="title-dot">.</span></h1><p>Here&apos;s what needs your attention around the house.</p></div><button className="primary-button" onClick={onAdd}><span>＋</span> Add item</button></div>
    <div className="summary-grid"><SummaryCard label="At home" value={inventory.length} detail="items tracked" accent="sage" icon="⌂" /><SummaryCard label="Use soon" value={expiring.filter((item) => getExpiryStatus(item.expiry) !== "expired").length} detail="in the next 5 days" accent="amber" icon="◷" action={() => onView("expiring")} /><SummaryCard label="Expired" value={inventory.filter((item) => getExpiryStatus(item.expiry) === "expired").length} detail="needs attention" accent="coral" action={() => onView("expiring")} icon="!" /><SummaryCard label="To buy" value={shopping.filter((item) => !item.checked).length} detail="on your list" accent="blue" icon="✓" action={() => onView("shopping")} /></div>
    <div className="dashboard-grid"><section className="panel next-expiry-panel"><PanelHeading eyebrow="Priority shelf" title="Next expiries" action="See all" onAction={() => onView("expiring")} /><div className="panel-note"><span className="pulse-dot" />A little nudge to use what&apos;s freshest first</div>{expiring.length ? <div className="item-list">{expiring.slice(0, 4).map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} onEditExpiry={() => onView("inventory")} />)}</div> : <EmptyState title="Nothing urgent" body="Your food is looking nicely under control." />}</section>
      <section className="panel use-panel"><PanelHeading eyebrow="Cook tonight" title="Use what may go first" action="View recipes" onAction={onRecipe} />{featuredRecipe ? <div className="recipe-callout"><div className="recipe-illustration"><span>✦</span><i>✦</i><b>•</b></div><div><strong>{featuredRecipe.name}</strong><p>{featuredRecipe.description}</p><div className="recipe-foot"><span>{featuredRecipe.time}</span><span>{featuredRecipe.difficulty}</span><button onClick={onRecipe}>Open recipe <span>→</span></button></div></div></div> : <EmptyState title="No recipes yet" body="Your recipe shelf is ready for your own ideas." />}</section></div>
    <div className="lower-grid"><section className="panel basics-panel"><PanelHeading eyebrow="Keep stocked" title="Basics running low" action="View inventory" onAction={() => onView("inventory")} />{basics.length ? <div className="basic-list">{basics.slice(0, 4).map((item) => <div className="basic-row" key={item.id}><div className="basic-name"><span className="basic-icon">{item.category === "Bathroom" ? "◒" : item.category === "Cleaning" ? "✧" : "□"}</span><div><strong>{item.name}</strong><span>{item.quantity} {item.unit} left</span></div></div><button onClick={() => onAddShopping(item)}>Add to list <span>＋</span></button></div>)}</div> : <EmptyState title="All stocked" body="Your basics are in good shape." />}</section>
      <section className="panel shopping-snapshot"><PanelHeading eyebrow="While you&apos;re out" title="Shopping list" action="Open list" onAction={() => onView("shopping")} /><div className="shopping-progress"><div><strong>{shopping.filter((item) => item.checked).length}</strong><span>of {shopping.length} picked up</span></div><div className="progress-track"><span style={{ width: `${shopping.length ? (shopping.filter((item) => item.checked).length / shopping.length) * 100 : 0}%` }} /></div></div><div className="snapshot-items">{shopping.filter((item) => !item.checked).slice(0, 3).map((item) => <div key={item.id}><span className="unchecked" />{item.name}<small>{item.quantity}</small></div>)}</div></section></div>
  </div>;
}

function SummaryCard({ label, value, detail, accent, icon, action }: { label: string; value: number; detail: string; accent: string; icon: string; action?: () => void }) { return <button className={`summary-card ${accent}`} onClick={action}><div className="summary-top"><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><small>{detail}</small>{action && <span className="summary-arrow">→</span>}</button>; }
function PanelHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action && <button onClick={onAction}>{action} <span>→</span></button>}</div>; }

function InventoryView({ inventory, query, setQuery, categoryFilter, setCategoryFilter, onAdd, onFinish, onDelete, onEdit, onEditExpiry }: { inventory: InventoryItem[]; query: string; setQuery: (value: string) => void; categoryFilter: "All" | Category; setCategoryFilter: (value: "All" | Category) => void; onAdd: () => void; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void; onEdit: (item: InventoryItem) => void; onEditExpiry: (item: InventoryItem) => void }) {
  return <div className="list-view"><div className="page-intro"><div><div className="eyebrow">Everything under your roof</div><h1>Inventory</h1><p>Keep a simple, current picture of what you have.</p></div><button className="primary-button" onClick={onAdd}>＋ Add item</button></div><div className="toolbar"><label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your home" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "All" | Category)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div className="inventory-table"><div className="table-head"><span>Item</span><span>Category &amp; place</span><span>Expiry</span><span>Actions</span></div>{inventory.length ? inventory.map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} onEdit={() => onEdit(item)} onEditExpiry={() => onEditExpiry(item)} />) : <EmptyState title="No items found" body="Try another search or add something new." action={<button className="secondary-button" onClick={onAdd}>Add an item</button>} />}</div></div>;
}

function ExpiringView({ items, onFinish, onDelete, onAdd, onEdit, onEditExpiry }: { items: InventoryItem[]; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void; onAdd: () => void; onEdit: (item: InventoryItem) => void; onEditExpiry: (item: InventoryItem) => void }) { return <div className="list-view"><div className="page-intro"><div><div className="eyebrow">A little attention goes a long way</div><h1>Expiring soon</h1><p>Use these first to keep waste low and meals easy.</p></div><button className="primary-button" onClick={onAdd}>＋ Add item</button></div><div className="expiry-callout"><span className="callout-icon">◷</span><div><strong>{items.length ? `${items.length} items need a look` : "You’re all clear"}</strong><span>{items.some((item) => getExpiryStatus(item.expiry) === "expired") ? "Some items have already passed their date." : "No expired food in sight — nice work."}</span></div></div><div className="inventory-table"><div className="table-head"><span>Item</span><span>Category &amp; place</span><span>Expiry</span><span>Actions</span></div>{items.length ? items.map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} onEdit={() => onEdit(item)} onEditExpiry={() => onEditExpiry(item)} />) : <EmptyState title="Nothing expiring soon" body="Your next few days are looking good." />}</div></div>; }

function ShoppingView({ shopping, onToggle, onRemove, onAdd }: { shopping: ShoppingListItem[]; onToggle: (id: string) => void; onRemove: (id: string) => void; onAdd: (name: string) => Promise<boolean> }) { const [newItem, setNewItem] = useState(""); const [isAdding, setIsAdding] = useState(false); const open = shopping.filter((item) => !item.checked); const done = shopping.filter((item) => item.checked); return <div className="list-view shopping-view"><div className="page-intro"><div><div className="eyebrow">Ready when you are</div><h1>Shopping list</h1><p>One clear list for the next trip to the store.</p></div><div className="shopping-count"><strong>{open.length}</strong><span>left to buy</span></div></div><form className="add-list-form" onSubmit={async (event) => { event.preventDefault(); if (!newItem.trim() || isAdding) return; setIsAdding(true); if (await onAdd(newItem)) setNewItem(""); setIsAdding(false); }}><span>＋</span><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Add something to the list..." /><button type="submit" disabled={isAdding}>{isAdding ? "Adding..." : "Add"}</button></form><div className="shopping-columns"><section className="shopping-card"><div className="shopping-card-heading"><h2>To buy <span>{open.length}</span></h2><span>Tap to check off</span></div>{open.length ? open.map((item) => <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />) : <EmptyState title="List is clear" body="Add something before your next shop." />}</section><section className="shopping-card completed-card"><div className="shopping-card-heading"><h2>Picked up <span>{done.length}</span></h2><span>Done</span></div>{done.length ? done.map((item) => <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />) : <p className="muted-copy">Checked items will appear here.</p>}</section></div></div>; }
function ShoppingRow({ item, onToggle, onRemove }: { item: ShoppingListItem; onToggle: () => void; onRemove: () => void }) { return <div className={`shopping-row ${item.checked ? "checked" : ""}`}><button className="check-box" onClick={onToggle} aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}>{item.checked ? "✓" : ""}</button><div><strong>{item.name}</strong><span>{item.quantity} · {item.category}{item.source !== "manual" && <em>{item.source === "recipe" ? "From recipe" : "Restock"}</em>}</span></div><IconButton label={`Remove ${item.name}`} onClick={onRemove}>×</IconButton></div>; }

function recipeDescription(recipe: Recipe, source: RecipeSuggestionSource | null) {
  if (source === "ai") return `${recipe.description} This is an AI idea, not a recipe copied from a website.`;
  return recipe.description;
}

function RecipesView({ mode, setMode, tagFilter, setTagFilter, typeFilter, setTypeFilter, recipes: recipeList, inventory, suggestedRecipe, suggestionSource, suggestionStatus, isSuggesting, onSuggest, onOpen, onOpenSuggestion, onSaveSuggestion, onEdit, onDelete, onAddMissing, onAdd }: { mode: RecipeMode; setMode: (mode: RecipeMode) => void; tagFilter: string; setTagFilter: (tag: string) => void; typeFilter: RecipeTypeFilter; setTypeFilter: (type: RecipeTypeFilter) => void; recipes: Recipe[]; inventory: InventoryItem[]; suggestedRecipe: Recipe | null; suggestionSource: RecipeSuggestionSource | null; suggestionStatus: string; isSuggesting: boolean; onSuggest: () => void; onOpen: (recipe: Recipe) => void; onOpenSuggestion: () => void; onSaveSuggestion: () => void; onEdit: (recipe: Recipe) => void; onDelete: (recipe: Recipe) => void; onAddMissing: (recipe: Recipe) => void; onAdd: () => void }) {
  const tagOptions = ["All", ...Array.from(new Set(recipeList.flatMap((recipe) => [...recipe.tags, ...(recipe.tagsHu ?? [])]).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const activeTag = tagOptions.includes(tagFilter) ? tagFilter : "All";
  const filteredByTag = activeTag === "All" ? recipeList : recipeList.filter((recipe) => [...recipe.tags, ...(recipe.tagsHu ?? [])].some((tag) => tag.toLocaleLowerCase() === activeTag.toLocaleLowerCase()));
  const filtered = typeFilter === "All" ? filteredByTag : filteredByTag.filter((recipe) => recipe.recipeType === typeFilter);
  const expiringInventory = inventory.filter((item) => ["expired", "urgent", "warning"].includes(getExpiryStatus(item.expiry)));
  const sorted = [...filtered].sort((a, b) => {
    const aMissing = missingIngredients(a, inventory).length;
    const bMissing = missingIngredients(b, inventory).length;
    const availableDifference = matchingIngredients(b, inventory).length - matchingIngredients(a, inventory).length;
    if (mode === "minimal-shopping") return aMissing - bMissing || availableDifference;
    if (mode === "use-soon") {
      return matchingIngredients(b, expiringInventory).length - matchingIngredients(a, expiringInventory).length || availableDifference || aMissing - bMissing;
    }
    return availableDifference || aMissing - bMissing;
  });

  return <div className="list-view recipe-view">
    <div className="page-intro">
      <div><div className="eyebrow">Good food, less guesswork</div><h1>Recipes</h1><p>Ideas built around what&apos;s already waiting in your kitchen.</p></div>
      <div className="recipe-heading-actions"><span className="recipe-badge">✦ English + optional magyar</span><button className="secondary-button" onClick={onSuggest} disabled={isSuggesting}>{isSuggesting ? "Searching..." : "Find real recipe online"}</button><button className="primary-button" onClick={onAdd}>＋ Add recipe</button></div>
    </div>
    {(suggestionStatus || suggestedRecipe) && <section className="online-suggestion-panel">
      <div><span>{suggestionSource === "web" ? "Real online recipe" : suggestionSource === "ai" ? "AI idea fallback" : suggestionSource === "local" ? "Saved recipe match" : "Online recipe search"}</span><strong>{suggestedRecipe?.name ?? suggestionStatus}</strong>{suggestedRecipe && <p>{recipeDescription(suggestedRecipe, suggestionSource)}</p>}{suggestionStatus && suggestedRecipe && <small>{suggestionStatus}</small>}{suggestedRecipe?.sourceUrl && <small>Source: {sourceHostname(suggestedRecipe.sourceUrl)}</small>}</div>
      {!suggestedRecipe && <div className="online-suggestion-actions"><button className="secondary-button" onClick={onSuggest} disabled={isSuggesting}>{isSuggesting ? "Searching..." : "Try again"}</button></div>}
      {suggestedRecipe && <div className="online-suggestion-actions"><button className="secondary-button" onClick={onOpenSuggestion}>View recipe</button>{(suggestionSource === "web" || suggestionSource === "ai") && <button className="text-button" onClick={onSaveSuggestion}>Save recipe</button>}</div>}
    </section>}
    <div className="recipe-controls"><div className="recipe-control-group"><span className="recipe-control-label">Plan around</span><div className="recipe-filter-row">{([["use-soon", "◷", "Use soon"], ["use-what-i-have", "✓", "What I have"], ["minimal-shopping", "⌁", "Less shopping"]] as [RecipeMode, string, string][]).map(([id, icon, label]) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}</div></div><div className="recipe-control-group recipe-type-group"><span className="recipe-control-label">Recipe mood</span><div className="recipe-filter-row"><button className={typeFilter === "All" ? "active" : ""} onClick={() => setTypeFilter("All")}>All</button><button className={typeFilter === "savory" ? "active" : ""} onClick={() => setTypeFilter("savory")}>Savory</button><button className={typeFilter === "sweet" ? "active" : ""} onClick={() => setTypeFilter("sweet")}>Sweet</button></div></div></div>
    <div className="recipe-grid">{sorted.length ? sorted.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} inventory={inventory} onOpen={() => onOpen(recipe)} onEdit={() => onEdit(recipe)} onDelete={() => onDelete(recipe)} onAddMissing={() => onAddMissing(recipe)} />) : <EmptyState title={recipeList.length ? "No recipes match that tag" : "No recipes yet"} body={recipeList.length ? "Choose another tag or add a new recipe." : "Add your own recipes in English or Hungarian."} action={<button className="secondary-button" onClick={onAdd}>＋ Add recipe</button>} />}</div>
  </div>;
}
function RecipeCard({ recipe, inventory, onOpen, onEdit, onDelete, onAddMissing }: { recipe: Recipe; inventory: InventoryItem[]; onOpen: () => void; onEdit: () => void; onDelete: () => void; onAddMissing: () => void }) { const matching = matchingIngredients(recipe, inventory); const missing = missingIngredients(recipe, inventory); return <article className="recipe-card"><div className="recipe-card-tools"><IconButton label={`Edit ${recipe.name}`} onClick={onEdit}>✎</IconButton><IconButton label={`Delete ${recipe.name}`} onClick={onDelete}>×</IconButton></div><div className="recipe-card-top"><div className="recipe-symbol">✦</div><div><div className="recipe-tags">{recipe.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2>{recipe.name}</h2>{recipe.nameHu && <span className="recipe-localized-name">{recipe.nameHu}</span>}<p>{recipe.description}</p>{recipe.descriptionHu && <p className="recipe-localized-copy">{recipe.descriptionHu}</p>}</div></div><div className="ingredient-summary"><div><span className="ingredient-label">You have</span><strong>{matching.length} / {recipe.ingredients.length} ingredients</strong></div><div className="ingredient-bar"><span style={{ width: `${recipe.ingredients.length ? (matching.length / recipe.ingredients.length) * 100 : 0}%` }} /></div></div><div className="recipe-card-meta"><span>◷ {recipe.time}</span><span>⌁ {recipe.difficulty}</span><span>{missing.length ? `${missing.length} to buy` : "Ready to cook"}</span></div><div className="recipe-card-actions"><button className="secondary-button" onClick={onOpen}>View recipe</button>{missing.length > 0 && <button className="text-button" onClick={onAddMissing}>＋ Add missing</button>}</div></article>; }

function RecipeFormModal({ initialRecipe, onClose, onSubmit }: { initialRecipe?: Recipe; onClose: () => void; onSubmit: (recipe: Omit<Recipe, "id">) => Promise<boolean> }) {
  const householdFetch = useHouseholdFetch();
  const [sourceUrl, setSourceUrl] = useState(initialRecipe?.sourceUrl ?? "");
  const [importUrl, setImportUrl] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useCloseOnEscape(onClose, !isSaving);
  const [nameEn, setNameEn] = useState(initialRecipe?.name ?? "");
  const [nameHu, setNameHu] = useState(initialRecipe?.nameHu ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initialRecipe?.description ?? "");
  const [descriptionHu, setDescriptionHu] = useState(initialRecipe?.descriptionHu ?? "");
  const [ingredientsEn, setIngredientsEn] = useState(initialRecipe?.ingredients.join("\n") ?? "");
  const [ingredientsHu, setIngredientsHu] = useState(initialRecipe?.ingredientsHu?.join("\n") ?? "");
  const [stepsEn, setStepsEn] = useState(initialRecipe?.steps.join("\n") ?? "");
  const [stepsHu, setStepsHu] = useState(initialRecipe?.stepsHu?.join("\n") ?? "");
  const [tagsEn, setTagsEn] = useState(initialRecipe?.tags.join(", ") ?? "");
  const [tagsHu, setTagsHu] = useState(initialRecipe?.tagsHu?.join(", ") ?? "");
  const [time, setTime] = useState(initialRecipe?.time ?? "30 min");
  const [difficulty, setDifficulty] = useState<Recipe["difficulty"]>(initialRecipe?.difficulty ?? "Easy");
  const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const splitTags = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);
  const submitRecipe = async () => {
    const englishIngredients = splitLines(ingredientsEn);
    const hungarianIngredients = splitLines(ingredientsHu);
    const englishSteps = splitLines(stepsEn);
    const hungarianSteps = splitLines(stepsHu);
    const englishTags = splitTags(tagsEn);
    const hungarianTags = splitTags(tagsHu);
    const usesHungarianNameAsPrimary = !nameEn.trim();
    const usesHungarianDescriptionAsPrimary = !descriptionEn.trim();
    const usesHungarianIngredientsAsPrimary = englishIngredients.length === 0;
    const usesHungarianStepsAsPrimary = englishSteps.length === 0;
    const usesHungarianTagsAsPrimary = englishTags.length === 0;
    const name = nameEn.trim() || nameHu.trim();
    const description = descriptionEn.trim() || descriptionHu.trim() || "Home recipe";
    const ingredients = usesHungarianIngredientsAsPrimary ? hungarianIngredients : englishIngredients;
    const steps = usesHungarianStepsAsPrimary ? hungarianSteps : englishSteps;

    if (!name || ingredients.length === 0 || steps.length === 0) {
      setFormError("Add a name, ingredients and steps in either English or Hungarian.");
      return;
    }

    setFormError("");
    setIsSaving(true);
    const saved = await onSubmit({
      name,
      nameHu: usesHungarianNameAsPrimary ? undefined : nameHu.trim() || undefined,
      description,
      descriptionHu: usesHungarianDescriptionAsPrimary ? undefined : descriptionHu.trim() || undefined,
      sourceUrl: sourceUrl || undefined,
      ingredients,
      ingredientsHu: usesHungarianIngredientsAsPrimary ? [] : hungarianIngredients,
      time: time.trim() || "30 min",
      difficulty,
      recipeType: initialRecipe?.recipeType ?? "savory",
      tags: usesHungarianTagsAsPrimary ? hungarianTags : englishTags,
      tagsHu: usesHungarianTagsAsPrimary ? [] : hungarianTags,
      steps,
      stepsHu: usesHungarianStepsAsPrimary ? [] : hungarianSteps,
    });
    setIsSaving(false);
    if (saved) onClose();
    else setFormError("That recipe wasn’t saved. Your text is still here so you can try again.");
  };
  const importRecipe = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setImportStatus("Reading recipe page...");
    setFormError("");
    try {
      const response = await householdFetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const body = await response.json() as { recipe?: Omit<Recipe, "id">; error?: string };
      if (!response.ok || !body.recipe) throw new Error(body.error ?? "Recipe import failed.");
      setNameEn(body.recipe.name);
      setDescriptionEn(body.recipe.description);
      setIngredientsEn(body.recipe.ingredients.join("\n"));
      setStepsEn(body.recipe.steps.join("\n"));
      setTagsEn(body.recipe.tags.join(", "));
      setTime(body.recipe.time);
      setDifficulty(body.recipe.difficulty);
      setSourceUrl(body.recipe.sourceUrl ?? importUrl.trim());
      setImportStatus("Imported. Review it, then save. Magyar text is optional.");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Recipe import failed.");
    } finally {
      setIsImporting(false);
    }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}><form className="modal-card recipe-form-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title" onSubmit={(event) => { event.preventDefault(); if (!isSaving) void submitRecipe(); }} noValidate><div className="modal-header"><div><div className="eyebrow">{initialRecipe ? "Edit recipe" : "New recipe"}</div><h2 id="recipe-form-title">{initialRecipe ? "Change recipe" : "Add recipe"}</h2></div><IconButton label="Close" onClick={isSaving ? undefined : onClose}>×</IconButton></div><p className="form-hint">Use a URL or type it yourself. English is the main display language; magyar text is optional.</p><div className="recipe-import-box"><label>Recipe URL<input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://..." /></label><button type="button" className="secondary-button" onClick={importRecipe} disabled={isImporting || isSaving}>{isImporting ? "Importing..." : initialRecipe ? "Replace from URL" : "Import"}</button>{importStatus && <span>{importStatus}</span>}</div>{formError && <p className="form-error">{formError}</p>}<div className="recipe-language-grid"><section><div className="language-label">English</div><label>Name<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="e.g. Vegetable pasta" /></label><label>Description<textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} placeholder="A short description" rows={3} /></label><label>Ingredients<textarea value={ingredientsEn} onChange={(event) => setIngredientsEn(event.target.value)} placeholder={"One per line\nPasta\nTomatoes"} rows={5} /></label><label>Steps<textarea value={stepsEn} onChange={(event) => setStepsEn(event.target.value)} placeholder={"One per line\nBoil the pasta\nAdd the sauce"} rows={5} /></label><label>Tags<input value={tagsEn} onChange={(event) => setTagsEn(event.target.value)} placeholder="Vegetarian, Quick" /></label></section><section><div className="language-label">Magyar <span>optional</span></div><label>Név<input value={nameHu} onChange={(event) => setNameHu(event.target.value)} placeholder="pl. Zöldséges tészta" /></label><label>Leírás<textarea value={descriptionHu} onChange={(event) => setDescriptionHu(event.target.value)} placeholder="Rövid leírás" rows={3} /></label><label>Hozzávalók<textarea value={ingredientsHu} onChange={(event) => setIngredientsHu(event.target.value)} placeholder={"Soronként egyet\nTészta\nParadicsom"} rows={5} /></label><label>Elkészítés<textarea value={stepsHu} onChange={(event) => setStepsHu(event.target.value)} placeholder={"Soronként egyet\nFőzd meg a tésztát\nAdd hozzá a szószt"} rows={5} /></label><label>Címkék<input value={tagsHu} onChange={(event) => setTagsHu(event.target.value)} placeholder="Vegetáriánus, Gyors" /></label></section></div><div className="recipe-shared-fields"><label>Time<input value={time} onChange={(event) => setTime(event.target.value)} placeholder="30 min" /></label><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Recipe["difficulty"])}><option>Easy</option><option>Medium</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : initialRecipe ? "Save changes" : "Save recipe"}</button></div></form></div>;
}

type NotificationPrefsState = {
  notifyOneDay: boolean;
  notifyThreeDays: boolean;
  notifySevenDays: boolean;
  hasSubscription: boolean;
};

type PushSupport = {
  supported: boolean;
  reason: string;
  isIOS: boolean;
  isStandalone: boolean;
};

function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Notifications are not available on the server.", isIOS: false, isStandalone: false };
  }
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !("MSStream" in window);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (typeof window.Notification === "undefined") {
    return { supported: false, reason: "Your browser does not support notifications.", isIOS, isStandalone };
  }
  if (typeof window.navigator.serviceWorker === "undefined") {
    return { supported: false, reason: "Your browser does not support background services.", isIOS, isStandalone };
  }
  if (isIOS && !isStandalone) {
    return { supported: false, reason: "Add HomeStock to your Home Screen to enable push notifications.", isIOS, isStandalone };
  }
  return { supported: true, reason: "", isIOS, isStandalone };
}

type SettingsPanelBodyProps = {
  support: PushSupport;
  permission: NotificationPermission;
  setPermission: (value: NotificationPermission) => void;
  prefs: NotificationPrefsState;
  setPrefs: React.Dispatch<React.SetStateAction<NotificationPrefsState>>;
  isLoadingPrefs: boolean;
  isEnabling: boolean;
  setIsEnabling: (value: boolean) => void;
  householdFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  notify: (message: string) => void;
};

function SettingsPanelBody({ support, permission, setPermission, prefs, setPrefs, isLoadingPrefs, isEnabling, setIsEnabling, householdFetch, notify }: SettingsPanelBodyProps) {
  const setPreference = async (key: "notifyOneDay" | "notifyThreeDays" | "notifySevenDays", value: boolean) => {
    const previous = prefs[key];
    setPrefs((current) => ({ ...current, [key]: value }));
    try {
      const response = await householdFetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Could not save your preference.");
      }
    } catch (error) {
      setPrefs((current) => ({ ...current, [key]: previous }));
      notify(error instanceof Error ? error.message : "Could not save your preference.");
    }
  };

  const enableNotifications = async () => {
    if (!support.supported || isEnabling) return;
    setIsEnabling(true);
    try {
      const next = await window.Notification.requestPermission();
      setPermission(next);
      if (next !== "granted") {
        notify("Browser permission was not granted.");
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      if (!vapidKey) {
        throw new Error("Push notifications are not configured for this deployment.");
      }
      const registration = await window.navigator.serviceWorker.register("/sw.js");
      const ready = registration.active ? registration : await window.navigator.serviceWorker.ready;
      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const json = subscription.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error("Browser did not return a valid push subscription.");
      }
      const response = await householdFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, p256dh, auth }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Could not save your subscription.");
      }
      setPrefs((current) => ({ ...current, hasSubscription: true }));
      notify("Expiry reminders are on. We will let you know when food is about to go off.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setIsEnabling(false);
    }
  };

  const disableNotifications = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    let endpoint: string | undefined;
    try {
      const registration = await window.navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      // Capture the endpoint *before* unsubscribing locally — once the local
      // subscription is gone, the browser no longer exposes it.
      endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
    } catch {
      // Server-side cleanup is what matters — ignore local unsubscribe errors.
    }
    try {
      const response = await householdFetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        // Send the endpoint so the server can remove only this device,
        // not every device that belongs to the household.
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Could not turn off notifications.");
      }
      setPrefs((current) => ({ ...current, hasSubscription: false }));
      notify("Notifications turned off.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not turn off notifications.");
    } finally {
      setIsEnabling(false);
    }
  };

  return <section className="panel settings-panel"><div className="eyebrow">Notifications</div><h2>Expiry reminders</h2><p>Get a heads-up before food goes off. We only use this to send expiry reminders for your household.</p>
    {!support.supported ? (
      <div className="setting-row"><div><strong>Browser support</strong><span>{support.reason}</span></div></div>
    ) : permission === "denied" ? (
      <div className="setting-row"><div><strong>Browser permission</strong><span>Notifications are blocked in this browser. Allow them in the address bar, then come back.</span></div></div>
    ) : !prefs.hasSubscription ? (
      <div className="setting-row"><div><strong>Reminders</strong><span>Allow HomeStock to send you expiry reminders for the items in your household.</span></div><button type="button" className="primary-button" onClick={() => void enableNotifications()} disabled={isEnabling}>{isEnabling ? "Enabling..." : "Enable notifications"}</button></div>
    ) : (
      <div className="setting-row"><div><strong>Reminders</strong><span>You will get a push notification when items in your household are about to expire.</span></div><button type="button" className="secondary-button" onClick={() => void disableNotifications()} disabled={isEnabling}>{isEnabling ? "Working..." : "Turn off"}</button></div>
    )}
    <div className="setting-row"><div><strong>1 day before expiry</strong><span>Final reminder for food that is about to go off tomorrow.</span></div><button type="button" aria-pressed={prefs.notifyOneDay} className={`toggle${prefs.notifyOneDay ? "" : " off"}`} onClick={() => void setPreference("notifyOneDay", !prefs.notifyOneDay)} disabled={!prefs.hasSubscription || isLoadingPrefs}><i /></button></div>
    <div className="setting-row"><div><strong>3 days before expiry</strong><span>Plan a meal around food that is closing in.</span></div><button type="button" aria-pressed={prefs.notifyThreeDays} className={`toggle${prefs.notifyThreeDays ? "" : " off"}`} onClick={() => void setPreference("notifyThreeDays", !prefs.notifyThreeDays)} disabled={!prefs.hasSubscription || isLoadingPrefs}><i /></button></div>
    <div className="setting-row"><div><strong>7 days before expiry</strong><span>Get an early nudge so you have time to use it.</span></div><button type="button" aria-pressed={prefs.notifySevenDays} className={`toggle${prefs.notifySevenDays ? "" : " off"}`} onClick={() => void setPreference("notifySevenDays", !prefs.notifySevenDays)} disabled={!prefs.hasSubscription || isLoadingPrefs}><i /></button></div>
  </section>;
}

function NotificationsPanel({ householdFetch, notify }: { householdFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; notify: (message: string) => void }) {
  const [support] = useState<PushSupport>(() => detectPushSupport());
  const [permission, setPermission] = useState<NotificationPermission>(() => (typeof window !== "undefined" && typeof window.Notification !== "undefined" ? window.Notification.permission : "denied"));
  const [prefs, setPrefs] = useState<NotificationPrefsState>({ notifyOneDay: false, notifyThreeDays: false, notifySevenDays: false, hasSubscription: false });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await householdFetch("/api/home-stock");
        if (!active || !response.ok) return;
        const body = await response.json().catch(() => ({})) as { household?: { notifyOneDay?: boolean; notifyThreeDays?: boolean; notifySevenDays?: boolean } };
        if (body.household) {
          setPrefs((current) => ({
            notifyOneDay: body.household?.notifyOneDay ?? current.notifyOneDay,
            notifyThreeDays: body.household?.notifyThreeDays ?? current.notifyThreeDays,
            notifySevenDays: body.household?.notifySevenDays ?? current.notifySevenDays,
            hasSubscription: current.hasSubscription,
          }));
        }
      } catch {
        // Quietly ignore — toggles will simply show their default state.
      } finally {
        if (active) setIsLoadingPrefs(false);
      }
    })();
    return () => { active = false; };
  }, [householdFetch]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.navigator.serviceWorker === "undefined") return;
    void window.navigator.serviceWorker.getRegistration().then((registration) => {
      setPrefs((current) => ({ ...current, hasSubscription: Boolean(registration && registration.active) }));
    }).catch(() => {
      setPrefs((current) => ({ ...current, hasSubscription: false }));
    });
  }, []);

  return <SettingsPanelBody support={support} permission={permission} setPermission={setPermission} prefs={prefs} setPrefs={setPrefs} isLoadingPrefs={isLoadingPrefs} isEnabling={isEnabling} setIsEnabling={setIsEnabling} householdFetch={householdFetch} notify={notify} />;
}

function SettingsView({ householdName, memberCount, inventory, shopping, recipes, householdFetch, notify }: { householdName: string; memberCount?: number; inventory: InventoryItem[]; shopping: ShoppingListItem[]; recipes: Recipe[]; householdFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; notify: (message: string) => void }) { return <div className="list-view settings-view"><div className="page-intro"><div><div className="eyebrow">Make it yours</div><h1>Settings</h1><p>Your household and account are always available here.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="eyebrow">Household</div><h2>{householdName}</h2><p>Inventory, shopping and recipe changes sync only with members of this household.</p><div className="account-control"><div><strong>Private household</strong><span>{memberCount ? `${memberCount} member${memberCount === 1 ? "" : "s"}` : "Email access list"}</span></div><span className="setting-status">Turso protected</span></div><div className="setting-row"><div><strong>Expiry reminders</strong><span>Urgent items appear on the overview automatically</span></div><span className="setting-status">Always on</span></div><div className="setting-row"><div><strong>Restock basics</strong><span>Finished basic items return to the shopping list</span></div><span className="setting-status">Always on</span></div></section><section className="panel settings-panel"><div className="eyebrow">Account &amp; data</div><h2>Your HomeStock access</h2><div className="account-control"><div><strong>Personal login</strong><span>Manage your email or sign out</span></div><UserButton /></div><div className="data-stat"><span>Inventory items</span><strong>{inventory.length}</strong></div><div className="data-stat"><span>Shopping items</span><strong>{shopping.length}</strong></div><div className="data-stat"><span>Saved recipes</span><strong>{recipes.length}</strong></div></section><NotificationsPanel householdFetch={householdFetch} notify={notify} /></div></div>; }

function AddItemModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (item: Omit<InventoryItem, "id">) => Promise<boolean> }) { const [name, setName] = useState(""); const [category, setCategory] = useState<Category>("Fridge"); const [quantity, setQuantity] = useState("1"); const [unit, setUnit] = useState("pieces"); const [expiry, setExpiry] = useState(""); const [location, setLocation] = useState(""); const [barcode, setBarcode] = useState(""); const [isScanning, setIsScanning] = useState(false); const [isLookingUp, setIsLookingUp] = useState(false); const [lookupError, setLookupError] = useState(""); const [basic, setBasic] = useState(false); const [isSaving, setIsSaving] = useState(false); const lookupBarcode = async (value = barcode) => { const code = value.trim(); if (!/^\d{8,14}$/.test(code)) return; setLookupError(""); setIsLookingUp(true); try { const response = await fetch(`/api/food-lookup?barcode=${encodeURIComponent(code)}`); const result = await response.json() as { found?: boolean; name?: string; category?: Category; error?: string }; if (!response.ok) throw new Error(result.error || "Lookup failed."); if (result.found && result.name) { setName(result.name); if (result.category) setCategory(result.category); } else { setLookupError("No product details were found. You can still save the barcode."); } } catch { setLookupError("Product lookup is unavailable. You can still save the barcode."); } finally { setIsLookingUp(false); } }; useCloseOnEscape(onClose, !isSaving); return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}><form className="modal-card add-modal" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onSubmit={async (event) => { event.preventDefault(); if (!name.trim() || isSaving) return; setIsSaving(true); const saved = await onSubmit({ name: name.trim(), category, location: location || "Not set", quantity: Number(quantity) || 1, unit, expiry: expiry || undefined, purchaseDate: todayInputValue(), barcode: barcode || undefined, basic }); setIsSaving(false); if (saved) onClose(); }}><div className="modal-header"><div><div className="eyebrow">New item</div><h2 id="add-item-title">Add to inventory</h2></div><IconButton label="Close" onClick={isSaving ? undefined : onClose}>×</IconButton></div><div className="form-grid"><label className="full">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Avocados" required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Unit<select value={unit} onChange={(event) => setUnit(event.target.value)}><option>pieces</option><option>packs</option><option>grams</option><option>kg</option><option>liters</option><option>bottles</option></select></label><label>Expiry date<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label><label className="full">Where is it kept?<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Fridge door" /></label></div><div className="barcode-field"><label>Barcode<input inputMode="numeric" pattern="[0-9]*" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Optional UPC/EAN" /></label><button type="button" className="secondary-button" onClick={() => setIsScanning(true)} disabled={isSaving}>Scan</button><button type="button" className="secondary-button" onClick={() => void lookupBarcode()} disabled={isSaving || isLookingUp || !/^\d{8,14}$/.test(barcode)}>{isLookingUp ? "Looking up..." : "Look up"}</button></div>{lookupError && <p className="form-hint">{lookupError}</p>}<label className="checkbox-label"><input type="checkbox" checked={basic} onChange={(event) => setBasic(event.target.checked)} /><span>Mark as a basic item <small>Offer to restock this when it&apos;s finished</small></span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save item"}</button></div></form>{isScanning && <BarcodeScanner onClose={() => setIsScanning(false)} onDetected={(code) => { setBarcode(code); setIsScanning(false); void lookupBarcode(code); }} />}</div>; }

function EditItemModal({ item, onClose, onSubmit }: { item: InventoryItem; onClose: () => void; onSubmit: (item: InventoryItem) => Promise<boolean> }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [expiry, setExpiry] = useState(item.expiry ?? "");
  const [location, setLocation] = useState(item.location === "Not set" ? "" : item.location);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [basic, setBasic] = useState(item.basic);
  const [isSaving, setIsSaving] = useState(false);
  useCloseOnEscape(onClose, !isSaving);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}><form className="modal-card add-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onSubmit={async (event) => { event.preventDefault(); if (!name.trim() || isSaving) return; setIsSaving(true); const saved = await onSubmit({ ...item, name: name.trim(), category, quantity: Math.max(1, Number(quantity) || 1), unit, expiry: expiry || undefined, location: location.trim() || "Not set", notes: notes.trim() || undefined, basic }); setIsSaving(false); if (saved) onClose(); }}>
    <div className="modal-header"><div><div className="eyebrow">Inventory item</div><h2 id="edit-item-title">Edit product</h2></div><IconButton label="Close" onClick={isSaving ? undefined : onClose}>×</IconButton></div>
    <p className="form-hint">Update the details for <strong>{item.name}</strong>. You can also long-press an item on your phone to open this editor.</p>
    <div className="form-grid"><label className="full">Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Unit<select value={unit} onChange={(event) => setUnit(event.target.value)}><option>pieces</option><option>packs</option><option>grams</option><option>kg</option><option>liters</option><option>bottles</option></select></label><label>Expiry date<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label><label className="full">Where is it kept?<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label className="full">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional notes" /></label></div>
    <label className="checkbox-label"><input type="checkbox" checked={basic} onChange={(event) => setBasic(event.target.checked)} /><span>Mark as a basic item <small>Offer to restock this when it&apos;s finished</small></span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</button></div>
  </form></div>;
}

function EditExpiryModal({ item, onClose, onSubmit }: { item: InventoryItem; onClose: () => void; onSubmit: (expiry?: string) => Promise<boolean> }) { const [expiry, setExpiry] = useState(item.expiry ?? ""); const [isSaving, setIsSaving] = useState(false); useCloseOnEscape(onClose, !isSaving); return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}><form className="modal-card add-modal" role="dialog" aria-modal="true" aria-labelledby="edit-expiry-title" onSubmit={async (event) => { event.preventDefault(); if (isSaving) return; setIsSaving(true); const saved = await onSubmit(expiry || undefined); setIsSaving(false); if (saved) onClose(); }}><div className="modal-header"><div><div className="eyebrow">Inventory date</div><h2 id="edit-expiry-title">Edit expiry</h2></div><IconButton label="Close" onClick={isSaving ? undefined : onClose}>×</IconButton></div><p className="form-hint">Change the date for <strong>{item.name}</strong>, or clear it if this item does not need one.</p><div className="form-grid expiry-form-grid"><label className="full">Expiry date<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label></div><div className="modal-actions modal-actions-split"><button type="button" className="text-button" onClick={() => setExpiry("")} disabled={isSaving}>Clear date</button><div><button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save date"}</button></div></div></form></div>; }

function RecipeModal({ recipe, inventory, onClose, onAddMissing }: { recipe: Recipe; inventory: InventoryItem[]; onClose: () => void; onAddMissing: () => void }) { useCloseOnEscape(onClose); const matching = matchingIngredients(recipe, inventory); const missing = missingIngredients(recipe, inventory); return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-detail-title"><div className="modal-header"><div><div className="eyebrow">Cook with what you have</div><h2 id="recipe-detail-title">{recipe.name}</h2>{recipe.nameHu && <span className="recipe-localized-name">{recipe.nameHu}</span>}</div><IconButton label="Close" onClick={onClose}>×</IconButton></div><p className="recipe-modal-description">{recipe.description}</p>{recipe.descriptionHu && <p className="recipe-modal-description recipe-localized-copy">{recipe.descriptionHu}</p>}<div className="recipe-modal-meta"><span>◷ {recipe.time}</span><span>⌁ {recipe.difficulty}</span><span>✦ {matching.length} at home</span>{recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}</div><div className="modal-columns"><div><h3>Ingredients</h3><ul className="ingredient-list">{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`} className={matching.includes(ingredient) ? "have" : "missing"}><span className="ingredient-check">{matching.includes(ingredient) ? "✓" : "＋"}</span><div><strong>{ingredient}</strong>{recipe.ingredientsHu?.[index] && <small>{recipe.ingredientsHu[index]}</small>}</div>{!matching.includes(ingredient) && <em>to buy</em>}</li>)}</ul>{missing.length > 0 && <button className="text-button" onClick={onAddMissing}>＋ Add {missing.length} missing to list</button>}</div><div><h3>How to make it</h3><ol className="steps-list">{recipe.steps.map((step, index) => <li key={`${step}-${index}`}><strong>{step}</strong>{recipe.stepsHu?.[index] && <span>{recipe.stepsHu[index]}</span>}</li>)}</ol></div></div><div className="modal-actions"><button className="primary-button" onClick={onClose}>Close recipe</button></div></div></div>; }
