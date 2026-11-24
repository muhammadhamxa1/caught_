CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`socials` text DEFAULT '{}' NOT NULL,
	`next_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_handle_unique` ON `accounts` (`handle`);--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`product_id` text NOT NULL,
	`video_id` text,
	`destination` text NOT NULL,
	`entry` text DEFAULT 'direct' NOT NULL,
	`visitor_id` text,
	`device` text,
	`is_bot` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clicks_account_time_idx` ON `clicks` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `clicks_product_idx` ON `clicks` (`product_id`);--> statement-breakpoint
CREATE TABLE `commission_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`destination` text NOT NULL,
	`rate_bps` integer NOT NULL,
	`min_monthly_units` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rules_product_dest_tier_uq` ON `commission_rules` (`product_id`,`destination`,`min_monthly_units`);--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rate_bps` integer NOT NULL,
	`tier_units` integer DEFAULT 0 NOT NULL,
	`gross_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`clears_at` integer,
	`cleared_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commissions_sale_id_unique` ON `commissions` (`sale_id`);--> statement-breakpoint
CREATE INDEX `commissions_status_clears_idx` ON `commissions` (`status`,`clears_at`);--> statement-breakpoint
CREATE INDEX `commissions_user_idx` ON `commissions` (`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`product_id` text,
	`video_id` text,
	`entry` text,
	`query` text,
	`result_count` integer,
	`visitor_id` text,
	`device` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_account_type_time_idx` ON `events` (`account_id`,`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `events_product_idx` ON `events` (`product_id`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`txn_id` text NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`bucket` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`kind` text NOT NULL,
	`sale_id` text,
	`payout_id` text,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_user_bucket_idx` ON `ledger` (`user_id`,`bucket`);--> statement-breakpoint
CREATE INDEX `ledger_txn_idx` ON `ledger` (`txn_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`signup_id` text,
	`channel` text NOT NULL,
	`to` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payout_methods` (
	`user_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method_type` text NOT NULL,
	`method_label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`note` text,
	`provider_ref` text,
	`requested_at` integer NOT NULL,
	`approved_at` integer,
	`paid_at` integer,
	`closed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_ref_unique` ON `payouts` (`ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_idempotency_key_unique` ON `payouts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `payouts_user_idx` ON `payouts` (`user_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`image_url` text,
	`category` text DEFAULT 'other' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`sale_price_cents` integer,
	`tiktok_url` text NOT NULL,
	`amazon_url` text,
	`brand_url` text,
	`brand_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`backup_product_id` text,
	`catalog_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_account_number_uq` ON `products` (`account_id`,`number`);--> statement-breakpoint
CREATE INDEX `products_account_status_idx` ON `products` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`click_id` text,
	`destination` text NOT NULL,
	`network_order_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`base_cents` integer NOT NULL,
	`refunded_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`placed_at` integer NOT NULL,
	`shipped_at` integer,
	`delivered_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_receipt_id_unique` ON `sales` (`receipt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_network_order_uq` ON `sales` (`destination`,`network_order_id`);--> statement-breakpoint
CREATE INDEX `sales_account_time_idx` ON `sales` (`account_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `sales_product_idx` ON `sales` (`product_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `signups` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`product_id` text NOT NULL,
	`channel` text NOT NULL,
	`contact` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signups_product_contact_uq` ON `signups` (`product_id`,`contact`);--> statement-breakpoint
CREATE INDEX `signups_account_status_idx` ON `signups` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `video_products` (
	`video_id` text NOT NULL,
	`product_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`video_id`, `product_id`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_products_product_idx` ON `video_products` (`product_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`caption` text DEFAULT '' NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`basket` text DEFAULT 'live' NOT NULL,
	`posted_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `videos_account_idx` ON `videos` (`account_id`,`posted_at`);--> statement-breakpoint
CREATE TABLE `webhook_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`event_id` text,
	`type` text,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_source_event_idx` ON `webhook_log` (`source`,`event_id`);