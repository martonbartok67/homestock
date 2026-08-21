import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const householdMembers = sqliteTable(
  "household_members",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    email: text("email").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    householdIndex: index("household_members_household_idx").on(table.householdId),
    emailIndex: uniqueIndex("household_members_email_unique").on(table.email),
  }),
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit").notNull(),
    expiry: text("expiry"),
    purchaseDate: text("purchase_date"),
    notes: text("notes"),
    basic: integer("basic", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    householdIndex: index("inventory_items_household_idx").on(table.householdId),
    categoryIndex: index("inventory_items_household_category_idx").on(table.householdId, table.category),
    expiryIndex: index("inventory_items_household_expiry_idx").on(table.householdId, table.expiry),
  }),
);

export const shoppingListItems = sqliteTable(
  "shopping_list_items",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    name: text("name").notNull(),
    quantity: text("quantity").notNull().default("1"),
    category: text("category").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    householdIndex: index("shopping_list_items_household_idx").on(table.householdId),
    checkedIndex: index("shopping_list_items_household_checked_idx").on(table.householdId, table.checked),
  }),
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    name: text("name").notNull(),
    nameHu: text("name_hu"),
    description: text("description").notNull(),
    descriptionHu: text("description_hu"),
    sourceUrl: text("source_url"),
    time: text("time").notNull(),
    difficulty: text("difficulty").notNull(),
    recipeType: text("recipe_type").notNull().default("savory"),
    tags: text("tags").notNull().default("[]"),
    tagsHu: text("tags_hu").notNull().default("[]"),
    steps: text("steps").notNull().default("[]"),
    stepsHu: text("steps_hu").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    householdIndex: index("recipes_household_idx").on(table.householdId),
  }),
);

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    ingredientName: text("ingredient_name").notNull(),
    ingredientNameHu: text("ingredient_name_hu"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    householdIndex: index("recipe_ingredients_household_idx").on(table.householdId),
    recipeIndex: index("recipe_ingredients_household_recipe_idx").on(table.householdId, table.recipeId),
  }),
);

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    workspaceName: text("workspace_name").notNull().default("Household"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    householdIndex: index("user_preferences_household_idx").on(table.householdId),
  }),
);
