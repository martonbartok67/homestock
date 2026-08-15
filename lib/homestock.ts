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
  description: string;
  ingredients: string[];
  time: string;
  difficulty: "Easy" | "Medium";
  tags: string[];
  steps: string[];
};

export const categories: Category[] = ["Fridge", "Freezer", "Pantry", "Household", "Bathroom", "Cleaning"];

export const seedInventory: InventoryItem[] = [
  { id: "milk", name: "Whole milk", category: "Fridge", location: "Top shelf", quantity: 1, unit: "liter", expiry: "2026-08-16", purchaseDate: "2026-08-13", basic: true },
  { id: "eggs", name: "Eggs", category: "Fridge", location: "Door shelf", quantity: 6, unit: "pieces", expiry: "2026-08-18", purchaseDate: "2026-08-11", basic: true },
  { id: "spinach", name: "Baby spinach", category: "Fridge", location: "Crisper drawer", quantity: 1, unit: "bag", expiry: "2026-08-16", purchaseDate: "2026-08-14", notes: "Use for breakfast or pasta", basic: false },
  { id: "yoghurt", name: "Greek yoghurt", category: "Fridge", location: "Top shelf", quantity: 2, unit: "cups", expiry: "2026-08-19", purchaseDate: "2026-08-12", basic: true },
  { id: "tomatoes", name: "Cherry tomatoes", category: "Fridge", location: "Crisper drawer", quantity: 1, unit: "punnet", expiry: "2026-08-17", purchaseDate: "2026-08-13", basic: false },
  { id: "bread", name: "Sourdough bread", category: "Pantry", location: "Bread box", quantity: 1, unit: "loaf", expiry: "2026-08-15", purchaseDate: "2026-08-12", basic: true },
  { id: "pasta", name: "Penne pasta", category: "Pantry", location: "Dry goods shelf", quantity: 2, unit: "packs", basic: true },
  { id: "chickpeas", name: "Chickpeas", category: "Pantry", location: "Dry goods shelf", quantity: 2, unit: "cans", expiry: "2027-02-01", basic: false },
  { id: "peas", name: "Frozen peas", category: "Freezer", location: "Left drawer", quantity: 1, unit: "bag", expiry: "2027-01-12", basic: true },
  { id: "dishwasher", name: "Dishwasher tablets", category: "Cleaning", location: "Utility cupboard", quantity: 7, unit: "pieces", basic: true },
  { id: "toilet-paper", name: "Toilet paper", category: "Bathroom", location: "Hall cupboard", quantity: 4, unit: "rolls", basic: true },
  { id: "trash-bags", name: "Bin bags", category: "Household", location: "Utility cupboard", quantity: 1, unit: "pack", basic: true },
];

export const seedShopping: ShoppingListItem[] = [
  { id: "shopping-onions", name: "Red onions", quantity: "3 pieces", category: "Pantry", checked: false, source: "manual" },
  { id: "shopping-chicken", name: "Chicken thighs", quantity: "400 g", category: "Fridge", checked: false, note: "For the tray bake", source: "recipe" },
  { id: "shopping-cleaner", name: "All-purpose cleaner", quantity: "1 bottle", category: "Cleaning", checked: true, source: "manual" },
];

export const recipes: Recipe[] = [
  {
    id: "green-frittata",
    name: "Spinach & tomato frittata",
    description: "A quick skillet dinner that makes your most time-sensitive ingredients useful.",
    ingredients: ["Eggs", "Baby spinach", "Cherry tomatoes", "Whole milk"],
    time: "20 min",
    difficulty: "Easy",
    tags: ["Use soon", "Vegetarian"],
    steps: ["Wilt the spinach in an oven-safe pan.", "Whisk eggs with milk and fold in tomatoes.", "Pour into the pan and cook until just set.", "Finish under the grill and serve warm."],
  },
  {
    id: "creamy-pasta",
    name: "Creamy spinach pasta",
    description: "Comforting pantry pasta with a bright, creamy finish.",
    ingredients: ["Penne pasta", "Baby spinach", "Whole milk", "Cherry tomatoes"],
    time: "25 min",
    difficulty: "Easy",
    tags: ["Use soon", "Pantry hero"],
    steps: ["Cook the pasta until al dente.", "Sauté spinach and tomatoes until softened.", "Add milk and a splash of pasta water.", "Toss through the pasta and season."],
  },
  {
    id: "chickpea-toast",
    name: "Smoky chickpea toast",
    description: "A filling pantry lunch built around ingredients that keep well.",
    ingredients: ["Chickpeas", "Sourdough bread", "Cherry tomatoes"],
    time: "15 min",
    difficulty: "Easy",
    tags: ["Minimal shopping", "Vegetarian"],
    steps: ["Toast the sourdough until crisp.", "Warm chickpeas with paprika and olive oil.", "Top the toast with chickpeas and tomatoes.", "Finish with yoghurt if you like."],
  },
];

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
