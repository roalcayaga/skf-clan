import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import * as s from '../../db/schema';
import type { Env } from '../env';
import { emitPulse } from './pulse';

const BASE_URL = 'https://www.quakeclub.com';
const REFRESH_SEC = 15 * 60;
const MAX_PER_RUN = 6;
const MODES = ['CA', 'CTF', 'DUEL', 'TDM', 'FFA'];

function n(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function count(v: unknown): number {
  const value = n(v);
  return value == null ? 0 : Math.max(0, Math.round(value));
}
function santiagoDay(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function fetchPlayer(steamId: string): Promise<any | null> {
  try {
    const response = await fetch(BASE_URL + '/api/player/' + encodeURIComponent(steamId), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizedRatings(payload: any) {
  const ratings = Array.isArray(payload?.ratings) ? payload.ratings : [];
  return ratings
    .map((raw: any) => {
      const gameType = String(raw?.gameType || raw?.mode || '').toUpperCase();
      if (!MODES.includes(gameType)) return null;
      const totalGames = count(raw?.totalGames ?? raw?.games ?? raw?.played);
      const wins = count(raw?.wins ?? raw?.victories);
      const losses = count(raw?.losses ?? Math.max(0, totalGames - wins));
      const kills = n(raw?.kills);
      const deaths = n(raw?.deaths);
      const kd =
        n(raw?.kd ?? raw?.kdr ?? raw?.killDeathRatio) ??
        (kills != null && deaths != null ? Math.round((kills / Math.max(1, deaths)) * 100) / 100 : null);
      return {
        gameType,
        rating: n(raw?.rating ?? raw?.elo),
        deviation: n(raw?.deviation),
        totalGames,
        wins,
        losses,
        kills: kills == null ? null : Math.round(kills),
        deaths: deaths == null ? null : Math.round(deaths),
        kd,
        raw: raw as Record<string, unknown>,
      };
    })
    .filter(Boolean) as Array<{
      gameType: string;
      rating: number | null;
      deviation: number | null;
      totalGames: number;
      wins: number;
      losses: number;
      kills: number | null;
      deaths: number | null;
      kd: number | null;
      raw: Record<string, unknown>;
    }>;
}

export async function collectPublicArena(env: Env) {
  const database = drizzle(env.DB, { schema });
  const nowSec = Math.floor(Date.now() / 1000);
  const links = await database
    .select({
      userId: s.quakePlayerLinks.userId,
      steamId: s.quakePlayerLinks.steamId,
      quakeName: s.quakePlayerLinks.quakeName,
    })
    .from(s.quakePlayerLinks)
    .innerJoin(s.users, eq(s.users.id, s.quakePlayerLinks.userId))
    .where(inArray(s.users.status, ['active', 'loa', 'inactive']));

  if (!links.length) return { checked: 0, updated: 0 };

  const current = await database.select().from(s.quakePublicCurrent);
  const latestByUser = new Map<number, number>();
  for (const row of current) {
    latestByUser.set(row.userId, Math.max(latestByUser.get(row.userId) ?? 0, row.capturedAt));
  }

  const due = links
    .filter((link) => nowSec - (latestByUser.get(link.userId) ?? 0) >= REFRESH_SEC)
    .sort((a, b) => (latestByUser.get(a.userId) ?? 0) - (latestByUser.get(b.userId) ?? 0))
    .slice(0, MAX_PER_RUN);

  let updated = 0;
  const day = santiagoDay();

  for (const link of due) {
    const payload = await fetchPlayer(link.steamId);
    if (!payload) continue;
    const username = String(payload?.username || link.quakeName || link.steamId);
    const ratings = normalizedRatings(payload);
    const previous = new Map(
      current.filter((r) => r.userId === link.userId).map((r) => [r.gameType, r]),
    );

    for (const rating of ratings) {
      const values = {
        userId: link.userId,
        gameType: rating.gameType,
        steamId: link.steamId,
        username,
        rating: rating.rating,
        deviation: rating.deviation,
        totalGames: rating.totalGames,
        wins: rating.wins,
        losses: rating.losses,
        kills: rating.kills,
        deaths: rating.deaths,
        kd: rating.kd,
        raw: rating.raw,
        capturedAt: nowSec,
      };

      await database
        .insert(s.quakePublicCurrent)
        .values(values)
        .onConflictDoUpdate({
          target: [s.quakePublicCurrent.userId, s.quakePublicCurrent.gameType],
          set: {
            username,
            steamId: link.steamId,
            rating: rating.rating,
            deviation: rating.deviation,
            totalGames: rating.totalGames,
            wins: rating.wins,
            losses: rating.losses,
            kills: rating.kills,
            deaths: rating.deaths,
            kd: rating.kd,
            raw: rating.raw,
            capturedAt: nowSec,
          },
        });

      await database
        .insert(s.quakePublicDaily)
        .values({ ...values, day })
        .onConflictDoUpdate({
          target: [s.quakePublicDaily.userId, s.quakePublicDaily.day, s.quakePublicDaily.gameType],
          set: {
            username,
            rating: rating.rating,
            deviation: rating.deviation,
            totalGames: rating.totalGames,
            wins: rating.wins,
            losses: rating.losses,
            kills: rating.kills,
            deaths: rating.deaths,
            kd: rating.kd,
            raw: rating.raw,
            capturedAt: nowSec,
          },
        });

      const before = previous.get(rating.gameType);
      if (
        before?.rating != null &&
        rating.rating != null &&
        Math.abs(rating.rating - before.rating) >= 5
      ) {
        const delta = Math.round((rating.rating - before.rating) * 10) / 10;
        await emitPulse(env, {
          uniqueKey: `public-rating:${link.userId}:${rating.gameType}:${rating.totalGames}:${rating.rating}`,
          kind: delta > 0 ? 'rating_up' : 'rating_down',
          userId: link.userId,
          title: `${username} ${delta > 0 ? 'subió' : 'bajó'} ${Math.abs(delta)} ELO en ${rating.gameType}`,
          body: `Rating público actual: ${Math.round(rating.rating)} · ${rating.totalGames} partidas`,
          metric: 'public_rating',
          value: rating.rating,
          delta,
          occurredAt: nowSec,
          sharePath: `/members/${link.userId}`,
        });
      }
    }

    await database
      .update(s.quakePlayerLinks)
      .set({ quakeName: username, updatedAt: nowSec })
      .where(eq(s.quakePlayerLinks.userId, link.userId));
    updated += 1;
  }

  return { checked: due.length, updated };
}
