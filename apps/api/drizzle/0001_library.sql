CREATE TABLE `creatures` (
	`id` text PRIMARY KEY NOT NULL,
	`tribe_id` text NOT NULL,
	`created_by` text,
	`species_id` text NOT NULL,
	`name` text NOT NULL,
	`sex` text NOT NULL,
	`status` text NOT NULL,
	`kind` text NOT NULL,
	`level` integer NOT NULL,
	`levels_wild` text NOT NULL,
	`levels_mutated` text NOT NULL,
	`levels_dom` text NOT NULL,
	`stat_values` text NOT NULL,
	`taming_effectiveness` real,
	`imprinting_bonus` real NOT NULL,
	`mutations_mother` integer NOT NULL,
	`mutations_father` integer NOT NULL,
	`colors` text NOT NULL,
	`neutered` integer NOT NULL,
	`ark_id` text,
	`mother_ark_id` text,
	`father_ark_id` text,
	`mother_name` text,
	`father_name` text,
	`extraction_unique` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tribe_id`) REFERENCES `tribes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `creatures_tribe_species` ON `creatures` (`tribe_id`,`species_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `creatures_tribe_ark_id` ON `creatures` (`tribe_id`,`ark_id`) WHERE ark_id is not null;--> statement-breakpoint
CREATE TABLE `tribe_members` (
	`tribe_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`tribe_id`, `user_id`),
	FOREIGN KEY (`tribe_id`) REFERENCES `tribes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tribe_members_user` ON `tribe_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `tribes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text,
	`server_multipliers` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
