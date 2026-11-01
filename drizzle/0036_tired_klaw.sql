CREATE TABLE `legacy_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`profile_image_url` text,
	`rank_id` integer,
	`years_active` text,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`rank_id`) REFERENCES `ranks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `legacy_members_rank_idx` ON `legacy_members` (`rank_id`);--> statement-breakpoint
CREATE INDEX `legacy_members_sort_idx` ON `legacy_members` (`sort_order`);

CREATE TABLE `legacy_member_medals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_member_id` integer NOT NULL,
	`medal_id` integer NOT NULL,
	`citation` text,
	`awarded_by` integer,
	`awarded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`legacy_member_id`) REFERENCES `legacy_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`medal_id`) REFERENCES `medals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`awarded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `legacy_member_medals_member_idx` ON `legacy_member_medals` (`legacy_member_id`);--> statement-breakpoint
CREATE INDEX `legacy_member_medals_medal_idx` ON `legacy_member_medals` (`medal_id`);--> statement-breakpoint
