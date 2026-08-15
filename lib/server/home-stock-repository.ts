import { and, asc, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../../db";
import {
  inventoryItems,
  recipeIngredients,
  recipes as recipeTable,
  shoppingListItems,
} from "../../db/schema";
import {
  InventoryItem,
  Recipe,
  ShoppingListItem,
} from "../homestock";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit TEXT NOT NULL, expiry TEXT, purchase_date TEXT, notes TEXT, basic INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON inventory_items (category)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_expiry_idx ON inventory_items (expiry)`,
  `CREATE TABLE IF NOT EXISTS shopping_list_items (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, quantity TEXT NOT NULL DEFAULT '1', category TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, note TEXT, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS shopping_list_items_checked_idx ON shopping_list_items (checked)`,
  `CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, time TEXT NOT NULL, difficulty TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', steps TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recipe_ingredients (id TEXT PRIMARY KEY NOT NULL, recipe_id TEXT NOT NULL, ingredient_name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id)`,
  `CREATE TABLE IF NOT EXISTS user_preferences (id TEXT PRIMARY KEY NOT NULL, workspace_name TEXT NOT NULL DEFAULT 'Marton''s home', created_at TEXT NOT NULL)`,
];

let initialization: Promise<void> | undefined;

function now() {
  return new Date().toISOString();
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapInventory(row: typeof inventoryItems.$inferSelect): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as InventoryItem["category"],
    location: row.location,
    quantity: row.quantity,
    unit: row.unit,
    expiry: row.expiry ?? undefined,
    purchaseDate: row.purchaseDate ?? undefined,
    notes: row.notes ?? undefined,
    basic: row.basic,
  };
}

function mapShopping(row: typeof shoppingListItems.$inferSelect): ShoppingListItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category as ShoppingListItem["category"],
    checked: row.checked,
    note: row.note ?? undefined,
    source: row.source as ShoppingListItem["source"],
  };
}

export async function ensureDatabase() {
  if (!initialization) {
    const client = getSqlClient();
    initialization = client.batch(schemaStatements).then(() => undefined);
  }
  await initialization;
}

export async function getSnapshot() {
  await ensureDatabase();
  const db = getDb();
  const [inventory, shopping, recipeRows, ingredientRows] = await Promise.all([
    db.select().from(inventoryItems).orderBy(asc(inventoryItems.createdAt)),
    db.select().from(shoppingListItems).orderBy(asc(shoppingListItems.createdAt)),
    db.select().from(recipeTable).orderBy(asc(recipeTable.createdAt)),
    db.select().from(recipeIngredients).orderBy(asc(recipeIngredients.sortOrder)),
  ]);

  const recipes: Recipe[] = recipeRows.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    time: recipe.time,
    difficulty: recipe.difficulty as Recipe["difficulty"],
    tags: safeJson<string[]>(recipe.tags, []),
    steps: safeJson<string[]>(recipe.steps, []),
    ingredients: ingredientRows.filter((ingredient) => ingredient.recipeId === recipe.id).map((ingredient) => ingredient.ingredientName),
  }));

  return {
    inventory: inventory.map(mapInventory),
    shopping: shopping.map(mapShopping),
    recipes,
    database: { connected: true, workspace: "Marton's home" },
  };
}

export async function addInventoryItem(item: Omit<InventoryItem, "id">) {
  await ensureDatabase();
  await getDb().insert(inventoryItems).values({
    id: crypto.randomUUID(),
    name: item.name,
    category: item.category,
    location: item.location,
    quantity: item.quantity,
    unit: item.unit,
    expiry: item.expiry ?? null,
    purchaseDate: item.purchaseDate ?? null,
    notes: item.notes ?? null,
    basic: item.basic,
    createdAt: now(),
  });
  return getSnapshot();
}

export async function deleteInventoryItem(id: string) {
  await ensureDatabase();
  await getDb().delete(inventoryItems).where(eq(inventoryItems.id, id));
  return getSnapshot();
}

export async function finishInventoryItem(id: string) {
  await ensureDatabase();
  const db = getDb();
  const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  const item = rows[0];
  if (item) {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    if (item.basic) {
      const openMatch = await db.select({ id: shoppingListItems.id }).from(shoppingListItems).where(and(eq(shoppingListItems.name, item.name), eq(shoppingListItems.checked, false))).limit(1);
      if (openMatch.length === 0) {
        await db.insert(shoppingListItems).values({
          id: crypto.randomUUID(),
          name: item.name,
          quantity: `${item.quantity} ${item.unit}`,
          category: item.category,
          checked: false,
          note: null,
          source: "inventory",
          createdAt: now(),
        });
      }
    }
  }
  return getSnapshot();
}

export async function addShoppingItem(item: Omit<ShoppingListItem, "id" | "checked">) {
  await ensureDatabase();
  await getDb().insert(shoppingListItems).values({
    id: crypto.randomUUID(),
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    checked: false,
    note: item.note ?? null,
    source: item.source,
    createdAt: now(),
  });
  return getSnapshot();
}

export async function addShoppingItems(items: Array<Omit<ShoppingListItem, "id" | "checked">>) {
  await ensureDatabase();
  if (items.length > 0) {
    await getDb().insert(shoppingListItems).values(items.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      checked: false,
      note: item.note ?? null,
      source: item.source,
      createdAt: now(),
    })));
  }
  return getSnapshot();
}

export async function toggleShoppingItem(id: string) {
  await ensureDatabase();
  const db = getDb();
  const rows = await db.select({ checked: shoppingListItems.checked }).from(shoppingListItems).where(eq(shoppingListItems.id, id)).limit(1);
  if (rows[0]) await db.update(shoppingListItems).set({ checked: !rows[0].checked }).where(eq(shoppingListItems.id, id));
  return getSnapshot();
}

export async function deleteShoppingItem(id: string) {
  await ensureDatabase();
  await getDb().delete(shoppingListItems).where(eq(shoppingListItems.id, id));
  return getSnapshot();
}
