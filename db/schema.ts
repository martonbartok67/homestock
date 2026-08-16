import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
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
    categoryIndex: index("inventory_items_category_idx").on(table.category),
    expiryIndex: index("inventory_items_expiry_idx").on(table.expiry),
  }),
);

export const shoppingListItems = sqliteTable(
  "shopping_list_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    quantity: text("quantity").notNull().default("1"),
    category: text("category").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    checkedIndex: index("shopping_list_items_checked_idx").on(table.checked),
  }),
);

export const recipes = sqliteTable("recipes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameHu: text("name_hu"),
  description: text("description").notNull(),
  descriptionHu: text("description_hu"),
  time: text("time").notNull(),
  difficulty: text("difficulty").notNull(),
  tags: text("tags").notNull().default("[]"),
  tagsHu: text("tags_hu").notNull().default("[]"),
  steps: text("steps").notNull().default("[]"),
  stepsHu: text("steps_hu").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id").notNull(),
    ingredientName: text("ingredient_name").notNull(),
    ingredientNameHu: text("ingredient_name_hu"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    recipeIndex: index("recipe_ingredients_recipe_idx").on(table.recipeId),
  }),
);

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  workspaceName: text("workspace_name").notNull().default("Emma & Marci's household"),
  createdAt: text("created_at").notNull(),
});
