/**
 * Site navigation — the composable top menu (see shared/nav.ts for the model).
 *
 * Stored as one JSON blob in settings['nav']. GET is PUBLIC — a logged-out
 * visitor needs the menu too (to reach public pages like Home), and the tree is
 * just structure + labels, never a capability: the renderer (SiteNav) gates every
 * entry by the viewer's permissions and by which pages are public, so a menu
 * entry can only ever *show a door the viewer may already open*. The returned
 * tree is always sanitised, and page links whose page has since been deleted are
 * pruned. When nothing is stored yet, the classic menu is synthesised from the
 * built-ins + the pages that had the old "show in nav" flag, so upgrading loses
 * nothing. PUT is gated on `pages.manage` — whoever arranges pages arranges the
 * menu that reaches them.
 */

import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db, requirePermission } from '../middleware/auth';
import { sanitizeNav, defaultNavConfig, BUILTIN_TARGETS, type NavConfig } from '../../shared/nav';
import { HOME_SLUG } from '../../shared/layout';

const nav = new Hono<AppContext>();

const NAV_KEY = 'nav';

/** Every custom page's slug — for pruning page links to pages that still exist. */
async function pageSlugs(database: ReturnType<typeof db>): Promise<Set<string>> {
  const rows = await database.select({ slug: s.pageLayouts.slug }).from(s.pageLayouts);
  return new Set(rows.map((r) => r.slug).filter((slug) => slug !== HOME_SLUG));
}

/**
 * This SkF fork treats Competitive as a first-class destination. Existing
 * installs may already have a stored navigation tree from before the hub
 * existed, so inject the built-in once on read. The builder will persist it the
 * next time an admin saves navigation.
 */
function ensureCompetitive(config: NavConfig): NavConfig {
  const hasCompetitive = (items: NavConfig['items']): boolean =>
    items.some(
      (item) =>
        (item.type === 'link' && item.kind === 'builtin' && item.target === 'competitive') ||
        (item.type === 'group' && hasCompetitive(item.children ?? [])),
    );
  if (hasCompetitive(config.items)) return config;

  const items = [...config.items];
  const eventsIndex = items.findIndex(
    (item) => item.type === 'link' && item.kind === 'builtin' && item.target === 'events',
  );
  const adminIndex = items.findIndex(
    (item) => item.type === 'link' && item.kind === 'builtin' && item.target === 'admin',
  );
  const insertAt = eventsIndex >= 0 ? eventsIndex + 1 : adminIndex >= 0 ? adminIndex : items.length;
  items.splice(insertAt, 0, {
    id: 'skf-competitive',
    type: 'link',
    label: 'Competitive',
    kind: 'builtin',
    target: 'competitive',
  });
  return { ...config, items };
}

/** Resolve the effective nav: the stored+sanitised tree, or the classic default. */
async function loadNav(database: ReturnType<typeof db>): Promise<NavConfig> {
  const slugs = await pageSlugs(database);
  const row = await database.query.settings.findFirst({ where: eq(s.settings.key, NAV_KEY) });
  if (row?.value && typeof row.value === 'object') {
    return ensureCompetitive(sanitizeNav(row.value, { validSlugs: slugs }));
  }
  // Nothing stored → reproduce the old menu from the pages that opted in.
  const navPages = await database
    .select({ slug: s.pageLayouts.slug, title: s.pageLayouts.title })
    .from(s.pageLayouts)
    .where(eq(s.pageLayouts.showInNav, true))
    .orderBy(asc(s.pageLayouts.navOrder), asc(s.pageLayouts.slug));
  return ensureCompetitive(defaultNavConfig(navPages.filter((p) => p.slug !== HOME_SLUG)));
}

/** The rendered menu, for the top bar. Public — SiteNav gates each entry per viewer. */
nav.get('/', async (c) => {
  return c.json({ nav: await loadNav(db(c.env)) });
});

/** Everything the builder needs: the current tree + the pages, roles and built-ins to compose from. */
nav.get('/meta', requirePermission('pages.manage'), async (c) => {
  const database = db(c.env);
  const [navConfig, pages, roles] = await Promise.all([
    loadNav(database),
    database
      .select({ slug: s.pageLayouts.slug, title: s.pageLayouts.title })
      .from(s.pageLayouts)
      .orderBy(asc(s.pageLayouts.title)),
    database
      .select({ id: s.roles.id, name: s.roles.name, color: s.roles.color })
      .from(s.roles)
      .orderBy(asc(s.roles.sortOrder), asc(s.roles.name)),
  ]);

  return c.json({
    nav: navConfig,
    pages: pages.filter((p) => p.slug !== HOME_SLUG),
    roles,
    builtins: Object.values(BUILTIN_TARGETS).map((b) => ({ key: b.key, label: b.label })),
  });
});

/** Save the arranged menu. */
nav.put('/', requirePermission('pages.manage'), async (c) => {
  const body = await c.req.json<{ nav?: unknown }>();
  const clean = sanitizeNav(body.nav, { validSlugs: await pageSlugs(db(c.env)) });

  const viewer = c.get('viewer')!;
  await db(c.env)
    .insert(s.settings)
    .values({ key: NAV_KEY, value: clean, updatedBy: viewer.id })
    .onConflictDoUpdate({
      target: s.settings.key,
      set: { value: clean, updatedBy: viewer.id, updatedAt: Math.floor(Date.now() / 1000) },
    });

  await db(c.env).insert(s.auditLog).values({
    actorId: viewer.id,
    action: 'nav.update',
    targetType: 'settings',
    targetId: NAV_KEY,
    meta: { items: clean.items.length },
  });

  return c.json({ ok: true, nav: clean });
});

export default nav;
