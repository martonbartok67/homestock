CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`location` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text NOT NULL,
	`expiry` text,
	`purchase_date` text,
	`notes` text,
	`basic` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_items_category_idx` ON `inventory_items` (`category`);--> statement-breakpoint
CREATE INDEX `inventory_items_expiry_idx` ON `inventory_items` (`expiry`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`time` text NOT NULL,
	`difficulty` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` text DEFAULT '1' NOT NULL,
	`category` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_checked_idx` ON `shopping_list_items` (`checked`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_name` text DEFAULT 'Marton''s home' NOT NULL,
	`created_at` text NOT NULL
);
