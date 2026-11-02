import { Hono } from 'hono';
import type { AppContext } from '../env';
import { requireAuth, requirePermission } from '../middleware/auth';
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

competitive.post('/refresh', requirePermission('matches.record'), async (c) => {
  const result = await collectCompetitiveStats(c.env, { maxNew: 20 });
  const store = await loadCompetitiveStore(c.env);
  return c.json({ ...result, summary: summarizeCompetitive(store) });
});

export default competitive;
