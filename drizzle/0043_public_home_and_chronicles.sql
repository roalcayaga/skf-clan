-- Establish a real public layer for skfclan.com.
-- Home is public while module-level audience rules continue to hide member-only
-- modules. Crónicas becomes public; Roster, Events and Leveling keep their
-- existing audience values.

UPDATE page_layouts
SET is_public = 1,
    updated_at = unixepoch()
WHERE slug = 'home';

INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES (
  'page_access',
  json('{"news":"members","roster":"members","events":"members","leveling":"members"}'),
  unixepoch()
);

UPDATE settings
SET value = json_set(
      CASE WHEN json_valid(value) THEN value ELSE json('{}') END,
      '$.news',
      'public'
    ),
    updated_at = unixepoch()
WHERE key = 'page_access';
