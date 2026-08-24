import type {
  Category,
  InventoryItem,
  Recipe,
  ShoppingListItem,
} from "../homestock";

type InputRecord = Record<string, unknown>;

const categories = new Set<Category>(["Fridge", "Freezer", "Pantry", "Household", "Bathroom", "Cleaning"]);
const shoppingSources = new Set<ShoppingListItem["source"]>(["manual", "inventory", "recipe"]);
const difficulties = new Set<Recipe["difficulty"]>(["Easy", "Medium", "Hard"]);
const recipeTypes = new Set<Recipe["recipeType"]>(["savory", "sweet"]);

export class RequestValidationError extends Error {}

function record(value: unknown, label: string): InputRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestValidationError(`${label} is missing.`);
  }
  return value as InputRecord;
}

function text(value: unknown, label: string, maxLength: number, fallback?: string) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new RequestValidationError(`${label} is required.`);
  }
  if (typeof value !== "string") throw new RequestValidationError(`${label} must be text.`);
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    if (fallback !== undefined) return fallback;
    throw new RequestValidationError(`${label} is required.`);
  }
  if (cleaned.length > maxLength) throw new RequestValidationError(`${label} is too long.`);
  return cleaned;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return text(value, label, maxLength);
}

function stringList(value: unknown, label: string, options: { maxItems: number; maxLength: number; required?: boolean }) {
  if (value === undefined || value === null) {
    if (options.required) throw new RequestValidationError(`${label} are required.`);
    return [];
  }
  if (!Array.isArray(value)) throw new RequestValidationError(`${label} must be a list.`);
  if (value.length > options.maxItems) throw new RequestValidationError(`${label} has too many entries.`);
  const cleaned = value.map((entry, index) => text(entry, `${label} ${index + 1}`, options.maxLength));
  if (options.required && cleaned.length === 0) throw new RequestValidationError(`${label} are required.`);
  return cleaned;
}

function category(value: unknown): Category {
  if (typeof value !== "string" || !categories.has(value as Category)) {
    throw new RequestValidationError("Choose a valid category.");
  }
  return value as Category;
}

function date(value: unknown, label: string) {
  const cleaned = optionalText(value, label, 10);
  if (!cleaned) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(new Date(`${cleaned}T00:00:00Z`).getTime())) {
    throw new RequestValidationError(`${label} must be a valid date.`);
  }
  return cleaned;
}

function publicUrl(value: unknown) {
  const cleaned = optionalText(value, "Source URL", 2_000);
  if (!cleaned) return undefined;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new RequestValidationError("Source URL must be a full http or https link.");
  }
}

function id(value: unknown) {
  return text(value, "Item ID", 100);
}

function inventoryItem(value: unknown): Omit<InventoryItem, "id"> {
  const item = record(value, "Inventory item");
  if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000) {
    throw new RequestValidationError("Quantity must be a whole number of at least 1.");
  }
  if (typeof item.basic !== "boolean") throw new RequestValidationError("Basic-item setting is invalid.");
  return {
    name: text(item.name, "Item name", 160),
    category: category(item.category),
    location: text(item.location, "Storage place", 160, "Not set"),
    quantity: item.quantity,
    unit: text(item.unit, "Unit", 40),
    expiry: date(item.expiry, "Expiry date"),
    purchaseDate: date(item.purchaseDate, "Purchase date"),
    notes: optionalText(item.notes, "Notes", 1_000),
    basic: item.basic,
  };
}

function shoppingItem(value: unknown): Omit<ShoppingListItem, "id" | "checked"> {
  const item = record(value, "Shopping item");
  if (typeof item.source !== "string" || !shoppingSources.has(item.source as ShoppingListItem["source"])) {
    throw new RequestValidationError("Shopping source is invalid.");
  }
  return {
    name: text(item.name, "Shopping item name", 160),
    quantity: text(item.quantity, "Shopping quantity", 80, "1"),
    category: category(item.category),
    note: optionalText(item.note, "Shopping note", 500),
    source: item.source as ShoppingListItem["source"],
  };
}

