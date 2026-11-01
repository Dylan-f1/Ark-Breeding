CREATE TABLE `timers` (
	`id` text PRIMARY KEY NOT NULL,
	`tribe_id` text NOT NULL,
	`created_by` text,
	`species_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`cuddle_interval` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tribe_id`) REFERENCES `tribes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `timers_tribe_ends` ON `timers` (`tribe_id`,`ends_at`);