import { Hono } from 'hono';
import { desc, eq, sql } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requireAuth, requirePermission, requireUser } from '../middleware/auth';
import { collectCompetitiveStats, loadCompetitiveStore } from '../competitive/collector';
import { summarizeCompetitive } from '../competitive/stats';

const competitive = new Hono<AppContext>();

competitive.get('/', requireAuth, async (c) => {
  let store = await loadCompetitiveStore(c.env);

  // First visit after install: seed a small recent window immediately instead of
  // forcing the clan to wait for the next five-minute cron tick.
  if (store.matches.length === 0) {
    try {
      await collectCompetitiveStats(c.env, { maxNew: 12 });
      store = await loadCompetitiveStore(c.env);
    } catch (err) {
      console.error('Competitive initial collect failed', err);
    }
  }

  c.header('Cache-Control', 'private, max-age=20');
  return c.json(summarizeCompetitive(store));
});

competitive.get('/public', requireAuth, async (c) => {
  const database = db(c.env);
  const rows = await database
    .select({
      userId: s.quakePlayerLinks.userId,
      steamId: s.quakePlayerLinks.steamId,
      quakeName: s.quakePlayerLinks.quakeName,
      siteName: sql<string>`coalesce(${s.users.displayName}, ${s.users.globalName}, ${s.users.username})`,
      gameType: s.quakePublicCurrent.gameType,
      username: s.quakePublicCurrent.username,
      rating: s.quakePublicCurrent.rating,
      deviation: s.quakePublicCurrent.deviation,
      totalGames: s.quakePublicCurrent.totalGames,
      wins: s.quakePublicCurrent.wins,
      losses: s.quakePublicCurrent.losses,
      kills: s.quakePublicCurrent.kills,
      deaths: s.quakePublicCurrent.deaths,
      kd: s.quakePublicCurrent.kd,
      capturedAt: s.quakePublicCurrent.capturedAt,
    })
    .from(s.quakePlayerLinks)
    .innerJoin(s.users, eq(s.users.id, s.quakePlayerLinks.userId))
    .leftJoin(s.quakePublicCurrent, eq(s.quakePublicCurrent.userId, s.quakePlayerLinks.userId));

  const players = new Map<number, {
    userId: number;
    steamId: string;
    quakeName: string | null;
    siteName: string;
    modes: unknown[];
  }>();
  for (const row of rows) {
    const p = players.get(row.userId) ?? {
      userId: row.userId,
      steamId: row.steamId,
      quakeName: row.quakeName,
      siteName: row.siteName,
      modes: [],
    };
    if (row.gameType) {
      p.modes.push({
        gameType: row.gameType,
        username: row.username,
        rating: row.rating,
        deviation: row.deviation,
        totalGames: row.totalGames,
        wins: row.wins,
        losses: row.losses,
        kills: row.kills,
        deaths: row.deaths,
        kd: row.kd,
        winRate: row.totalGames ? Math.round(((row.wins ?? 0) / row.totalGames) * 1000) / 10 : 0,
        capturedAt: row.capturedAt,
      });
    }
    players.set(row.userId, p);
  }

  return c.json({ players: [...players.values()] });
});

competitive.get('/member/:userId', requireUser, async (c) => {
  const userId = Number(c.req.param('userId'));
  const database = db(c.env);
  const link = await database.query.quakePlayerLinks.findFirst({
    where: eq(s.quakePlayerLinks.userId, userId),
  });
  if (!link) return c.json({ linked: false, public: [], skf: null });

  const [publicRows, history, store] = await Promise.all([
    database
      .select()
      .from(s.quakePublicCurrent)
      .where(eq(s.quakePublicCurrent.userId, userId)),
    database
      .select()
      .from(s.quakePublicDaily)
      .where(eq(s.quakePublicDaily.userId, userId))
      .orderBy(desc(s.quakePublicDaily.day))
      .limit(180),
    loadCompetitiveStore(c.env),
  ]);
  const skf = summarizeCompetitive(store).players.find((p) => p.steamId === link.steamId) ?? null;
  return c.json({
    linked: true,
    steamId: link.steamId,
    quakeName: link.quakeName,
    public: publicRows,
    history,
    skf,
  });
});

competitive.post('/refresh', requirePermission('matches.record'), async (c) => {
  const result = await collectCompetitiveStats(c.env, { maxNew: 20 });
  const store = await loadCompetitiveStore(c.env);
  return c.json({ ...result, summary: summarizeCompetitive(store) });
});

export default competitive;
