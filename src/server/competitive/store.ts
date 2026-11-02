import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import * as s from '../../db/schema';
import type { Env } from '../env';
import type { CompetitiveMatch, CompetitiveStore } from '../../shared/competitive';

const BACKFILL_KEY = 'skf_competitive_structured_backfill_v1';

function playedAtSec(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : Math.floor(Date.now() / 1000);
}

export async function persistCompetitiveMatches(
  env: Env,
  matches: CompetitiveMatch[],
  scope: 'skf' | 'public' = 'skf',
): Promise<number> {
  if (!matches.length) return 0;
  const database = drizzle(env.DB, { schema });
  let inserted = 0;

  for (const match of matches) {
    const externalId = match.matchId || match.id;
    if (!externalId) continue;

    const result = await database
      .insert(s.quakeMatches)
      .values({
        externalId,
        matchId: match.matchId,
        scope,
        serverName: match.serverName,
        map: match.map,
        gameType: match.gameType,
        playedAt: playedAtSec(match.playedAt),
        duration: match.duration,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        rated: match.rated,
        aborted: match.aborted === true,
      })
      .onConflictDoNothing({ target: s.quakeMatches.externalId })
      .returning({ id: s.quakeMatches.externalId });

    if (result.length) inserted += 1;

    for (const player of match.players) {
      if (!player.steamId) continue;
      await database
        .insert(s.quakeMatchPlayers)
        .values({
          externalMatchId: externalId,
          steamId: player.steamId,
          name: player.name,
          team: player.team == null ? null : String(player.team),
          clan: player.clan,
          kills: player.kills,
          deaths: player.deaths,
          score: player.score,
          damageDealt: player.damageDealt,
          damageTaken: player.damageTaken,
          rounds: player.rounds,
          roundsWon: player.roundsWon,
          performance: player.performance,
          eloChange: player.eloChange,
          weapons: player.weapons,
          medals: player.medals,
        })
        .onConflictDoUpdate({
          target: [s.quakeMatchPlayers.externalMatchId, s.quakeMatchPlayers.steamId],
          set: {
            name: player.name,
            team: player.team == null ? null : String(player.team),
            clan: player.clan,
            kills: player.kills,
            deaths: player.deaths,
            score: player.score,
            damageDealt: player.damageDealt,
            damageTaken: player.damageTaken,
            rounds: player.rounds,
            roundsWon: player.roundsWon,
            performance: player.performance,
            eloChange: player.eloChange,
            weapons: player.weapons,
            medals: player.medals,
          },
        });
    }
  }

  return inserted;
}

export async function backfillLegacyCompetitiveStore(env: Env, store: CompetitiveStore): Promise<number> {
  const database = drizzle(env.DB, { schema });
  const done = await database.query.settings.findFirst({ where: eq(s.settings.key, BACKFILL_KEY) });
  if (done) return 0;

  const inserted = await persistCompetitiveMatches(env, store.matches, 'skf');
  await database
    .insert(s.settings)
    .values({
      key: BACKFILL_KEY,
      value: { completedAt: new Date().toISOString(), matches: store.matches.length },
    })
    .onConflictDoNothing({ target: s.settings.key });

  return inserted;
}
