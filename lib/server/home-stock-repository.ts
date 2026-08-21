import { and, asc, count, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../../db";
import {
  inventoryItems,
  householdMembers,
  households,
  recipeIngredients,
  recipes as recipeTable,
  shoppingListItems,
} from "../../db/schema";
import type {
  InventoryItem,
  Recipe,
  ShoppingListItem,
} from "../homestock";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS household_members (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit TEXT NOT NULL, expiry TEXT, purchase_date TEXT, notes TEXT, basic INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shopping_list_items (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, name TEXT NOT NULL, quantity TEXT NOT NULL DEFAULT '1', category TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, note TEXT, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, name TEXT NOT NULL, name_hu TEXT, description TEXT NOT NULL, description_hu TEXT, source_url TEXT, time TEXT NOT NULL, difficulty TEXT NOT NULL, recipe_type TEXT NOT NULL DEFAULT 'savory', tags TEXT NOT NULL DEFAULT '[]', tags_hu TEXT NOT NULL DEFAULT '[]', steps TEXT NOT NULL DEFAULT '[]', steps_hu TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recipe_ingredients (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, recipe_id TEXT NOT NULL, ingredient_name TEXT NOT NULL, ingredient_name_hu TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS user_preferences (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL, workspace_name TEXT NOT NULL DEFAULT 'Household', created_at TEXT NOT NULL)`,
];

const householdTables = [
  "inventory_items",
  "shopping_list_items",
  "recipes",
  "recipe_ingredients",
  "user_preferences",
] as const;

const householdIndexStatements = [
  "CREATE INDEX IF NOT EXISTS household_members_household_idx ON household_members (household_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS household_members_email_unique ON household_members (email)",
  "CREATE INDEX IF NOT EXISTS inventory_items_household_idx ON inventory_items (household_id)",
  "CREATE INDEX IF NOT EXISTS inventory_items_household_category_idx ON inventory_items (household_id, category)",
  "CREATE INDEX IF NOT EXISTS inventory_items_household_expiry_idx ON inventory_items (household_id, expiry)",
  "CREATE INDEX IF NOT EXISTS shopping_list_items_household_idx ON shopping_list_items (household_id)",
  "CREATE INDEX IF NOT EXISTS shopping_list_items_household_checked_idx ON shopping_list_items (household_id, checked)",
  "CREATE INDEX IF NOT EXISTS recipes_household_idx ON recipes (household_id)",
  "CREATE INDEX IF NOT EXISTS recipe_ingredients_household_idx ON recipe_ingredients (household_id)",
  "CREATE INDEX IF NOT EXISTS recipe_ingredients_household_recipe_idx ON recipe_ingredients (household_id, recipe_id)",
  "CREATE INDEX IF NOT EXISTS user_preferences_household_idx ON user_preferences (household_id)",
];

let initialization: Promise<void> | undefined;

function now() {
  return new Date().toISOString();
}

function assertHouseholdId(householdId: string) {
  if (!householdId || householdId.length > 255) {
    throw new Error("A valid household is required.");
  }
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function ensureCurrentColumns() {
  const client = getSqlClient();
  const statements: string[] = [];

  for (const table of householdTables) {
    const result = await client.execute(`PRAGMA table_info(${table})`);
    const columns = new Set(result.rows.map((row) => String(row.name)));
    if (!columns.has("household_id")) {
      // Any unexpected rows from the old single-household version stay hidden.
      statements.push(
        `ALTER TABLE ${table} ADD COLUMN household_id TEXT NOT NULL DEFAULT ''`,
      );
    }
  }

  const [recipeInfo, ingredientInfo] = await Promise.all([
    client.execute("PRAGMA table_info(recipes)"),
    client.execute("PRAGMA table_info(recipe_ingredients)"),
  ]);
  const recipeColumns = new Set(recipeInfo.rows.map((row) => String(row.name)));
  const ingredientColumns = new Set(
    ingredientInfo.rows.map((row) => String(row.name)),
  );
  if (!recipeColumns.has("name_hu")) {
    statements.push("ALTER TABLE recipes ADD COLUMN name_hu TEXT");
  }
  if (!recipeColumns.has("description_hu")) {
    statements.push("ALTER TABLE recipes ADD COLUMN description_hu TEXT");
  }
  if (!recipeColumns.has("source_url")) {
    statements.push("ALTER TABLE recipes ADD COLUMN source_url TEXT");
  }
  if (!recipeColumns.has("tags_hu")) {
    statements.push(
      "ALTER TABLE recipes ADD COLUMN tags_hu TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!recipeColumns.has("steps_hu")) {
    statements.push(
      "ALTER TABLE recipes ADD COLUMN steps_hu TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!recipeColumns.has("recipe_type")) {
    statements.push(
      "ALTER TABLE recipes ADD COLUMN recipe_type TEXT NOT NULL DEFAULT 'savory'",
    );
  }
  if (!ingredientColumns.has("ingredient_name_hu")) {
    statements.push(
      "ALTER TABLE recipe_ingredients ADD COLUMN ingredient_name_hu TEXT",
    );
  }

  if (statements.length > 0) await client.batch(statements);
  await client.batch(householdIndexStatements);
}

function mapInventory(
  row: typeof inventoryItems.$inferSelect,
): InventoryItem {
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

function mapShopping(
  row: typeof shoppingListItems.$inferSelect,
): ShoppingListItem {
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
    initialization = client
      .batch(schemaStatements)
      .then(() => ensureCurrentColumns())
      .catch((error) => {
        initialization = undefined;
        throw error;
      });
  }
  await initialization;
}

export async function getHouseholdForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 320) return null;

  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({ id: households.id, name: households.name })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.email, normalizedEmail))
    .limit(1);
  const household = rows[0];
  if (!household) return null;

  const memberRows = await db
    .select({ value: count() })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id));

  return {
    ...household,
    memberCount: memberRows[0]?.value ?? 0,
  };
}

export async function getSnapshot(householdId: string) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  const [inventory, shopping, recipeRows, ingredientRows, householdRows, memberRows] = await Promise.all([
    db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, householdId))
      .orderBy(asc(inventoryItems.createdAt)),
    db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.householdId, householdId))
      .orderBy(asc(shoppingListItems.createdAt)),
    db
      .select()
      .from(recipeTable)
      .where(eq(recipeTable.householdId, householdId))
      .orderBy(asc(recipeTable.createdAt)),
    db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.householdId, householdId))
      .orderBy(asc(recipeIngredients.sortOrder)),
    db
      .select({ id: households.id, name: households.name })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1),
    db
      .select({ value: count() })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId)),
  ]);

  const ingredientsByRecipe = new Map<string, typeof ingredientRows>();
  for (const ingredient of ingredientRows) {
    const current = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
    current.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipeId, current);
  }

  const recipes: Recipe[] = recipeRows.map((recipe) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    return {
      id: recipe.id,
      name: recipe.name,
      nameHu: recipe.nameHu ?? undefined,
      description: recipe.description,
      descriptionHu: recipe.descriptionHu ?? undefined,
      sourceUrl: recipe.sourceUrl ?? undefined,
      time: recipe.time,
      difficulty: recipe.difficulty as Recipe["difficulty"],
      recipeType: (recipe.recipeType ?? "savory") as Recipe["recipeType"],
      tags: safeJson<string[]>(recipe.tags, []),
      tagsHu: safeJson<string[]>(recipe.tagsHu ?? "[]", []),
      steps: safeJson<string[]>(recipe.steps, []),
      stepsHu: safeJson<string[]>(recipe.stepsHu ?? "[]", []),
      ingredients: ingredients.map((ingredient) => ingredient.ingredientName),
      ingredientsHu: ingredients.map(
        (ingredient) => ingredient.ingredientNameHu ?? "",
      ),
    };
  });

  return {
    household: {
      id: householdRows[0]?.id ?? householdId,
      name: householdRows[0]?.name ?? "Your household",
      memberCount: memberRows[0]?.value ?? 0,
    },
    inventory: inventory.map(mapInventory),
    shopping: shopping.map(mapShopping),
    recipes,
    database: { connected: true },
  };
}

export async function addInventoryItem(
  householdId: string,
  item: Omit<InventoryItem, "id">,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb().insert(inventoryItems).values({
    id: crypto.randomUUID(),
    householdId,
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
  return getSnapshot(householdId);
}

export async function updateInventoryItem(
  householdId: string,
  id: string,
  item: Omit<InventoryItem, "id">,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb()
    .update(inventoryItems)
    .set({
      name: item.name,
      category: item.category,
      location: item.location,
      quantity: item.quantity,
      unit: item.unit,
      expiry: item.expiry ?? null,
      purchaseDate: item.purchaseDate ?? null,
      notes: item.notes ?? null,
      basic: item.basic,
    })
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    );
  return getSnapshot(householdId);
}

export async function deleteInventoryItem(
  householdId: string,
  id: string,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb()
    .delete(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    );
  return getSnapshot(householdId);
}

export async function updateInventoryExpiry(
  householdId: string,
  id: string,
  expiry?: string,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb()
    .update(inventoryItems)
    .set({ expiry: expiry ?? null })
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    );
  return getSnapshot(householdId);
}

export async function finishInventoryItem(
  householdId: string,
  id: string,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.householdId, householdId),
        ),
      )
      .limit(1);
    const item = rows[0];
    if (!item) return;

    await tx
      .delete(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.householdId, householdId),
        ),
      );
    if (!item.basic) return;

    const openMatch = await tx
      .select({ id: shoppingListItems.id })
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.householdId, householdId),
          eq(shoppingListItems.name, item.name),
          eq(shoppingListItems.checked, false),
        ),
      )
      .limit(1);
    if (openMatch.length === 0) {
      await tx.insert(shoppingListItems).values({
        id: crypto.randomUUID(),
        householdId,
        name: item.name,
        quantity: `${item.quantity} ${item.unit}`,
        category: item.category,
        checked: false,
        note: null,
        source: "inventory",
        createdAt: now(),
      });
    }
  });
  return getSnapshot(householdId);
}

export async function addShoppingItem(
  householdId: string,
  item: Omit<ShoppingListItem, "id" | "checked">,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb().insert(shoppingListItems).values({
    id: crypto.randomUUID(),
    householdId,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    checked: false,
    note: item.note ?? null,
    source: item.source,
    createdAt: now(),
  });
  return getSnapshot(householdId);
}

export async function addShoppingItems(
  householdId: string,
  items: Array<Omit<ShoppingListItem, "id" | "checked">>,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  if (items.length > 0) {
    await getDb()
      .insert(shoppingListItems)
      .values(
        items.map((item) => ({
          id: crypto.randomUUID(),
          householdId,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          checked: false,
          note: item.note ?? null,
          source: item.source,
          createdAt: now(),
        })),
      );
  }
  return getSnapshot(householdId);
}

export async function toggleShoppingItem(
  householdId: string,
  id: string,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ checked: shoppingListItems.checked })
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, id),
          eq(shoppingListItems.householdId, householdId),
        ),
      )
      .limit(1);
    if (rows[0]) {
      await tx
        .update(shoppingListItems)
        .set({ checked: !rows[0].checked })
        .where(
          and(
            eq(shoppingListItems.id, id),
            eq(shoppingListItems.householdId, householdId),
          ),
        );
    }
  });
  return getSnapshot(householdId);
}

export async function deleteShoppingItem(
  householdId: string,
  id: string,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  await getDb()
    .delete(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.id, id),
        eq(shoppingListItems.householdId, householdId),
      ),
    );
  return getSnapshot(householdId);
}

export async function addRecipe(
  householdId: string,
  recipe: Omit<Recipe, "id">,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(recipeTable).values({
      id,
      householdId,
      name: recipe.name,
      nameHu: recipe.nameHu ?? null,
      description: recipe.description,
      descriptionHu: recipe.descriptionHu ?? null,
      sourceUrl: recipe.sourceUrl ?? null,
      time: recipe.time,
      difficulty: recipe.difficulty,
      recipeType: recipe.recipeType,
      tags: JSON.stringify(recipe.tags),
      tagsHu: JSON.stringify(recipe.tagsHu ?? []),
      steps: JSON.stringify(recipe.steps),
      stepsHu: JSON.stringify(recipe.stepsHu ?? []),
      createdAt: now(),
    });
    if (recipe.ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(
        recipe.ingredients.map((ingredientName, sortOrder) => ({
          id: crypto.randomUUID(),
          householdId,
          recipeId: id,
          ingredientName,
          ingredientNameHu: recipe.ingredientsHu?.[sortOrder] ?? null,
          sortOrder,
        })),
      );
    }
  });
  return getSnapshot(householdId);
}

export async function updateRecipe(
  householdId: string,
  id: string,
  recipe: Omit<Recipe, "id">,
) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  await db.transaction(async (tx) => {
    const recipeOwner = and(
      eq(recipeTable.id, id),
      eq(recipeTable.householdId, householdId),
    );
    const existing = await tx
      .select({ id: recipeTable.id })
      .from(recipeTable)
      .where(recipeOwner)
      .limit(1);
    if (existing.length === 0) return;

    await tx
      .update(recipeTable)
      .set({
        name: recipe.name,
        nameHu: recipe.nameHu ?? null,
        description: recipe.description,
        descriptionHu: recipe.descriptionHu ?? null,
        sourceUrl: recipe.sourceUrl ?? null,
        time: recipe.time,
        difficulty: recipe.difficulty,
        recipeType: recipe.recipeType,
        tags: JSON.stringify(recipe.tags),
        tagsHu: JSON.stringify(recipe.tagsHu ?? []),
        steps: JSON.stringify(recipe.steps),
        stepsHu: JSON.stringify(recipe.stepsHu ?? []),
      })
      .where(recipeOwner);

    await tx
      .delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.recipeId, id),
          eq(recipeIngredients.householdId, householdId),
        ),
      );
    if (recipe.ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(
        recipe.ingredients.map((ingredientName, sortOrder) => ({
          id: crypto.randomUUID(),
          householdId,
          recipeId: id,
          ingredientName,
          ingredientNameHu: recipe.ingredientsHu?.[sortOrder] ?? null,
          sortOrder,
        })),
      );
    }
  });
  return getSnapshot(householdId);
}

export async function deleteRecipe(householdId: string, id: string) {
  assertHouseholdId(householdId);
  await ensureDatabase();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.recipeId, id),
          eq(recipeIngredients.householdId, householdId),
        ),
      );
    await tx
      .delete(recipeTable)
      .where(
        and(
          eq(recipeTable.id, id),
          eq(recipeTable.householdId, householdId),
        ),
      );
  });
  return getSnapshot(householdId);
}
