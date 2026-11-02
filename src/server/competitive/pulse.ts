import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, gte, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import * as s from '../../db/schema';
import type { Env } from '../env';
import type { CompetitiveMatch, CompetitiveStore } from '../../shared/competitive';
import { summarizeCompetitive } from './stats';

export interface PulseInput {
  uniqueKey: string;
  kind: string;
  userId?: number | null;
  title: string;
  body?: string | null;
  metric?: string | null;
  value?: number | null;
  delta?: number | null;
  occurredAt?: number;
  sharePath?: string | null;
}

export async function emitPulse(env: Env, input: PulseInput): Promise<void> {
  const database = drizzle(env.DB, { schema });
  await database
    .insert(s.pulseEvents)
    .values({
      uniqueKey: input.uniqueKey,
      kind: input.kind,
      userId: input.userId ?? null,
      title: input.title.slice(0, 160),
      body: input.body?.slice(0, 500) ?? null,
      metric: input.metric?.slice(0, 80) ?? null,
      value: input.value ?? null,
      delta: input.delta ?? null,
      occurredAt: input.occurredAt ?? Math.floor(Date.now() / 1000),
      sharePath: input.sharePath?.slice(0, 300) ?? null,
    })
    .onConflictDoNothing({ target: s.pulseEvents.uniqueKey });
}

export async function emitMatchPulse(env: Env, match: CompetitiveMatch): Promise<void> {
  const summary = summarizeCompetitive({
    version: 1,
    updatedAt: match.playedAt,
    source: 'quakeclub',
    matches: [match],
  });
  const view = summary.recentMatches[0];
  if (!view) return;
  const result = view.clanResult === 'win' ? 'Victoria' : view.clanResult === 'loss' ? 'Derrota' : 'Partida';
  const score =
    view.scoreUs != null && view.scoreThem != null ? `${view.scoreUs}–${view.scoreThem}` : 'resultado registrado';
  const id = match.matchId || match.id;
  await emitPulse(env, {
    uniqueKey: `match:${id}`,
    kind: 'match',
    title: `${result} SkF en ${match.map}`,
    body: `${match.gameType || 'QL'} · ${score} · ${view.clanPlayers.join(', ') || 'SkF'}`,
    occurredAt: Math.floor(Date.parse(match.playedAt) / 1000) || Math.floor(Date.now() / 1000),
    sharePath: '/competitive',
  });
}

