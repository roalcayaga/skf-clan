import { Hono } from 'hono';
import { and, eq, gte, sql } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requireAuth, requirePermission } from '../middleware/auth';
import { can } from '../../shared/permissions';
import { loadCompetitiveStore } from '../competitive/collector';
import { summarizeCompetitive } from '../competitive/stats';

const performance = new Hono<AppContext>();

async function snapshot(database: ReturnType<typeof db>, env: AppContext['Bindings'], userId: number) {
  const link = await database.query.quakePlayerLinks.findFirst({ where: eq(s.quakePlayerLinks.userId, userId) });
  if (!link) return { steamId: null, skf: null, public: null };
  const [store, publicRows] = await Promise.all([
    loadCompetitiveStore(env),
    database.select().from(s.quakePublicCurrent).where(eq(s.quakePublicCurrent.userId, userId)),
  ]);
  const skf = summarizeCompetitive(store).players.find((p) => p.steamId === link.steamId) ?? null;
  const pub = publicRows.find((p) => p.gameType === 'CA') ?? publicRows[0] ?? null;
  return {
    steamId: link.steamId,
    skf: skf
      ? {
          appearances: skf.appearances,
          kd: skf.kd,
          winRate: skf.winRate,
          performance: skf.avgPerformance,
          rail: skf.weapons.find((w) => w.weapon === 'RG')?.accuracy ?? null,
        }
      : null,
    public: pub
      ? {
          gameType: pub.gameType,
          rating: pub.rating,
          kd: pub.kd,
          totalGames: pub.totalGames,
          wins: pub.wins,
          losses: pub.losses,
        }
      : null,
  };
}

performance.get('/goals/:userId', requireAuth, async (c) => {
  const userId = Number(c.req.param('userId'));
  const viewer = c.get('viewer')!;
  if (userId !== viewer.id && !can(viewer, 'training.view')) {
    return c.json({ error: 'Forbidden', missing: 'training.view' }, 403);
  }
  const goal = await db(c.env).query.trainingGoals.findFirst({ where: eq(s.trainingGoals.userId, userId) });
  return c.json({ goal: goal ?? null });
});

performance.put('/goals/:userId', requireAuth, async (c) => {
  const userId = Number(c.req.param('userId'));
  const viewer = c.get('viewer')!;
  if (userId !== viewer.id && !can(viewer, 'training.manage')) {
    return c.json({ error: 'Forbidden', missing: 'training.manage' }, 403);
  }
  const body = await c.req.json<{ focus?: string | null; target?: string | null; notes?: string | null; resetBaseline?: boolean }>();
  const database = db(c.env);
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = await database.query.trainingGoals.findFirst({ where: eq(s.trainingGoals.userId, userId) });
  const baseline = !existing || body.resetBaseline === true ? await snapshot(database, c.env, userId) : existing.baseline;

  await database
    .insert(s.trainingGoals)
    .values({
      userId,
      focus: body.focus?.trim().slice(0, 200) || null,
      target: body.target?.trim().slice(0, 300) || null,
      notes: body.notes?.trim().slice(0, 2000) || null,
      baseline,
      startedAt: !existing || body.resetBaseline === true ? nowSec : existing.startedAt,
      updatedBy: viewer.id,
      updatedAt: nowSec,
    })
    .onConflictDoUpdate({
      target: s.trainingGoals.userId,
      set: {
        focus: body.focus?.trim().slice(0, 200) || null,
        target: body.target?.trim().slice(0, 300) || null,
        notes: body.notes?.trim().slice(0, 2000) || null,
        baseline,
        startedAt: !existing || body.resetBaseline === true ? nowSec : existing.startedAt,
        updatedBy: viewer.id,
        updatedAt: nowSec,
      },
    });

  return c.json({ ok: true });
});

performance.get('/impact/:userId', requireAuth, async (c) => {
  const userId = Number(c.req.param('userId'));
  const viewer = c.get('viewer')!;
  if (userId !== viewer.id && !can(viewer, 'training.view')) {
    return c.json({ error: 'Forbidden', missing: 'training.view' }, 403);
  }
  const database = db(c.env);
  const goal = await database.query.trainingGoals.findFirst({ where: eq(s.trainingGoals.userId, userId) });
  if (!goal) return c.json({ goal: null, current: null, dojoSessions: 0, deltas: null });

  const current = await snapshot(database, c.env, userId);
  const dojoRows = await database
    .select({ n: sql<number>`count(*)` })
    .from(s.eventAttendance)
    .innerJoin(s.events, eq(s.events.id, s.eventAttendance.eventId))
    .where(
      and(
        eq(s.eventAttendance.userId, userId),
        gte(s.eventAttendance.checkedInAt, goal.startedAt),
        sql`upper(${s.events.title}) LIKE 'DOJO%'`,
      ),
    );
  const dojoSessions = Number(dojoRows[0]?.n ?? 0);
  const baseline = (goal.baseline ?? {}) as {
    skf?: { kd?: number | null; performance?: number | null; rail?: number | null } | null;
    public?: { rating?: number | null; kd?: number | null } | null;
  };

  const diff = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? null : Math.round((a - b) * 100) / 100;

  return c.json({
    goal,
    current,
    dojoSessions,
    deltas: {
      skfKd: diff(current.skf?.kd, baseline.skf?.kd),
      skfPerformance: diff(current.skf?.performance, baseline.skf?.performance),
      skfRail: diff(current.skf?.rail, baseline.skf?.rail),
      publicRating: diff(current.public?.rating, baseline.public?.rating),
      publicKd: diff(current.public?.kd, baseline.public?.kd),
    },
  });
});

performance.get('/system', requirePermission('settings.manage'), async (c) => {
  const database = db(c.env);
  const count = async (table: any) =>
    Number((await database.select({ n: sql<number>`count(*)` }).from(table))[0]?.n ?? 0);

  const [links, matches, matchPlayers, publicCurrent, publicDaily, pulse, rooms, demos, goals, demoBytes] =
    await Promise.all([
      count(s.quakePlayerLinks),
      count(s.quakeMatches),
      count(s.quakeMatchPlayers),
      count(s.quakePublicCurrent),
      count(s.quakePublicDaily),
      count(s.pulseEvents),
      count(s.matchRooms),
      count(s.matchRoomDemos),
      count(s.trainingGoals),
      database.select({ n: sql<number>`coalesce(sum(${s.matchRoomDemos.bytes}), 0)` }).from(s.matchRoomDemos),
    ]);

  const trackedRows = links + matches + matchPlayers + publicCurrent + publicDaily + pulse + rooms + demos + goals;
  return c.json({
    generatedAt: Math.floor(Date.now() / 1000),
    trackedRows,
    demoBytes: Number(demoBytes[0]?.n ?? 0),
    tables: { links, matches, matchPlayers, publicCurrent, publicDaily, pulse, rooms, demos, goals },
    guard: {
      status: trackedRows < 250_000 && Number(demoBytes[0]?.n ?? 0) < 8_000_000_000 ? 'healthy' : 'review',
      note: 'Counts only SkF Performance OS rows and Demo Vault bytes; Cloudflare account-wide usage remains visible in Cloudflare.',
    },
  });
});

export default performance;
