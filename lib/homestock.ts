export type Category = "Fridge" | "Freezer" | "Pantry" | "Household" | "Bathroom" | "Cleaning";
export type ExpiryStatus = "expired" | "urgent" | "warning" | "okay" | "none";

export type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  location: string;
  quantity: number;
  unit: string;
  expiry?: string;
  purchaseDate?: string;
  notes?: string;
  basic: boolean;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  quantity: string;
  category: Category;
  checked: boolean;
  note?: string;
  source: "manual" | "inventory" | "recipe";
};

export type Recipe = {
  id: string;
  name: string;
  nameHu?: string;
  description: string;
  descriptionHu?: string;
  ingredients: string[];
  ingredientsHu?: string[];
  time: string;
  difficulty: "Easy" | "Medium";
  tags: string[];
  tagsHu?: string[];
  steps: string[];
  stepsHu?: string[];
};

export const categories: Category[] = ["Fridge", "Freezer", "Pantry", "Household", "Bathroom", "Cleaning"];

export function getExpiryStatus(expiry?: string, reference = new Date()): ExpiryStatus {
  if (!expiry) return "none";
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  const target = new Date(`${expiry}T00:00:00`).getTime();
  const days = Math.round((target - today) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 1) return "urgent";
  if (days <= 5) return "warning";
  return "okay";
}

export function daysUntil(expiry?: string, reference = new Date()): number | null {
  if (!expiry) return null;
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return Math.round((new Date(`${expiry}T00:00:00`).getTime() - today) / 86_400_000);
}

export function expiryLabel(expiry?: string, reference = new Date()): string {
  const days = daysUntil(expiry, reference);
  if (days === null) return "No expiry set";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days}d`;
}

export function formatDate(date?: string): string {
  if (!date) return "No expiry";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

export function matchingIngredients(recipe: Recipe, inventory: InventoryItem[]): string[] {
  const available = inventory.filter((item) => item.quantity > 0).map((item) => item.name.toLowerCase());
  return recipe.ingredients.filter((ingredient) => available.some((item) => item.includes(ingredient.toLowerCase()) || ingredient.toLowerCase().includes(item)));
}

export function missingIngredients(recipe: Recipe, inventory: InventoryItem[]): string[] {
  return recipe.ingredients.filter((ingredient) => !matchingIngredients(recipe, inventory).includes(ingredient));
}
