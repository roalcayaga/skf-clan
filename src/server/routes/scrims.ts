import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requirePermission } from '../middleware/auth';
import { emitNotification } from '../notifications';

const scrims = new Hono<AppContext>();

interface PublicScrimBody {
  clanName?: string;
  contactName?: string;
  contactDiscord?: string;
  contactEmail?: string;
  mode?: string;
  teamSize?: string;
  preferredAt?: number;
  alternateAt?: number | null;
  timezone?: string;
  notes?: string;
  website?: string;
}

interface ScrimPatchBody {
  status?: string;
  eventId?: number | null;
}

const MODES = new Set(['CA', 'CTF', 'TDM', 'DUEL', 'OTHER']);
const STATUSES = new Set(['pending', 'contacted', 'scheduled', 'declined']);

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Public challenge form. No account required: rival clans need a door in. */
scrims.post('/', async (c) => {
  const body: PublicScrimBody = await c.req.json<PublicScrimBody>().catch(() => ({} as PublicScrimBody));

  if (clean(body.website, 200)) return c.json({ ok: true }, 202);

  const clanName = clean(body.clanName, 80);
  const contactName = clean(body.contactName, 80);
  const contactDiscord = clean(body.contactDiscord, 100);
  const contactEmail = clean(body.contactEmail, 160) || null;
  const modeRaw = clean(body.mode, 20).toUpperCase();
  const mode = MODES.has(modeRaw) ? modeRaw : 'OTHER';
  const teamSize = clean(body.teamSize, 20) || '4v4';
  const timezone = clean(body.timezone, 80) || 'UTC';
  const notes = clean(body.notes, 1500) || null;
  const preferredAt = Number(body.preferredAt);
  const alternateAt = body.alternateAt == null ? null : Number(body.alternateAt);
  const nowSec = Math.floor(Date.now() / 1000);

  if (clanName.length < 2) return c.json({ error: 'Ingresa el nombre del clan o equipo.' }, 400);
  if (contactName.length < 2) return c.json({ error: 'Ingresa un nombre de contacto.' }, 400);
  if (contactDiscord.length < 2) return c.json({ error: 'Ingresa un usuario de Discord para coordinarnos.' }, 400);
  if (!Number.isFinite(preferredAt) || preferredAt < nowSec + 300) {
    return c.json({ error: 'La fecha propuesta debe estar en el futuro.' }, 400);
  }
  if (alternateAt != null && (!Number.isFinite(alternateAt) || alternateAt < nowSec + 300)) {
    return c.json({ error: 'La fecha alternativa debe estar en el futuro.' }, 400);
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return c.json({ error: 'El correo no parece válido.' }, 400);
  }

  const database = db(c.env);
  // Simple anti-spam backstop: one challenge per Discord contact every 15 min.
  const recent = await database.query.scrimRequests.findFirst({
    where: and(
      eq(s.scrimRequests.contactDiscord, contactDiscord),
      gte(s.scrimRequests.createdAt, nowSec - 900),
    ),
  });
  if (recent) return c.json({ error: 'Ya recibimos una solicitud reciente de este contacto.' }, 429);

  const created = (
    await database
      .insert(s.scrimRequests)
      .values({
        clanName,
        contactName,
        contactDiscord,
        contactEmail,
        mode,
        teamSize,
        preferredAt: Math.floor(preferredAt),
        alternateAt: alternateAt == null ? null : Math.floor(alternateAt),
        timezone,
        notes,
      })
      .returning({ id: s.scrimRequests.id })
  )[0]!;

  c.executionCtx.waitUntil(
    emitNotification(c.env, 'scrim.requested', {
      title: `Nuevo desafío: ${clanName}`,
      body: `${mode} ${teamSize} · contacto: ${contactDiscord}`,
      link: '/admin/admissions/scrims',
    }),
  );

  return c.json({ ok: true, requestId: created.id }, 201);
});

scrims.get('/', requirePermission('events.manage'), async (c) => {
  const rows = await db(c.env)
    .select()
    .from(s.scrimRequests)
    .orderBy(desc(s.scrimRequests.createdAt))
    .limit(200);
  return c.json({ requests: rows });
});

scrims.patch('/:id', requirePermission('events.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid request.' }, 400);

  const body: ScrimPatchBody = await c.req.json<ScrimPatchBody>().catch(() => ({} as ScrimPatchBody));
  const patch: Partial<typeof s.scrimRequests.$inferInsert> = {
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (body.status !== undefined) {
    const status = clean(body.status, 20);
    if (!STATUSES.has(status)) return c.json({ error: 'Invalid status.' }, 400);
    patch.status = status as 'pending' | 'contacted' | 'scheduled' | 'declined';
  }
  if (body.eventId !== undefined) {
    patch.eventId = body.eventId == null ? null : Number(body.eventId);
  }

  const updated = (
    await db(c.env).update(s.scrimRequests).set(patch).where(eq(s.scrimRequests.id, id)).returning()
  )[0];
  if (!updated) return c.json({ error: 'No such request.' }, 404);
  return c.json({ request: updated });
});

export default scrims;
