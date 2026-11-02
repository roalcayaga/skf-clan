-- Consolidate the duplicate BuDaH legacy identity created by the canonical
-- Viejas Dinastías seed. Keep the original rich record (1997–2002 / Shifu)
-- and preserve any awards that may have been attached to the duplicate.

INSERT INTO legacy_member_medals
  (legacy_member_id, medal_id, citation, awarded_by, awarded_at)
SELECT
  keeper.id,
  duplicate_medal.medal_id,
  duplicate_medal.citation,
  duplicate_medal.awarded_by,
  duplicate_medal.awarded_at
FROM legacy_members keeper
JOIN legacy_members duplicate
  ON lower(duplicate.name) = lower('BuDaH')
 AND duplicate.id <> keeper.id
JOIN legacy_member_medals duplicate_medal
  ON duplicate_medal.legacy_member_id = duplicate.id
WHERE lower(keeper.name) = lower('BuDaH / WuTangClan')
  AND NOT EXISTS (
    SELECT 1
    FROM legacy_member_medals existing
    WHERE existing.legacy_member_id = keeper.id
      AND existing.medal_id = duplicate_medal.medal_id
  );

DELETE FROM legacy_member_medals
WHERE legacy_member_id IN (
  SELECT id
  FROM legacy_members
  WHERE lower(name) = lower('BuDaH')
    AND lower(name) <> lower('BuDaH / WuTangClan')
);

DELETE FROM legacy_members
WHERE lower(name) = lower('BuDaH')
  AND id <> (
    SELECT id
    FROM legacy_members
    WHERE lower(name) = lower('BuDaH / WuTangClan')
    LIMIT 1
  );

UPDATE legacy_members
SET note = 'Fundador de Shaolin Kung Fu. Miembro histórico de las Viejas Dinastías.',
    sort_order = 0,
    updated_at = unixepoch()
WHERE lower(name) = lower('BuDaH / WuTangClan');
