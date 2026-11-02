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
  return c.json(data);
});

export default pulse;
