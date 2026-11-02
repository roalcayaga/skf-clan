CREATE TABLE `scrim_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `clan_name` text NOT NULL,
  `contact_name` text NOT NULL,
  `contact_discord` text NOT NULL,
  `contact_email` text,
  `mode` text DEFAULT 'CA' NOT NULL,
  `team_size` text DEFAULT '4v4' NOT NULL,
  `preferred_at` integer NOT NULL,
  `alternate_at` integer,
  `timezone` text DEFAULT 'UTC' NOT NULL,
  `notes` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `event_id` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `scrim_requests_status_idx` ON `scrim_requests` (`status`,`created_at`);
CREATE INDEX `scrim_requests_event_idx` ON `scrim_requests` (`event_id`);
