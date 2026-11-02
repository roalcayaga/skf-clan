ALTER TABLE `legacy_members` ADD `current_nick` text;
ALTER TABLE `legacy_members` ADD `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE set null;
CREATE INDEX `legacy_members_owner_idx` ON `legacy_members` (`owner_user_id`);

-- Canonical Viejas Dinastías roster. Insert only if the historical identity
-- does not already exist, preserving any manually curated images/medals.
INSERT INTO legacy_members (name, note, sort_order)
SELECT 'BuDaH', 'Fundador', 10
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('BuDaH'));

INSERT INTO legacy_members (name, note, sort_order, current_nick)
SELECT 'VaSSagO', 'El eterno capitán', 20, 'VaSSagO'
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('VaSSagO'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Obiwan', 30
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Obiwan'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Ganyaman', 40
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Ganyaman'));

INSERT INTO legacy_members (name, sort_order, current_nick)
SELECT 'Ar3Z', 50, 'alk4pone'
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Ar3Z'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'CassiuS', 60
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('CassiuS'));

INSERT INTO legacy_members (name, sort_order)
SELECT '3com', 70
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('3com'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Gintonic', 80
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Gintonic'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Kane', 90
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Kane'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Shivano', 100
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Shivano'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Maniaco', 110
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Maniaco'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Malaclase', 120
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Malaclase'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Pipe', 130
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Pipe'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Darkspy', 140
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Darkspy'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Elgoma', 150
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Elgoma'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'Squall', 160
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('Squall'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'DeviL', 170
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('DeviL'));

INSERT INTO legacy_members (name, sort_order, current_nick)
SELECT 'AS3SIN0', 180, 'Hakai'
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('AS3SIN0'));

INSERT INTO legacy_members (name, sort_order)
SELECT 'DKdente', 190
WHERE NOT EXISTS (SELECT 1 FROM legacy_members WHERE lower(name) = lower('DKdente'));

-- If these rows already existed, still apply the canonical current identities/roles.
UPDATE legacy_members
SET note = CASE
  WHEN note IS NULL OR trim(note) = '' THEN 'Fundador'
  WHEN lower(note) LIKE '%fundador%' THEN note
  ELSE 'Fundador · ' || note
END
WHERE lower(name) = lower('BuDaH');
UPDATE legacy_members
SET note = CASE
      WHEN note IS NULL OR trim(note) = '' THEN 'El eterno capitán'
      WHEN lower(note) LIKE '%eterno capitán%' OR lower(note) LIKE '%eterno capitan%' THEN note
      ELSE 'El eterno capitán · ' || note
    END,
    current_nick = 'VaSSagO'
WHERE lower(name) = lower('VaSSagO');
UPDATE legacy_members SET current_nick = 'alk4pone' WHERE lower(name) = lower('Ar3Z');
UPDATE legacy_members SET current_nick = 'Hakai' WHERE lower(name) = lower('AS3SIN0');

-- Link historical identities immediately when the current account already exists.
UPDATE legacy_members
SET owner_user_id = (
  SELECT users.id
  FROM users
  WHERE lower(users.display_name) = lower(legacy_members.current_nick)
     OR lower(users.global_name) = lower(legacy_members.current_nick)
     OR lower(users.username) = lower(legacy_members.current_nick)
  LIMIT 1
)
WHERE current_nick IS NOT NULL
  AND owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE lower(users.display_name) = lower(legacy_members.current_nick)
       OR lower(users.global_name) = lower(legacy_members.current_nick)
       OR lower(users.username) = lower(legacy_members.current_nick)
  );
