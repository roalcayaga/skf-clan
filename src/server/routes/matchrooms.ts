import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requirePermission } from '../middleware/auth';
import { syncEventToDiscord } from '../discord/events';
import { emitPulse } from '../competitive/pulse';
import { loadCompetitiveStore } from '../competitive/collector';
import { summarizeCompetitive } from '../competitive/stats';

const matchrooms = new Hono<AppContext>();
const MAX_DEMO_BYTES = 25_000_000;

function cleanMaps(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((v) => String(v).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
    : [];
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120);
  return cleaned || 'demo.dm_91';
}

function roomReport(input: {
  rival: string;
  format: string;
  scoreUs: number | null;
  scoreThem: number | null;
  map: string | null;
  players: { name: string; kd: number; avgPerformance: number }[];
}): string {
  const result =
    input.scoreUs == null || input.scoreThem == null
      ? 'Partida registrada'
      : input.scoreUs > input.scoreThem
        ? 'Victoria'
        : input.scoreUs < input.scoreThem
          ? 'Derrota'
          : 'Empate';
  const score =
    input.scoreUs == null || input.scoreThem == null ? '' : ` ${input.scoreUs}–${input.scoreThem}`;
  const top = [...input.players].sort(
    (a, b) => b.avgPerformance - a.avgPerformance || b.kd - a.kd,
  )[0];

  return [
    `${result}${score} ante ${input.rival}.`,
    input.map ? `${input.format} en ${input.map}.` : `Modo ${input.format}.`,
    top ? `${top.name} lideró a SkF con performance ${top.avgPerformance} y K/D ${top.kd}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

async function enrichedRooms(database: ReturnType<typeof db>, viewerId: number) {
  const rooms = await database
    .select({
      id: s.matchRooms.id,
      eventId: s.matchRooms.eventId,
      rivalId: s.matchRooms.rivalId,
      rival: s.rivals.name,
      rivalTag: s.rivals.tag,
      rivalNotes: s.rivals.notes,
      format: s.matchRooms.format,
      mapPool: s.matchRooms.mapPool,
      status: s.matchRooms.status,
      quakeMatchId: s.matchRooms.quakeMatchId,
      scoreUs: s.matchRooms.scoreUs,
      scoreThem: s.matchRooms.scoreThem,
      report: s.matchRooms.report,
      notes: s.matchRooms.notes,
      startsAt: s.events.startsAt,
      endsAt: s.events.endsAt,
      location: s.events.location,
      eventStatus: s.events.status,
    })
    .from(s.matchRooms)
    .innerJoin(s.rivals, eq(s.rivals.id, s.matchRooms.rivalId))
    .innerJoin(s.events, eq(s.events.id, s.matchRooms.eventId))
    .orderBy(desc(s.events.startsAt));

  if (!rooms.length) return [];

  const roomIds = rooms.map((r) => r.id);
  const eventIds = rooms.map((r) => r.eventId);
  const [lineup, demos, signups, mine] = await Promise.all([
    database
      .select({
        roomId: s.matchRoomLineup.matchRoomId,
        userId: s.matchRoomLineup.userId,
        slot: s.matchRoomLineup.slot,
        role: s.matchRoomLineup.role,
        name: sql<string>`coalesce(${s.users.displayName}, ${s.users.globalName}, ${s.users.username})`,
      })
      .from(s.matchRoomLineup)
      .innerJoin(s.users, eq(s.users.id, s.matchRoomLineup.userId))
      .where(inArray(s.matchRoomLineup.matchRoomId, roomIds))
      .orderBy(asc(s.matchRoomLineup.slot), asc(s.users.displayName)),
    database
      .select()
      .from(s.matchRoomDemos)
      .where(inArray(s.matchRoomDemos.matchRoomId, roomIds))
      .orderBy(desc(s.matchRoomDemos.createdAt)),
    database
      .select({
        eventId: s.eventSignups.eventId,
        availability: s.eventSignups.availability,
        n: sql<number>`count(*)`,
      })
      .from(s.eventSignups)
      .where(inArray(s.eventSignups.eventId, eventIds))
      .groupBy(s.eventSignups.eventId, s.eventSignups.availability),
    database
      .select({
        eventId: s.eventSignups.eventId,
        availability: s.eventSignups.availability,
      })
      .from(s.eventSignups)
      .where(and(inArray(s.eventSignups.eventId, eventIds), eq(s.eventSignups.userId, viewerId))),
  ]);

  const lineupByRoom = new Map<number, typeof lineup>();
  for (const row of lineup) {
    const arr = lineupByRoom.get(row.roomId) ?? [];
    arr.push(row);
    lineupByRoom.set(row.roomId, arr);
  }
  const demosByRoom = new Map<number, typeof demos>();
  for (const row of demos) {
    const arr = demosByRoom.get(row.matchRoomId) ?? [];
    arr.push(row);
    demosByRoom.set(row.matchRoomId, arr);
  }
  const counts = new Map<number, { available: number; tentative: number; unavailable: number }>();
  for (const row of signups) {
    const value = counts.get(row.eventId) ?? { available: 0, tentative: 0, unavailable: 0 };
    value[row.availability] = Number(row.n);
    counts.set(row.eventId, value);
  }
  const mineMap = new Map(mine.map((m) => [m.eventId, m.availability]));

  return rooms.map((room) => ({
    ...room,
    lineup: lineupByRoom.get(room.id) ?? [],
    demos: (demosByRoom.get(room.id) ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      bytes: d.bytes,
      notes: d.notes,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt,
    })),
    availabilityCounts: counts.get(room.eventId) ?? { available: 0, tentative: 0, unavailable: 0 },
    myAvailability: mineMap.get(room.eventId) ?? null,
  }));
}

matchrooms.get('/', requirePermission('events.view'), async (c) => {
  return c.json({ rooms: await enrichedRooms(db(c.env), c.get('viewer')!.id) });
});

matchrooms.get('/rivals', requirePermission('events.view'), async (c) => {
  const database = db(c.env);
  const rivals = await database.select().from(s.rivals).orderBy(asc(s.rivals.name));
  const rooms = await database
    .select({
      rivalId: s.matchRooms.rivalId,
      status: s.matchRooms.status,
      scoreUs: s.matchRooms.scoreUs,
      scoreThem: s.matchRooms.scoreThem,
      startsAt: s.events.startsAt,
    })
    .from(s.matchRooms)
    .innerJoin(s.events, eq(s.events.id, s.matchRooms.eventId));

  return c.json({
    rivals: rivals.map((r) => {
      const history = rooms.filter((m) => m.rivalId === r.id && m.status === 'played');
      const wins = history.filter((m) => m.scoreUs != null && m.scoreThem != null && m.scoreUs > m.scoreThem).length;
      const losses = history.filter((m) => m.scoreUs != null && m.scoreThem != null && m.scoreUs < m.scoreThem).length;
      const draws = history.filter((m) => m.scoreUs != null && m.scoreThem != null && m.scoreUs === m.scoreThem).length;
      return { ...r, meetings: history.length, wins, losses, draws };
    }),
  });
});

matchrooms.post('/', requirePermission('events.manage'), async (c) => {
  const body = await c.req.json<{
    rivalName?: string;
    rivalTag?: string | null;
    rivalNotes?: string | null;
    startsAt?: number;
    endsAt?: number;
    location?: string;
    format?: string;
    mapPool?: string[];
    notes?: string | null;
  }>();
  const rivalName = (body.rivalName ?? '').trim().slice(0, 80);
  if (!rivalName) return c.json({ error: 'Rival name is required.' }, 400);
  if (!Number.isFinite(body.startsAt) || !Number.isFinite(body.endsAt) || body.endsAt! <= body.startsAt!) {
    return c.json({ error: 'Valid start/end times are required.' }, 400);
  }

  const database = db(c.env);
  const viewer = c.get('viewer')!;
  const nowSec = Math.floor(Date.now() / 1000);

  await database
    .insert(s.rivals)
    .values({
      name: rivalName,
      tag: body.rivalTag?.trim().slice(0, 24) || null,
      notes: body.rivalNotes?.trim().slice(0, 1500) || null,
      updatedAt: nowSec,
    })
    .onConflictDoUpdate({
      target: s.rivals.name,
      set: {
        tag: body.rivalTag?.trim().slice(0, 24) || null,
        notes: body.rivalNotes?.trim().slice(0, 1500) || null,
        updatedAt: nowSec,
      },
    });
  const rival = await database.query.rivals.findFirst({ where: eq(s.rivals.name, rivalName) });
  if (!rival) return c.json({ error: 'Could not create rival.' }, 500);

  const event = (
    await database
      .insert(s.events)
      .values({
        title: `WAR · SkF vs ${rivalName}`,
        description: body.notes?.trim().slice(0, 1500) || null,
        startsAt: body.startsAt!,
        endsAt: body.endsAt!,
        location: (body.location ?? 'Servidor SkF').trim().slice(0, 100),
        createdBy: viewer.id,
        recurrence: 'none',
        status: 'scheduled',
      })
      .returning()
  )[0]!;

  const room = (
    await database
      .insert(s.matchRooms)
      .values({
        eventId: event.id,
        rivalId: rival.id,
        format: (body.format ?? 'CA').trim().toUpperCase().slice(0, 20),
        mapPool: cleanMaps(body.mapPool),
        notes: body.notes?.trim().slice(0, 3000) || null,
        createdBy: viewer.id,
      })
      .returning()
  )[0]!;

  await database.insert(s.auditLog).values({
    actorId: viewer.id,
    action: 'matchroom.create',
    targetType: 'match_room',
    targetId: String(room.id),
    meta: { rival: rivalName, eventId: event.id },
  });

  c.executionCtx.waitUntil(
    (async () => {
      const ids = await syncEventToDiscord(c.env, event.id);
      if (ids.discordEventId || ids.discordMessageId) {
        await database.update(s.events).set(ids).where(eq(s.events.id, event.id));
      }
    })(),
  );

  c.executionCtx.waitUntil(
    emitPulse(c.env, {
      uniqueKey: `war-scheduled:${room.id}`,
      kind: 'war_scheduled',
      title: `SkF vs ${rivalName} ya tiene Match Room`,
      body: `${room.format} · ${new Date(event.startsAt * 1000).toISOString()}`,
      occurredAt: nowSec,
      sharePath: '/competitive',
    }),
  );

  return c.json({ room, event, rival }, 201);
});

matchrooms.patch('/:id', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{
    status?: 'scheduled' | 'played' | 'cancelled';
    mapPool?: string[];
    notes?: string | null;
    report?: string | null;
    scoreUs?: number | null;
    scoreThem?: number | null;
    quakeMatchId?: string | null;
  }>();
  const database = db(c.env);
  const current = await database.query.matchRooms.findFirst({ where: eq(s.matchRooms.id, id) });
  if (!current) return c.json({ error: 'No such Match Room.' }, 404);

  const patch: Partial<typeof s.matchRooms.$inferInsert> = { updatedAt: Math.floor(Date.now() / 1000) };
  if (body.status) patch.status = body.status;
  if (body.mapPool !== undefined) patch.mapPool = cleanMaps(body.mapPool);
  if (body.notes !== undefined) patch.notes = body.notes?.trim().slice(0, 3000) || null;
  if (body.report !== undefined) patch.report = body.report?.trim().slice(0, 8000) || null;
  if (body.scoreUs !== undefined) patch.scoreUs = body.scoreUs == null ? null : Math.round(body.scoreUs);
  if (body.scoreThem !== undefined) patch.scoreThem = body.scoreThem == null ? null : Math.round(body.scoreThem);
  if (body.quakeMatchId !== undefined) patch.quakeMatchId = body.quakeMatchId?.trim() || null;

  const updated = (await database.update(s.matchRooms).set(patch).where(eq(s.matchRooms.id, id)).returning())[0]!;

  if (updated.status === 'played' && updated.scoreUs != null && updated.scoreThem != null) {
    const rival = await database.query.rivals.findFirst({ where: eq(s.rivals.id, updated.rivalId) });
    c.executionCtx.waitUntil(
      emitPulse(c.env, {
        uniqueKey: `war-result:${id}:${updated.scoreUs}:${updated.scoreThem}`,
        kind: 'war_result',
        title: `SkF ${updated.scoreUs}–${updated.scoreThem} ${rival?.name ?? 'rival'}`,
        body: updated.report || `Resultado oficial · ${updated.format}`,
        occurredAt: Math.floor(Date.now() / 1000),
        sharePath: '/competitive',
      }),
    );
  }

  return c.json({ room: updated });
});

matchrooms.post('/:id/lineup', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ userId?: number; slot?: 'starter' | 'sub' | 'reserve'; role?: string | null }>();
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId <= 0) return c.json({ error: 'Valid member required.' }, 400);
  const room = await db(c.env).query.matchRooms.findFirst({ where: eq(s.matchRooms.id, id) });
  if (!room) return c.json({ error: 'No such Match Room.' }, 404);

  await db(c.env)
    .insert(s.matchRoomLineup)
    .values({
      matchRoomId: id,
      userId,
      slot: body.slot ?? 'starter',
      role: body.role?.trim().slice(0, 80) || null,
    })
    .onConflictDoUpdate({
      target: [s.matchRoomLineup.matchRoomId, s.matchRoomLineup.userId],
      set: { slot: body.slot ?? 'starter', role: body.role?.trim().slice(0, 80) || null },
    });
  return c.json({ ok: true });
});

matchrooms.delete('/:id/lineup/:userId', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const userId = Number(c.req.param('userId'));
  await db(c.env)
    .delete(s.matchRoomLineup)
    .where(and(eq(s.matchRoomLineup.matchRoomId, id), eq(s.matchRoomLineup.userId, userId)));
  return c.json({ ok: true });
});

matchrooms.post('/:id/link-nearest', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const database = db(c.env);
  const joined = (
    await database
      .select({
        room: s.matchRooms,
        rival: s.rivals.name,
        startsAt: s.events.startsAt,
      })
      .from(s.matchRooms)
      .innerJoin(s.rivals, eq(s.rivals.id, s.matchRooms.rivalId))
      .innerJoin(s.events, eq(s.events.id, s.matchRooms.eventId))
      .where(eq(s.matchRooms.id, id))
      .limit(1)
  )[0];
  if (!joined) return c.json({ error: 'No such Match Room.' }, 404);

  const store = await loadCompetitiveStore(c.env);
  const candidate = store.matches
    .map((m) => ({ match: m, diff: Math.abs(Date.parse(m.playedAt) / 1000 - joined.startsAt) }))
    .filter((x) => Number.isFinite(x.diff) && x.diff <= 6 * 3600)
    .sort((a, b) => a.diff - b.diff)[0]?.match;
  if (!candidate) return c.json({ error: 'No SkF match found within 6 hours of this Match Room.' }, 404);

  const summary = summarizeCompetitive({ ...store, matches: [candidate] });
  const view = summary.recentMatches[0];
  const report = roomReport({
    rival: joined.rival,
    format: joined.room.format,
    scoreUs: view?.scoreUs ?? null,
    scoreThem: view?.scoreThem ?? null,
    map: candidate.map,
    players: summary.players,
  });
  const externalId = candidate.matchId || candidate.id;
  const updated = (
    await database
      .update(s.matchRooms)
      .set({
        quakeMatchId: externalId,
        scoreUs: view?.scoreUs ?? null,
        scoreThem: view?.scoreThem ?? null,
        status: 'played',
        report,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(s.matchRooms.id, id))
      .returning()
  )[0]!;
  return c.json({ room: updated, match: candidate, report });
});

matchrooms.post('/:id/demo', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const database = db(c.env);
  const room = await database.query.matchRooms.findFirst({ where: eq(s.matchRooms.id, id) });
  if (!room) return c.json({ error: 'No such Match Room.' }, 404);
  if (!c.env.MEDIA) return c.json({ error: 'R2 storage is not configured.' }, 503);

  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ error: 'No demo file provided.' }, 400);
  if (file.size > MAX_DEMO_BYTES) return c.json({ error: 'Demo is too large (max 25 MB).' }, 413);
  const name = safeFileName(file.name);
  if (!/\.(dm_\d+|zip)$/i.test(name)) {
    return c.json({ error: 'Use a Quake demo (.dm_XX) or .zip file.' }, 415);
  }

  const key = `demos/${id}/${crypto.randomUUID()}-${name}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: 'application/octet-stream',
      contentDisposition: `attachment; filename="${name.replaceAll('"', '_')}"`,
      cacheControl: 'private, max-age=0, no-store',
    },
  });
  const inserted = (
    await database
      .insert(s.matchRoomDemos)
      .values({
        matchRoomId: id,
        name,
        r2Key: key,
        bytes: file.size,
        uploadedBy: c.get('viewer')!.id,
      })
      .returning()
  )[0]!;
  return c.json({ demo: { id: inserted.id, name, bytes: file.size } }, 201);
});

