ALTER TABLE `inventory_items` ADD `household_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `shopping_list_items` ADD `household_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` ADD `household_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD `household_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `household_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `inventory_items_household_idx` ON `inventory_items` (`household_id`);
--> statement-breakpoint
CREATE INDEX `inventory_items_household_category_idx` ON `inventory_items` (`household_id`,`category`);
--> statement-breakpoint
CREATE INDEX `inventory_items_household_expiry_idx` ON `inventory_items` (`household_id`,`expiry`);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_household_idx` ON `shopping_list_items` (`household_id`);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_household_checked_idx` ON `shopping_list_items` (`household_id`,`checked`);
--> statement-breakpoint
CREATE INDEX `recipes_household_idx` ON `recipes` (`household_id`);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_household_idx` ON `recipe_ingredients` (`household_id`);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_household_recipe_idx` ON `recipe_ingredients` (`household_id`,`recipe_id`);
--> statement-breakpoint
CREATE INDEX `user_preferences_household_idx` ON `user_preferences` (`household_id`);
