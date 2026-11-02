import { Hono } from 'hono';
import type { AppContext } from '../env';
import { loadCompetitiveStore } from '../competitive/collector';
import { buildPulseHome } from '../competitive/pulse';

const pulse = new Hono<AppContext>();

pulse.get('/', async (c) => {
  const store = await loadCompetitiveStore(c.env);
  const viewer = c.get('viewer');
  const data = await buildPulseHome(c.env, store, viewer?.id ?? null);
  c.header('Cache-Control', viewer ? 'private, max-age=30' : 'public, max-age=60');

  if (!viewer) {
    return c.json({
      ...data,
      // Public Home exposes only a lightweight clan pulse. Member scheduling,
      // rankings, detailed feed and personal competitive data stay behind login.
      rising: [],
      nextDojo: null,
      feed: [],
      publicArena: [],
      personal: null,
    });
  }

  return c.json(data);
});

export default pulse;