matchrooms.get('/:id/demos/:demoId/download', requirePermission('events.view'), async (c) => {
  if (!c.env.MEDIA) return c.json({ error: 'R2 storage is not configured.' }, 503);
  const roomId = Number(c.req.param('id'));
  const demoId = Number(c.req.param('demoId'));
  const demo = await db(c.env).query.matchRoomDemos.findFirst({
    where: and(eq(s.matchRoomDemos.id, demoId), eq(s.matchRoomDemos.matchRoomId, roomId)),
  });
  if (!demo) return c.json({ error: 'No such demo.' }, 404);
  const object = await c.env.MEDIA.get(demo.r2Key);
  if (!object) return c.json({ error: 'Demo file is missing.' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `attachment; filename="${demo.name.replaceAll('"', '_')}"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
});

matchrooms.delete('/:id/demos/:demoId', requirePermission('events.manage'), async (c) => {
  const roomId = Number(c.req.param('id'));
  const demoId = Number(c.req.param('demoId'));
  const database = db(c.env);
  const demo = await database.query.matchRoomDemos.findFirst({
    where: and(eq(s.matchRoomDemos.id, demoId), eq(s.matchRoomDemos.matchRoomId, roomId)),
  });
  if (!demo) return c.json({ error: 'No such demo.' }, 404);
  if (c.env.MEDIA) c.executionCtx.waitUntil(c.env.MEDIA.delete(demo.r2Key));
  await database.delete(s.matchRoomDemos).where(eq(s.matchRoomDemos.id, demoId));
  return c.json({ ok: true });
});

export default matchrooms;
