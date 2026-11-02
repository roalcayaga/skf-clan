CREATE TABLE `rivals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `tag` text,
  `notes` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `rivals_name_unique` ON `rivals` (`name`);

CREATE TABLE `match_rooms` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL,
  `rival_id` integer NOT NULL,
  `format` text DEFAULT 'CA' NOT NULL,
  `map_pool` text,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `quake_match_id` text,
  `score_us` integer,
  `score_them` integer,
  `report` text,
  `notes` text,
  `created_by` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`rival_id`) REFERENCES `rivals`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`quake_match_id`) REFERENCES `quake_matches`(`external_id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `match_rooms_event_unique` ON `match_rooms` (`event_id`);
CREATE INDEX `match_rooms_rival_idx` ON `match_rooms` (`rival_id`,`status`);
CREATE INDEX `match_rooms_status_idx` ON `match_rooms` (`status`);

CREATE TABLE `match_room_lineup` (
  `match_room_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `slot` text DEFAULT 'starter' NOT NULL,
  `role` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY(`match_room_id`, `user_id`),
  FOREIGN KEY (`match_room_id`) REFERENCES `match_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `match_room_lineup_user_idx` ON `match_room_lineup` (`user_id`);

CREATE TABLE `match_room_demos` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `match_room_id` integer NOT NULL,
  `name` text NOT NULL,
  `r2_key` text NOT NULL,
  `bytes` integer DEFAULT 0 NOT NULL,
  `notes` text,
  `uploaded_by` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`match_room_id`) REFERENCES `match_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `match_room_demos_room_idx` ON `match_room_demos` (`match_room_id`);

CREATE TABLE `training_goals` (
  `user_id` integer PRIMARY KEY NOT NULL,
  `focus` text,
  `target` text,
  `notes` text,
  `baseline` text,
  `started_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_by` integer,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