function recipe(value: unknown): Omit<Recipe, "id"> {
  const input = record(value, "Recipe");
  if (typeof input.difficulty !== "string" || !difficulties.has(input.difficulty as Recipe["difficulty"])) {
    throw new RequestValidationError("Choose a valid recipe difficulty.");
  }
  if (typeof input.recipeType !== "string" || !recipeTypes.has(input.recipeType as Recipe["recipeType"])) {
    throw new RequestValidationError("Recipe type must be savory or sweet.");
  }
  return {
    name: text(input.name, "Recipe name", 200),
    nameHu: optionalText(input.nameHu, "Hungarian recipe name", 200),
    description: text(input.description, "Recipe description", 2_000, "Home recipe"),
    descriptionHu: optionalText(input.descriptionHu, "Hungarian description", 2_000),
    sourceUrl: publicUrl(input.sourceUrl),
    thumbUrl: typeof input.thumbUrl === "string" ? input.thumbUrl.slice(0, 500) : undefined,
    ingredients: stringList(input.ingredients, "Ingredients", { maxItems: 80, maxLength: 300, required: true }),
    ingredientsHu: stringList(input.ingredientsHu, "Hungarian ingredients", { maxItems: 80, maxLength: 300 }),
    time: text(input.time, "Recipe time", 40, "30 min"),
    difficulty: input.difficulty as Recipe["difficulty"],
    recipeType: input.recipeType as Recipe["recipeType"],
    tags: stringList(input.tags, "Tags", { maxItems: 8, maxLength: 60 }),
    tagsHu: stringList(input.tagsHu, "Hungarian tags", { maxItems: 8, maxLength: 60 }),
    steps: stringList(input.steps, "Recipe steps", { maxItems: 80, maxLength: 1_500, required: true }),
    stepsHu: stringList(input.stepsHu, "Hungarian recipe steps", { maxItems: 80, maxLength: 1_500 }),
  };
}

function inventoryUpdate(value: unknown): Omit<InventoryItem, "id"> {
  return inventoryItem(value);
}

export type HomeStockAction =
  | { action: "addInventory"; item: Omit<InventoryItem, "id"> }
  | { action: "updateInventory"; id: string; item: Omit<InventoryItem, "id"> }
  | { action: "deleteInventory" | "finishInventory" | "toggleShopping" | "deleteShopping" | "deleteRecipe"; id: string }
  | { action: "updateInventoryExpiry"; id: string; expiry?: string }
  | { action: "addShopping"; item: Omit<ShoppingListItem, "id" | "checked"> }
  | { action: "addShoppingBatch"; items: Array<Omit<ShoppingListItem, "id" | "checked">> }
  | { action: "updateInventory"; id: string; item: Omit<InventoryItem, "id"> }
  | { action: "addRecipe"; recipe: Omit<Recipe, "id"> }
  | { action: "updateRecipe"; id: string; recipe: Omit<Recipe, "id"> };

export function parseHomeStockAction(value: unknown): HomeStockAction {
  const body = record(value, "Request");
  switch (body.action) {
    case "addInventory": return { action: body.action, item: inventoryItem(body.item) };
    case "updateInventory": return { action: body.action, id: id(body.id), item: inventoryUpdate(body.item) };
    case "deleteInventory":
    case "finishInventory":
    case "toggleShopping":
    case "deleteShopping":
    case "deleteRecipe": return { action: body.action, id: id(body.id) };
    case "updateInventoryExpiry":
      return { action: body.action, id: id(body.id), expiry: date(body.expiry, "Expiry date") };
    case "addShopping": return { action: body.action, item: shoppingItem(body.item) };
    case "addShoppingBatch": {
      if (!Array.isArray(body.items) || body.items.length > 80) throw new RequestValidationError("Shopping list batch is invalid.");
      return { action: body.action, items: body.items.map(shoppingItem) };
    }
    case "updateInventory": return { action: body.action, id: id(body.id), item: inventoryItem(body.item) };
    case "addRecipe": return { action: body.action, recipe: recipe(body.recipe) };
    case "updateRecipe": return { action: body.action, id: id(body.id), recipe: recipe(body.recipe) };
    default: throw new RequestValidationError("Unknown HomeStock action.");
  }
}
