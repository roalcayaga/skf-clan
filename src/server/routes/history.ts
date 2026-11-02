import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requirePermission } from '../middleware/auth';
import { deleteMediaByUrl } from './media';

const history = new Hono<AppContext>();
const now = () => Math.floor(Date.now() / 1000);

history.get('/', async (c) => {
  const rows = await db(c.env)
    .select()
    .from(s.historyMilestones)
    .where(eq(s.historyMilestones.isPublished, true))
    .orderBy(
      asc(s.historyMilestones.sortYear),
      asc(s.historyMilestones.sortOrder),
      asc(s.historyMilestones.id),
    );
  return c.json({ milestones: rows });
});

history.get('/manage', requirePermission('pages.manage'), async (c) => {
  const rows = await db(c.env)
    .select()
    .from(s.historyMilestones)
    .orderBy(
      asc(s.historyMilestones.sortYear),
      asc(s.historyMilestones.sortOrder),
      asc(s.historyMilestones.id),
    );
  return c.json({ milestones: rows });
});

history.post('/', requirePermission('pages.manage'), async (c) => {
  const body = await c.req.json<{
    sortYear?: number;
    dateLabel?: string;
    category?: string | null;
    title?: string;
    body?: string;
    imageUrl?: string | null;
    isPublished?: boolean;
    sortOrder?: number;
  }>();

  const sortYear = Math.trunc(Number(body.sortYear));
  const dateLabel = body.dateLabel?.trim();
  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!Number.isInteger(sortYear) || sortYear < 1900 || sortYear > 2200) {
    return c.json({ error: 'El año de orden debe ser válido.' }, 400);
  }
  if (!dateLabel) return c.json({ error: 'La fecha visible es obligatoria.' }, 400);
  if (!title) return c.json({ error: 'El título es obligatorio.' }, 400);
  if (!text) return c.json({ error: 'El relato es obligatorio.' }, 400);

  const viewer = c.get('viewer')!;
  const created = (
    await db(c.env)
      .insert(s.historyMilestones)
      .values({
        sortYear,
        dateLabel: dateLabel.slice(0, 40),
        category: body.category?.trim().slice(0, 40) || null,
        title: title.slice(0, 180),
        body: text.slice(0, 6000),
        imageUrl: body.imageUrl?.trim().slice(0, 500) || null,
        isPublished: body.isPublished !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
        createdBy: viewer.id,
        updatedBy: viewer.id,
      })
      .returning()
  )[0]!;

  await db(c.env).insert(s.auditLog).values({
    actorId: viewer.id,
    action: 'history.create',
    targetType: 'history_milestone',
    targetId: String(created.id),
    meta: { title: created.title, dateLabel: created.dateLabel },
  });

  return c.json({ milestone: created }, 201);
});

history.patch('/:id', requirePermission('pages.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Hito inválido.' }, 400);

  const database = db(c.env);
  const current = await database.query.historyMilestones.findFirst({
    where: eq(s.historyMilestones.id, id),
  });
  if (!current) return c.json({ error: 'Hito no encontrado.' }, 404);

  const body = await c.req.json<{
    sortYear?: number;
    dateLabel?: string;
    category?: string | null;
    title?: string;
    body?: string;
    imageUrl?: string | null;
    isPublished?: boolean;
    sortOrder?: number;
  }>();

  const patch: Partial<typeof s.historyMilestones.$inferInsert> = {
    updatedBy: c.get('viewer')!.id,
    updatedAt: now(),
  };

  if (body.sortYear !== undefined) {
    const year = Math.trunc(Number(body.sortYear));
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return c.json({ error: 'El año de orden debe ser válido.' }, 400);
    }
    patch.sortYear = year;
  }
  if (body.dateLabel !== undefined) {
    const value = body.dateLabel.trim();
    if (!value) return c.json({ error: 'La fecha visible no puede quedar vacía.' }, 400);
    patch.dateLabel = value.slice(0, 40);
  }
  if (body.category !== undefined) patch.category = body.category?.trim().slice(0, 40) || null;
  if (body.title !== undefined) {
    const value = body.title.trim();
    if (!value) return c.json({ error: 'El título no puede quedar vacío.' }, 400);
    patch.title = value.slice(0, 180);
  }
  if (body.body !== undefined) {
    const value = body.body.trim();
    if (!value) return c.json({ error: 'El relato no puede quedar vacío.' }, 400);
    patch.body = value.slice(0, 6000);
  }
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl?.trim().slice(0, 500) || null;
  if (body.isPublished !== undefined) patch.isPublished = body.isPublished;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    patch.sortOrder = Math.trunc(Number(body.sortOrder));
  }

  const updated = (
    await database.update(s.historyMilestones).set(patch).where(eq(s.historyMilestones.id, id)).returning()
  )[0]!;

  if (body.imageUrl !== undefined && current.imageUrl && current.imageUrl !== updated.imageUrl) {
    c.executionCtx.waitUntil(deleteMediaByUrl(c.env, current.imageUrl));
  }

  await database.insert(s.auditLog).values({
    actorId: c.get('viewer')!.id,
    action: 'history.update',
    targetType: 'history_milestone',
    targetId: String(id),
    meta: { title: updated.title, dateLabel: updated.dateLabel },
  });

  return c.json({ milestone: updated });
});

history.delete('/:id', requirePermission('pages.manage'), async (c) => {
  const id = Number(c.req.param('id'));
  const database = db(c.env);
  const current = await database.query.historyMilestones.findFirst({
    where: eq(s.historyMilestones.id, id),
  });
  if (!current) return c.json({ error: 'Hito no encontrado.' }, 404);

  await database.delete(s.historyMilestones).where(eq(s.historyMilestones.id, id));
  if (current.imageUrl) c.executionCtx.waitUntil(deleteMediaByUrl(c.env, current.imageUrl));

  await database.insert(s.auditLog).values({
    actorId: c.get('viewer')!.id,
    action: 'history.delete',
    targetType: 'history_milestone',
    targetId: String(id),
    meta: { title: current.title, dateLabel: current.dateLabel },
  });

  return c.json({ ok: true });
});

export default history;
