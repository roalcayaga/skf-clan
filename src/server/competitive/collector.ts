import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import * as s from '../../db/schema';
import type { Env } from '../env';
import type {
  CompetitiveMatch,
  CompetitiveMatchPlayer,
  CompetitiveStore,
  CompetitiveWeaponLine,
} from '../../shared/competitive';

const STORE_KEY = 'skf_competitive_stats';
const BASE_URL = 'https://www.quakeclub.com';
const SERVER_FILTER = 'skf';
const MAX_STORED = 300;
const DEFAULT_MAX_NEW = 8;

const emptyStore = (): CompetitiveStore => ({
  version: 1,
  updatedAt: null,
  source: 'quakeclub',
  matches: [],
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
const round1 = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;

async function getJson(url: string): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    let json: any = null;
    try {
      json = await response.json();
    } catch {
      // A transient HTML/error body is handled by the status check below.
    }
    return { ok: response.ok, status: response.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

export async function loadCompetitiveStore(env: Env): Promise<CompetitiveStore> {
  const database = drizzle(env.DB, { schema });
  const row = await database.query.settings.findFirst({ where: eq(s.settings.key, STORE_KEY) });
  const value = row?.value as Partial<CompetitiveStore> | undefined;
  if (!value || value.version !== 1 || !Array.isArray(value.matches)) return emptyStore();
  return {
    version: 1,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    source: 'quakeclub',
    matches: value.matches as CompetitiveMatch[],
  };
}

async function saveCompetitiveStore(env: Env, store: CompetitiveStore): Promise<void> {
  const database = drizzle(env.DB, { schema });
  const nowSec = Math.floor(Date.now() / 1000);
  await database
    .insert(s.settings)
    .values({ key: STORE_KEY, value: store, updatedAt: nowSec })
    .onConflictDoUpdate({
      target: s.settings.key,
      set: { value: store, updatedAt: nowSec },
    });
}

function normalizePlayer(raw: any): CompetitiveMatchPlayer | null {
  if (!raw || raw.steamId == null) return null;
  const weapons: Record<string, CompetitiveWeaponLine> = {};
  for (const weapon of Array.isArray(raw.weapons) ? raw.weapons : []) {
    const key = typeof weapon?.weapon === 'string' ? weapon.weapon : '';
    if (!key) continue;
    if (num(weapon.shots) <= 0 && num(weapon.kills) <= 0 && num(weapon.damage) <= 0) continue;
    weapons[key] = {
      hits: num(weapon.hits),
      shots: num(weapon.shots),
      kills: num(weapon.kills),
      damage: num(weapon.damage),
    };
  }

  const medals: Record<string, number> = {};
  if (raw.medals && typeof raw.medals === 'object') {
    for (const [key, value] of Object.entries(raw.medals)) {
      const n = num(value);
      if (n > 0) medals[key] = n;
    }
  }

  return {
    steamId: String(raw.steamId),
    name: typeof raw.playerName === 'string' ? raw.playerName : '?',
    team:
      typeof raw.team === 'number' || typeof raw.team === 'string' ? raw.team : null,
    kills: num(raw.kills),
    deaths: num(raw.deaths),
    score: num(raw.score),
    damageDealt: num(raw.damageDealt),
    damageTaken: num(raw.damageTaken),
    rounds: num(raw.rounds),
    roundsWon: num(raw.roundsWon),
    performance: round1(raw.performance),
    eloChange: round1(raw.eloChange),
    clan:
      raw.clan && typeof raw.clan.tag === 'string'
        ? raw.clan.tag
        : typeof raw.clan === 'string'
          ? raw.clan
          : null,
    weapons,
    medals,
  };
}

function normalizeMatch(detail: any, fallback: any): CompetitiveMatch | null {
  const match = detail?.match;
  if (!match) return null;
  const players = (Array.isArray(detail?.players?.all) ? detail.players.all : [])
    .map(normalizePlayer)
    .filter((p: CompetitiveMatchPlayer | null): p is CompetitiveMatchPlayer => p !== null);

  return {
    id: String(match.id || fallback.id || fallback.matchId || ''),
    matchId: match.matchId != null ? String(match.matchId) : fallback.matchId ? String(fallback.matchId) : null,
    map: String(match.map || fallback.map || '?'),
    gameType: String(match.gameType || fallback.gameType || '').toUpperCase(),
    playedAt: String(match.playedAt || fallback.timestamp || new Date().toISOString()),
    duration: num(match.duration),
    serverName: String(match.serverName || fallback.serverName || ''),
    team1Score: num(match.team1Score),
    team2Score: num(match.team2Score),
    rated: match.isRated !== false,
    players,
  };
}

async function fetchDetail(item: any): Promise<{ match?: CompetitiveMatch; rateLimited?: boolean }> {
  const ids = [...new Set([item?.id, item?.matchId].filter(Boolean).map(String))];
  for (const id of ids) {
    const response = await getJson(BASE_URL + '/api/matches/' + encodeURIComponent(id));
    if (response.status === 429) return { rateLimited: true };
    if (
      response.ok &&
      response.json &&
      response.json.success !== false &&
      response.json.match &&
      response.json.players
    ) {
      if (response.json.match.isAborted) {
        return {
          match: {
            id: String(item.id || id),
            matchId: item.matchId ? String(item.matchId) : null,
            map: String(item.map || '?'),
            gameType: String(item.gameType || '').toUpperCase(),
            playedAt: String(item.timestamp || new Date().toISOString()),
            duration: 0,
            serverName: String(item.serverName || ''),
            team1Score: 0,
            team2Score: 0,
            rated: false,
            aborted: true,
            players: [],
          },
        };
      }
      const match = normalizeMatch(response.json, item);
      if (match) return { match };
    }
    await sleep(200);
  }
  return {};
}

export interface CompetitiveCollectResult {
  added: number;
  total: number;
  warning?: string;
}

export async function collectCompetitiveStats(
  env: Env,
  opts: { maxNew?: number } = {},
): Promise<CompetitiveCollectResult> {
  const current = await loadCompetitiveStore(env);
  const known = new Set<string>();
  for (const match of current.matches) {
    if (match.id) known.add(match.id);
    if (match.matchId) known.add(match.matchId);
  }

  const history = await getJson(BASE_URL + '/api/matches/history');
  if (!history.ok || !Array.isArray(history.json?.matches)) {
    return {
      added: 0,
      total: current.matches.length,
      warning: 'QuakeClub history unavailable (' + history.status + ')',
    };
  }

  const candidates = history.json.matches
    .filter((m: any) =>
      String(m?.serverName || '')
        .toLowerCase()
        .includes(SERVER_FILTER),
    )
    .filter((m: any) => !known.has(String(m?.id || '')) && !known.has(String(m?.matchId || '')))
    .sort((a: any, b: any) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')))
    .slice(0, Math.max(1, Math.min(opts.maxNew ?? DEFAULT_MAX_NEW, 20)));

  const added: CompetitiveMatch[] = [];
  for (const item of candidates) {
    const result = await fetchDetail(item);
    if (result.rateLimited) break;
    if (result.match) added.push(result.match);
    await sleep(250);
  }

  if (!added.length) {
    return { added: 0, total: current.matches.length };
  }

  const byId = new Map<string, CompetitiveMatch>();
  for (const match of [...added, ...current.matches]) {
    const key = match.matchId || match.id;
    if (key && !byId.has(key)) byId.set(key, match);
  }

  const matches = [...byId.values()]
    .sort((a, b) => String(b.playedAt).localeCompare(String(a.playedAt)))
    .slice(0, MAX_STORED);

  await saveCompetitiveStore(env, {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'quakeclub',
    matches,
  });

  return { added: added.length, total: matches.length };
}
