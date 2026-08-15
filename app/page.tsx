"use client";

import { useEffect, useMemo, useState } from "react";
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

type View = "dashboard" | "inventory" | "expiring" | "shopping" | "recipes" | "settings";
type RecipeMode = "use-soon" | "use-what-i-have" | "minimal-shopping";

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overview", icon: "⌂" },
  { id: "inventory", label: "Inventory", icon: "▦" },
  { id: "expiring", label: "Expiring soon", icon: "◷" },
  { id: "shopping", label: "Shopping list", icon: "✓" },
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

function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button aria-label={label} title={label} className={`icon-button ${className}`} onClick={onClick}>{children}</button>;
}

function AppMark() {
  return <div className="app-mark" aria-hidden="true"><span>⌂</span></div>;
}

function StatusPill({ status }: { status: ReturnType<typeof getExpiryStatus> }) {
  const copy = statusCopy[status];
  return <span className={`status-pill ${copy.className}`}><span className="status-dot" />{copy.label}</span>;
}

function ItemRow({ item, onFinish, onDelete, compact = false }: { item: InventoryItem; onFinish: () => void; onDelete: () => void; compact?: boolean }) {
  const status = getExpiryStatus(item.expiry);
  return <div className={`item-row ${status} ${compact ? "compact" : ""}`}>
    <div className={`category-mark category-${item.category.toLowerCase()}`}>{item.category === "Fridge" ? "❄" : item.category === "Pantry" ? "▤" : item.category === "Freezer" ? "◌" : "•"}</div>
    <div className="item-main">
      <div className="item-title-line"><strong>{item.name}</strong>{item.basic && <span className="basic-tag">Basic</span>}</div>
      <span className="item-meta">{item.quantity} {item.unit} · {item.location}</span>
    </div>
    <div className="item-expiry"><StatusPill status={status} /><span>{expiryLabel(item.expiry)}</span></div>
    {!compact && <div className="row-actions"><IconButton label={`Mark ${item.name} finished`} onClick={onFinish}>✓</IconButton><IconButton label={`Delete ${item.name}`} onClick={onDelete}>×</IconButton></div>}
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">⌁</div><strong>{title}</strong><p>{body}</p>{action}</div>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingListItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [recipeMode, setRecipeMode] = useState<RecipeMode>("use-soon");
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [recipeList, setRecipeList] = useState<Recipe[]>([]);
  const [databaseState, setDatabaseState] = useState<"checking" | "connected" | "offline">("checking");

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };

  const apiAction = async (action: string, payload: Record<string, unknown> = {}) => {
    try {
      const response = await fetch("/api/home-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const snapshot = await response.json() as { inventory: InventoryItem[]; shopping: ShoppingListItem[]; recipes: Recipe[]; error?: string };
      if (!response.ok) throw new Error(snapshot.error ?? "Database request failed.");
      setInventory(snapshot.inventory);
      setShopping(snapshot.shopping);
      if (snapshot.recipes.length > 0) setRecipeList(snapshot.recipes);
      setDatabaseState("connected");
      return true;
    } catch {
      setDatabaseState("offline");
      notify("Connect Turso to save changes across devices");
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/home-stock")
      .then(async (response) => {
        const snapshot = await response.json() as { inventory: InventoryItem[]; shopping: ShoppingListItem[]; recipes: Recipe[] };
        if (!response.ok) throw new Error("Database unavailable");
        if (!active) return;
        setInventory(snapshot.inventory);
        setShopping(snapshot.shopping);
        if (snapshot.recipes.length > 0) setRecipeList(snapshot.recipes);
        setDatabaseState("connected");
      })
      .catch(() => { if (active) setDatabaseState("offline"); });
    return () => { active = false; };
  }, []);

  const expiring = useMemo(() => inventory.filter((item) => ["expired", "urgent", "warning"].includes(getExpiryStatus(item.expiry))).sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999")), [inventory]);
  const basics = inventory.filter((item) => item.basic && item.quantity <= 2);
  const filteredInventory = inventory.filter((item) => {
    const matchesQuery = `${item.name} ${item.location} ${item.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const finishItem = (item: InventoryItem) => {
    setInventory((current) => current.filter((entry) => entry.id !== item.id));
    if (item.basic && !shopping.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase() && !entry.checked)) {
      setShopping((current) => [{ id: makeId("shop"), name: item.name, quantity: `${item.quantity} ${item.unit}`, category: item.category, checked: false, source: "inventory" }, ...current]);
      notify(`${item.name} finished · added to shopping list`);
    } else notify(`${item.name} marked as finished`);
    void apiAction("finishInventory", { id: item.id });
  };

  const deleteItem = (id: string) => { setInventory((current) => current.filter((item) => item.id !== id)); void apiAction("deleteInventory", { id }); };
  const toggleShopping = (id: string) => { setShopping((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item)); void apiAction("toggleShopping", { id }); };
  const removeShopping = (id: string) => { setShopping((current) => current.filter((item) => item.id !== id)); void apiAction("deleteShopping", { id }); };
  const addShopping = (name: string, category: Category = "Pantry", source: ShoppingListItem["source"] = "manual") => {
    if (!name.trim()) return;
    const item = { name: name.trim(), quantity: "1", category, source };
    setShopping((current) => [{ id: makeId("shop"), ...item, checked: false }, ...current]);
    void apiAction("addShopping", { item });
    notify(`${name.trim()} added to shopping list`);
  };

  const addMissing = (recipe: Recipe) => {
    const missing = missingIngredients(recipe, inventory);
    const items = missing.filter((name) => !shopping.some((item) => item.name.toLowerCase() === name.toLowerCase() && !item.checked)).map((name) => ({ name, quantity: "1", category: "Pantry" as Category, source: "recipe" as const }));
    setShopping((current) => [...items.map((item) => ({ id: makeId("recipe"), ...item, checked: false })), ...current]);
    void apiAction("addShoppingBatch", { items });
    notify(`${missing.length} missing ingredient${missing.length === 1 ? "" : "s"} added`);
  };

  const addInventoryItem = (item: Omit<InventoryItem, "id">) => {
    setInventory((current) => [{ ...item, id: makeId("item") }, ...current]);
    setShowAdd(false);
    void apiAction("addInventory", { item });
    notify(`${item.name} added to inventory`);
  };

  const renderView = () => {
    if (view === "inventory") return <InventoryView inventory={filteredInventory} query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onAdd={() => setShowAdd(true)} onFinish={finishItem} onDelete={deleteItem} />;
    if (view === "expiring") return <ExpiringView items={expiring} onFinish={finishItem} onDelete={deleteItem} onAdd={() => setShowAdd(true)} />;
    if (view === "shopping") return <ShoppingView shopping={shopping} onToggle={toggleShopping} onRemove={removeShopping} onAdd={(name) => addShopping(name)} />;
    if (view === "recipes") return <RecipesView mode={recipeMode} setMode={setRecipeMode} recipes={recipeList} inventory={inventory} onOpen={setActiveRecipe} onAddMissing={addMissing} />;
    if (view === "settings") return <SettingsView inventory={inventory} shopping={shopping} />;
    return <Dashboard inventory={inventory} expiring={expiring} basics={basics} shopping={shopping} recipes={recipeList} onAdd={() => setShowAdd(true)} onView={setView} onFinish={finishItem} onDelete={deleteItem} onRecipe={() => setView("recipes")} onAddShopping={(item) => addShopping(item.name, item.category, "inventory")} />;
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><AppMark /><div><strong>HomeStock</strong><span>your home, in order</span></div></div>
      <div className="home-label">Workspace</div>
      <nav className="side-nav" aria-label="Primary navigation">
        {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "expiring" && expiring.length > 0 && <span className="nav-count">{expiring.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><span className="nav-icon">⚙</span>Settings</button><div className="storage-card"><span className={`storage-orb ${databaseState}`} /><div><strong>{databaseState === "connected" ? "Turso workspace" : databaseState === "checking" ? "Connecting..." : "Not connected"}</strong><span>{databaseState === "connected" ? "Synced to database" : "Needs database setup"}</span></div></div></div>
    </aside>
    <section className="content-shell">
      <header className="topbar"><div className="breadcrumb"><span>Home</span><span className="slash">/</span><strong>{navItems.find((item) => item.id === view)?.label ?? "Settings"}</strong></div><div className="topbar-actions"><button className="quick-add" onClick={() => setShowAdd(true)}><span>＋</span> Add item</button><button className="avatar-button" aria-label="Open profile menu" onClick={() => setShowProfileMenu((current) => !current)}>MB</button>{showProfileMenu && <div className="profile-menu"><strong>Marton&apos;s home</strong><span>Personal workspace</span><button onClick={() => setView("settings")}>Workspace settings →</button></div>}</div></header>
      <div className="mobile-nav">{navItems.slice(0, 5).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label === "Shopping list" ? "Shop" : item.label === "Expiring soon" ? "Soon" : item.label}</button>)}</div>
      <div className="view-content">{renderView()}</div>
    </section>
    {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSubmit={addInventoryItem} />}
    {activeRecipe && <RecipeModal recipe={activeRecipe} inventory={inventory} onClose={() => setActiveRecipe(null)} onAddMissing={() => addMissing(activeRecipe)} onFinish={() => { setActiveRecipe(null); notify("Recipe ingredients marked for use"); }} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

function Dashboard({ inventory, expiring, basics, shopping, recipes: recipeList, onAdd, onView, onFinish, onDelete, onRecipe, onAddShopping }: { inventory: InventoryItem[]; expiring: InventoryItem[]; basics: InventoryItem[]; shopping: ShoppingListItem[]; recipes: Recipe[]; onAdd: () => void; onView: (view: View) => void; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void; onRecipe: () => void; onAddShopping: (item: InventoryItem) => void }) {
  return <div className="dashboard"><div className="page-intro"><div><div className="eyebrow">Saturday, 15 August 2026</div><h1>Good morning, Marton<span className="title-dot">.</span></h1><p>Here&apos;s what needs your attention around the house.</p></div><button className="primary-button" onClick={onAdd}><span>＋</span> Add item</button></div>
    <div className="summary-grid"><SummaryCard label="At home" value={inventory.length} detail="items tracked" accent="sage" icon="⌂" /><SummaryCard label="Use soon" value={expiring.filter((item) => getExpiryStatus(item.expiry) !== "expired").length} detail="in the next 5 days" accent="amber" icon="◷" action={() => onView("expiring")} /><SummaryCard label="Expired" value={inventory.filter((item) => getExpiryStatus(item.expiry) === "expired").length} detail="needs attention" accent="coral" action={() => onView("expiring")} icon="!" /><SummaryCard label="To buy" value={shopping.filter((item) => !item.checked).length} detail="on your list" accent="blue" icon="✓" action={() => onView("shopping")} /></div>
    <div className="dashboard-grid"><section className="panel next-expiry-panel"><PanelHeading eyebrow="Priority shelf" title="Next expiries" action="See all" onAction={() => onView("expiring")} /><div className="panel-note"><span className="pulse-dot" />A little nudge to use what&apos;s freshest first</div>{expiring.length ? <div className="item-list">{expiring.slice(0, 4).map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} />)}</div> : <EmptyState title="Nothing urgent" body="Your food is looking nicely under control." />}</section>
      <section className="panel use-panel"><PanelHeading eyebrow="Cook tonight" title="Use what may go first" action="View recipes" onAction={onRecipe} />{recipeList.length ? <div className="recipe-callout"><div className="recipe-illustration"><span>✦</span><i>✦</i><b>•</b></div><div><strong>{recipeList[0].name}</strong><p>{recipeList[0].description}</p><div className="recipe-foot"><span>{recipeList[0].time}</span><span>{recipeList[0].difficulty}</span><button onClick={onRecipe}>Open recipe <span>→</span></button></div></div></div> : <EmptyState title="No recipes yet" body="Your recipe shelf is ready for your own ideas." />}</section></div>
    <div className="lower-grid"><section className="panel basics-panel"><PanelHeading eyebrow="Keep stocked" title="Basics running low" action="View inventory" onAction={() => onView("inventory")} />{basics.length ? <div className="basic-list">{basics.slice(0, 4).map((item) => <div className="basic-row" key={item.id}><div className="basic-name"><span className="basic-icon">{item.category === "Bathroom" ? "◒" : item.category === "Cleaning" ? "✧" : "□"}</span><div><strong>{item.name}</strong><span>{item.quantity} {item.unit} left</span></div></div><button onClick={() => onAddShopping(item)}>Add to list <span>＋</span></button></div>)}</div> : <EmptyState title="All stocked" body="Your basics are in good shape." />}</section>
      <section className="panel shopping-snapshot"><PanelHeading eyebrow="While you&apos;re out" title="Shopping list" action="Open list" onAction={() => onView("shopping")} /><div className="shopping-progress"><div><strong>{shopping.filter((item) => item.checked).length}</strong><span>of {shopping.length} picked up</span></div><div className="progress-track"><span style={{ width: `${shopping.length ? (shopping.filter((item) => item.checked).length / shopping.length) * 100 : 0}%` }} /></div></div><div className="snapshot-items">{shopping.filter((item) => !item.checked).slice(0, 3).map((item) => <div key={item.id}><span className="unchecked" />{item.name}<small>{item.quantity}</small></div>)}</div></section></div>
  </div>;
}

function SummaryCard({ label, value, detail, accent, icon, action }: { label: string; value: number; detail: string; accent: string; icon: string; action?: () => void }) { return <button className={`summary-card ${accent}`} onClick={action}><div className="summary-top"><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><small>{detail}</small>{action && <span className="summary-arrow">→</span>}</button>; }
function PanelHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action && <button onClick={onAction}>{action} <span>→</span></button>}</div>; }

function InventoryView({ inventory, query, setQuery, categoryFilter, setCategoryFilter, onAdd, onFinish, onDelete }: { inventory: InventoryItem[]; query: string; setQuery: (value: string) => void; categoryFilter: "All" | Category; setCategoryFilter: (value: "All" | Category) => void; onAdd: () => void; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void }) {
  return <div className="list-view"><div className="page-intro"><div><div className="eyebrow">Everything under your roof</div><h1>Inventory</h1><p>Keep a simple, current picture of what you have.</p></div><button className="primary-button" onClick={onAdd}>＋ Add item</button></div><div className="toolbar"><label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your home" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "All" | Category)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div className="inventory-table"><div className="table-head"><span>Item</span><span>Category &amp; place</span><span>Expiry</span><span>Actions</span></div>{inventory.length ? inventory.map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} />) : <EmptyState title="No items found" body="Try another search or add something new." action={<button className="secondary-button" onClick={onAdd}>Add an item</button>} />}</div></div>;
}

function ExpiringView({ items, onFinish, onDelete, onAdd }: { items: InventoryItem[]; onFinish: (item: InventoryItem) => void; onDelete: (id: string) => void; onAdd: () => void }) { return <div className="list-view"><div className="page-intro"><div><div className="eyebrow">A little attention goes a long way</div><h1>Expiring soon</h1><p>Use these first to keep waste low and meals easy.</p></div><button className="primary-button" onClick={onAdd}>＋ Add item</button></div><div className="expiry-callout"><span className="callout-icon">◷</span><div><strong>{items.length ? `${items.length} items need a look` : "You’re all clear"}</strong><span>{items.some((item) => getExpiryStatus(item.expiry) === "expired") ? "Some items have already passed their date." : "No expired food in sight — nice work."}</span></div></div><div className="inventory-table"><div className="table-head"><span>Item</span><span>Category &amp; place</span><span>Expiry</span><span>Actions</span></div>{items.length ? items.map((item) => <ItemRow key={item.id} item={item} onFinish={() => onFinish(item)} onDelete={() => onDelete(item.id)} />) : <EmptyState title="Nothing expiring soon" body="Your next few days are looking good." />}</div></div>; }

function ShoppingView({ shopping, onToggle, onRemove, onAdd }: { shopping: ShoppingListItem[]; onToggle: (id: string) => void; onRemove: (id: string) => void; onAdd: (name: string) => void }) { const [newItem, setNewItem] = useState(""); const open = shopping.filter((item) => !item.checked); const done = shopping.filter((item) => item.checked); return <div className="list-view shopping-view"><div className="page-intro"><div><div className="eyebrow">Ready when you are</div><h1>Shopping list</h1><p>One clear list for the next trip to the store.</p></div><div className="shopping-count"><strong>{open.length}</strong><span>left to buy</span></div></div><form className="add-list-form" onSubmit={(event) => { event.preventDefault(); onAdd(newItem); setNewItem(""); }}><span>＋</span><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Add something to the list..." /><button type="submit">Add</button></form><div className="shopping-columns"><section className="shopping-card"><div className="shopping-card-heading"><h2>To buy <span>{open.length}</span></h2><span>Tap to check off</span></div>{open.length ? open.map((item) => <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />) : <EmptyState title="List is clear" body="Add something before your next shop." />}</section><section className="shopping-card completed-card"><div className="shopping-card-heading"><h2>Picked up <span>{done.length}</span></h2><span>Done</span></div>{done.length ? done.map((item) => <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />) : <p className="muted-copy">Checked items will appear here.</p>}</section></div></div>; }
function ShoppingRow({ item, onToggle, onRemove }: { item: ShoppingListItem; onToggle: () => void; onRemove: () => void }) { return <div className={`shopping-row ${item.checked ? "checked" : ""}`}><button className="check-box" onClick={onToggle} aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}>{item.checked ? "✓" : ""}</button><div><strong>{item.name}</strong><span>{item.quantity} · {item.category}{item.source !== "manual" && <em>{item.source === "recipe" ? "From recipe" : "Restock"}</em>}</span></div><IconButton label={`Remove ${item.name}`} onClick={onRemove}>×</IconButton></div>; }

function RecipesView({ mode, setMode, recipes: recipeList, inventory, onOpen, onAddMissing }: { mode: RecipeMode; setMode: (mode: RecipeMode) => void; recipes: Recipe[]; inventory: InventoryItem[]; onOpen: (recipe: Recipe) => void; onAddMissing: (recipe: Recipe) => void }) { const sorted = [...recipeList].sort((a, b) => { const aMissing = missingIngredients(a, inventory).length; const bMissing = missingIngredients(b, inventory).length; if (mode === "minimal-shopping") return aMissing - bMissing; if (mode === "use-soon") return matchingIngredients(b, inventory).length - matchingIngredients(a, inventory).length; return matchingIngredients(b, inventory).length - matchingIngredients(a, inventory).length; }); return <div className="list-view recipe-view"><div className="page-intro"><div><div className="eyebrow">Good food, less guesswork</div><h1>Recipes</h1><p>Ideas built around what&apos;s already waiting in your kitchen.</p></div><span className="recipe-badge">✦ Rule-based for now</span></div><div className="mode-tabs">{([["use-soon", "Cook with expiring items"], ["use-what-i-have", "Use what I have"], ["minimal-shopping", "Minimal shopping"]] as [RecipeMode, string][]).map(([id, label]) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{label}</button>)}</div><div className="recipe-grid">{sorted.length ? sorted.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} inventory={inventory} onOpen={() => onOpen(recipe)} onAddMissing={() => onAddMissing(recipe)} />) : <EmptyState title="No recipes yet" body="Add your own recipes when you are ready." />}</div></div>; }
function RecipeCard({ recipe, inventory, onOpen, onAddMissing }: { recipe: Recipe; inventory: InventoryItem[]; onOpen: () => void; onAddMissing: () => void }) { const matching = matchingIngredients(recipe, inventory); const missing = missingIngredients(recipe, inventory); return <article className="recipe-card"><div className="recipe-card-top"><div className="recipe-symbol">✦</div><div><div className="recipe-tags">{recipe.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2>{recipe.name}</h2><p>{recipe.description}</p></div></div><div className="ingredient-summary"><div><span className="ingredient-label">You have</span><strong>{matching.length} / {recipe.ingredients.length} ingredients</strong></div><div className="ingredient-bar"><span style={{ width: `${(matching.length / recipe.ingredients.length) * 100}%` }} /></div></div><div className="recipe-card-meta"><span>◷ {recipe.time}</span><span>⌁ {recipe.difficulty}</span><span>{missing.length ? `${missing.length} to buy` : "Ready to cook"}</span></div><div className="recipe-card-actions"><button className="secondary-button" onClick={onOpen}>View recipe</button>{missing.length > 0 && <button className="text-button" onClick={onAddMissing}>＋ Add missing</button>}</div></article>; }

function SettingsView({ inventory, shopping }: { inventory: InventoryItem[]; shopping: ShoppingListItem[] }) { return <div className="list-view settings-view"><div className="page-intro"><div><div className="eyebrow">Make it yours</div><h1>Settings</h1><p>Small preferences for a calmer home routine.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="eyebrow">Workspace</div><h2>Marton&apos;s home</h2><p>Inventory, shopping and recipe changes are stored in Turso. Your workspace starts empty so you can make it your own.</p><div className="setting-row"><div><strong>Expiry reminders</strong><span>Show urgent items on the overview</span></div><span className="toggle on"><i /></span></div><div className="setting-row"><div><strong>Restock basics</strong><span>Offer a shopping item when a basic runs out</span></div><span className="toggle on"><i /></span></div></section><section className="panel settings-panel"><div className="eyebrow">Data</div><h2>Your database snapshot</h2><div className="data-stat"><span>Inventory items</span><strong>{inventory.length}</strong></div><div className="data-stat"><span>Shopping items</span><strong>{shopping.length}</strong></div></section></div></div>; }

function AddItemModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (item: Omit<InventoryItem, "id">) => void }) { const [name, setName] = useState(""); const [category, setCategory] = useState<Category>("Fridge"); const [quantity, setQuantity] = useState("1"); const [unit, setUnit] = useState("pieces"); const [expiry, setExpiry] = useState(""); const [location, setLocation] = useState(""); const [basic, setBasic] = useState(false); return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card add-modal" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), category, location: location || "Not set", quantity: Number(quantity) || 1, unit, expiry: expiry || undefined, purchaseDate: "2026-08-15", basic }); }}><div className="modal-header"><div><div className="eyebrow">New item</div><h2>Add to inventory</h2></div><IconButton label="Close" onClick={onClose}>×</IconButton></div><div className="form-grid"><label className="full">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Avocados" required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Unit<select value={unit} onChange={(event) => setUnit(event.target.value)}><option>pieces</option><option>packs</option><option>grams</option><option>kg</option><option>liters</option><option>bottles</option></select></label><label>Expiry date<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label><label className="full">Where is it kept?<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Fridge door" /></label></div><label className="checkbox-label"><input type="checkbox" checked={basic} onChange={(event) => setBasic(event.target.checked)} /><span>Mark as a basic item <small>Offer to restock this when it&apos;s finished</small></span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Save item</button></div></form></div>; }

function RecipeModal({ recipe, inventory, onClose, onAddMissing, onFinish }: { recipe: Recipe; inventory: InventoryItem[]; onClose: () => void; onAddMissing: () => void; onFinish: () => void }) { const matching = matchingIngredients(recipe, inventory); const missing = missingIngredients(recipe, inventory); return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card recipe-modal"><div className="modal-header"><div><div className="eyebrow">Cook with what you have</div><h2>{recipe.name}</h2></div><IconButton label="Close" onClick={onClose}>×</IconButton></div><p className="recipe-modal-description">{recipe.description}</p><div className="recipe-modal-meta"><span>◷ {recipe.time}</span><span>⌁ {recipe.difficulty}</span><span>✦ {matching.length} at home</span></div><div className="modal-columns"><div><h3>Ingredients</h3><ul className="ingredient-list">{recipe.ingredients.map((ingredient) => <li key={ingredient} className={matching.includes(ingredient) ? "have" : "missing"}><span>{matching.includes(ingredient) ? "✓" : "＋"}</span>{ingredient}{!matching.includes(ingredient) && <em>to buy</em>}</li>)}</ul>{missing.length > 0 && <button className="text-button" onClick={onAddMissing}>＋ Add {missing.length} missing to list</button>}</div><div><h3>How to make it</h3><ol className="steps-list">{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Back</button><button className="primary-button" onClick={onFinish}>Mark ingredients for use</button></div></div></div>; }
