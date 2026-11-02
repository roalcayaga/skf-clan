-- SkF Performance OS: stable Quake identity, structured match history,
-- public QuakeClub snapshots, and durable Pulse events.

CREATE TABLE `quake_player_links` (
  `user_id` integer PRIMARY KEY NOT NULL,
  `steam_id` text NOT NULL,
  `quake_name` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `quake_player_links_steam_idx` ON `quake_player_links` (`steam_id`);

CREATE TABLE `quake_matches` (
  `external_id` text PRIMARY KEY NOT NULL,
  `match_id` text,
  `scope` text NOT NULL,
  `server_name` text NOT NULL,
  `map` text NOT NULL,
  `game_type` text NOT NULL,
  `played_at` integer NOT NULL,
  `duration` integer DEFAULT 0 NOT NULL,
  `team1_score` integer DEFAULT 0 NOT NULL,
  `team2_score` integer DEFAULT 0 NOT NULL,
  `rated` integer DEFAULT true NOT NULL,
  `aborted` integer DEFAULT false NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `quake_matches_scope_played_idx` ON `quake_matches` (`scope`,`played_at`);
CREATE INDEX `quake_matches_mode_played_idx` ON `quake_matches` (`game_type`,`played_at`);

CREATE TABLE `quake_match_players` (
  `external_match_id` text NOT NULL,
  `steam_id` text NOT NULL,
  `name` text NOT NULL,
  `team` text,
  `clan` text,
  `kills` integer DEFAULT 0 NOT NULL,
  `deaths` integer DEFAULT 0 NOT NULL,
  `score` integer DEFAULT 0 NOT NULL,
  `damage_dealt` integer DEFAULT 0 NOT NULL,
  `damage_taken` integer DEFAULT 0 NOT NULL,
  `rounds` integer DEFAULT 0 NOT NULL,
  `rounds_won` integer DEFAULT 0 NOT NULL,
  `performance` real,
  `elo_change` real,
  `weapons` text,
  `medals` text,
  PRIMARY KEY(`external_match_id`, `steam_id`),
  FOREIGN KEY (`external_match_id`) REFERENCES `quake_matches`(`external_id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `quake_match_players_steam_idx` ON `quake_match_players` (`steam_id`,`external_match_id`);

CREATE TABLE `quake_public_current` (
  `user_id` integer NOT NULL,
  `game_type` text NOT NULL,
  `steam_id` text NOT NULL,
  `username` text NOT NULL,
  `rating` real,
  `deviation` real,
  `total_games` integer DEFAULT 0 NOT NULL,
  `wins` integer DEFAULT 0 NOT NULL,
  `losses` integer DEFAULT 0 NOT NULL,
  `kills` integer,
  `deaths` integer,
  `kd` real,
  `raw` text,
  `captured_at` integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY(`user_id`, `game_type`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `quake_public_current_rating_idx` ON `quake_public_current` (`game_type`,`rating`);

CREATE TABLE `quake_public_daily` (
  `user_id` integer NOT NULL,
  `day` text NOT NULL,
  `game_type` text NOT NULL,
  `steam_id` text NOT NULL,
  `username` text NOT NULL,
  `rating` real,
  `deviation` real,
  `total_games` integer DEFAULT 0 NOT NULL,
  `wins` integer DEFAULT 0 NOT NULL,
  `losses` integer DEFAULT 0 NOT NULL,
  `kills` integer,
  `deaths` integer,
  `kd` real,
  `raw` text,
  `captured_at` integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY(`user_id`, `day`, `game_type`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `quake_public_daily_user_idx` ON `quake_public_daily` (`user_id`,`game_type`,`day`);

CREATE TABLE `pulse_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `unique_key` text NOT NULL,
  `kind` text NOT NULL,
  `user_id` integer,
  `title` text NOT NULL,
  `body` text,
  `metric` text,
  `value` real,
  `delta` real,
  `occurred_at` integer NOT NULL,
  `share_path` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `pulse_events_unique_idx` ON `pulse_events` (`unique_key`);
CREATE INDEX `pulse_events_time_idx` ON `pulse_events` (`occurred_at`);
CREATE INDEX `pulse_events_user_time_idx` ON `pulse_events` (`user_id`,`occurred_at`);
