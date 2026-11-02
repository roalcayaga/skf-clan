CREATE TABLE `history_milestones` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sort_year` integer NOT NULL,
  `date_label` text NOT NULL,
  `category` text,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `image_url` text,
  `is_published` integer DEFAULT true NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_by` integer,
  `updated_by` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `history_milestones_order_idx` ON `history_milestones` (`sort_year`, `sort_order`, `id`);
CREATE INDEX `history_milestones_published_idx` ON `history_milestones` (`is_published`, `sort_year`);

INSERT INTO history_milestones
  (sort_year, date_label, category, title, body, is_published, sort_order)
VALUES
  (1997, '1997–1998', 'ORIGEN', 'Fundación de Shaolin Kung Fu',
   'SkF nace en los primeros años de Quake. Comienza la historia del Dragón y de la primera dinastía Shaolin.',
   true, 10),
  (1999, '1999–2002', 'DINASTÍA', 'La edad dorada',
   'El clan vive su etapa de mayor actividad y protagonismo competitivo, consolidando la generación que dio forma a la leyenda de SkF.',
   true, 20),
  (2026, '2026', 'REGRESO', 'El regreso del Dragón',
   'Shaolin Kung Fu vuelve a levantarse como clan activo, reconstruyendo su comunidad, su servidor y un nuevo Templo para la generación actual.',
   true, 30);
