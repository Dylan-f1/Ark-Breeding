CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notices_user` ON `notices` (`user_id`);--> statement-breakpoint
ALTER TABLE `tribes` ADD `invite_code` text;--> statement-breakpoint
ALTER TABLE `tribes` ADD `invite_expires_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tribes_invite_code_unique` ON `tribes` (`invite_code`);--> statement-breakpoint
ALTER TABLE `users` ADD `current_tribe_id` text REFERENCES tribes(id);