function santiagoDay(unixSec: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(unixSec * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return santiagoDay(Math.floor(d.getTime() / 1000));
}

function matchesForDay(store: CompetitiveStore, day: string): CompetitiveMatch[] {
  return store.matches.filter((m) => {
    const sec = Math.floor(Date.parse(m.playedAt) / 1000);
    return Number.isFinite(sec) && santiagoDay(sec) === day && !m.aborted;
  });
}

function playerFromStore(store: CompetitiveStore, steamId: string) {
  return summarizeCompetitive(store).players.find((p) => p.steamId === steamId) ?? null;
}

export async function buildPulseHome(
  env: Env,
  store: CompetitiveStore,
  viewerId?: number | null,
) {
  const database = drizzle(env.DB, { schema });
  const yesterday = dayOffset(-1);
  const yesterdayStore: CompetitiveStore = {
    ...store,
    matches: matchesForDay(store, yesterday),
  };
  const y = summarizeCompetitive(yesterdayStore);

  const warrior = [...y.players].sort(
    (a, b) => b.avgPerformance - a.avgPerformance || b.kd - a.kd || b.appearances - a.appearances,
  )[0] ?? null;

  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDays = nowSec - 7 * 86_400;
  const fourteenDays = nowSec - 14 * 86_400;
  const recentStore: CompetitiveStore = {
    ...store,
    matches: store.matches.filter((m) => Date.parse(m.playedAt) / 1000 >= sevenDays),
  };
  const priorStore: CompetitiveStore = {
    ...store,
    matches: store.matches.filter((m) => {
      const t = Date.parse(m.playedAt) / 1000;
      return t >= fourteenDays && t < sevenDays;
    }),
  };
  const recentPlayers = summarizeCompetitive(recentStore).players;
  const priorPlayers = new Map(summarizeCompetitive(priorStore).players.map((p) => [p.steamId, p]));
  const rising = recentPlayers
    .map((p) => {
      const old = priorPlayers.get(p.steamId);
      return {
        steamId: p.steamId,
        name: p.name,
        kd: p.kd,
        performance: p.avgPerformance,
        kdDelta: old ? Math.round((p.kd - old.kd) * 100) / 100 : null,
        performanceDelta: old ? Math.round((p.avgPerformance - old.avgPerformance) * 10) / 10 : null,
        appearances: p.appearances,
      };
    })
    .filter((p) => p.appearances >= 2 && (p.kdDelta == null || p.kdDelta > 0 || (p.performanceDelta ?? 0) > 0))
    .sort((a, b) => (b.performanceDelta ?? -999) - (a.performanceDelta ?? -999) || (b.kdDelta ?? -999) - (a.kdDelta ?? -999))
    .slice(0, 4);

  const feed = await database
    .select()
    .from(s.pulseEvents)
    .where(gte(s.pulseEvents.occurredAt, nowSec - 14 * 86_400))
    .orderBy(desc(s.pulseEvents.occurredAt))
    .limit(12);

  const publicArena = await database
    .select({
      userId: s.quakePublicCurrent.userId,
      name: sql<string>`coalesce(${s.users.displayName}, ${s.users.globalName}, ${s.users.username})`,
      gameType: s.quakePublicCurrent.gameType,
      rating: s.quakePublicCurrent.rating,
      totalGames: s.quakePublicCurrent.totalGames,
      wins: s.quakePublicCurrent.wins,
      losses: s.quakePublicCurrent.losses,
      kd: s.quakePublicCurrent.kd,
      capturedAt: s.quakePublicCurrent.capturedAt,
    })
    .from(s.quakePublicCurrent)
    .innerJoin(s.users, eq(s.users.id, s.quakePublicCurrent.userId))
    .where(eq(s.quakePublicCurrent.gameType, 'CA'))
    .orderBy(desc(s.quakePublicCurrent.rating))
    .limit(5);


  const nextDojo = await database
    .select({
      id: s.events.id,
      title: s.events.title,
      description: s.events.description,
      startsAt: s.events.startsAt,
      endsAt: s.events.endsAt,
      location: s.events.location,
    })
    .from(s.events)
    .where(
      sql`${s.events.status} = 'scheduled'
        AND ${s.events.endsAt} >= ${nowSec}
        AND upper(${s.events.title}) LIKE 'DOJO%'`,
    )
    .orderBy(s.events.startsAt)
    .limit(1);

  const legacyCount = Number(
    (await database.select({ n: sql<number>`count(*)` }).from(s.legacyMembers))[0]?.n ?? 0,
  );
  let legacy = null;
  if (legacyCount > 0) {
    const seed = Number(yesterday.replaceAll('-', '')) || 1;
    const offset = seed % legacyCount;
    legacy =
      (
        await database
          .select({
            id: s.legacyMembers.id,
            name: s.legacyMembers.name,
            profileImageUrl: s.legacyMembers.profileImageUrl,
            yearsActive: s.legacyMembers.yearsActive,
            note: s.legacyMembers.note,
            currentNick: s.legacyMembers.currentNick,
            ownerUserId: s.legacyMembers.ownerUserId,
          })
          .from(s.legacyMembers)
          .orderBy(s.legacyMembers.sortOrder, s.legacyMembers.name)
          .limit(1)
          .offset(offset)
      )[0] ?? null;

    if (legacy?.currentNick && !legacy.ownerUserId) {
      const owner =
        (
          await database
            .select({ id: s.users.id })
            .from(s.users)
            .where(
              sql`lower(${s.users.displayName}) = lower(${legacy.currentNick})
                OR lower(${s.users.globalName}) = lower(${legacy.currentNick})
                OR lower(${s.users.username}) = lower(${legacy.currentNick})`,
            )
            .limit(1)
        )[0] ?? null;
      if (owner) legacy = { ...legacy, ownerUserId: owner.id };
    }
  }

  let personal = null;
  if (viewerId) {
    const link = await database.query.quakePlayerLinks.findFirst({
      where: eq(s.quakePlayerLinks.userId, viewerId),
    });
    if (link) {
      const publicRows = await database
        .select()
        .from(s.quakePublicCurrent)
        .where(eq(s.quakePublicCurrent.userId, viewerId));
      const skf = playerFromStore(recentStore, link.steamId) ?? playerFromStore(store, link.steamId);
      personal = { steamId: link.steamId, quakeName: link.quakeName, skf, public: publicRows };
    }
  }

  return {
    updatedAt: store.updatedAt,
    yesterday: {
      day: yesterday,
      matches: y.totalMatches,
      wins: y.wins,
      losses: y.losses,
      draws: y.draws,
      winRate: y.winRate,
      warrior,
      topRail: y.players
        .map((p) => ({ name: p.name, rail: p.weapons.find((w) => w.weapon === 'RG')?.accuracy ?? 0 }))
        .sort((a, b) => b.rail - a.rail)[0] ?? null,
      mostActive: [...y.players].sort((a, b) => b.appearances - a.appearances)[0] ?? null,
    },
    warrior,
    rising,
    nextDojo: nextDojo[0] ?? null,
    feed,
    publicArena,
    legacy,
    personal,
  };
}
