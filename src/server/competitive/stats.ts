import type {
  CompetitiveMatch,
  CompetitiveMatchPlayer,
  CompetitiveMatchView,
  CompetitivePlayerSummary,
  CompetitiveResult,
  CompetitiveStore,
  CompetitiveSummary,
  CompetitiveWeaponLine,
  CompetitiveWeaponSummary,
} from '../../shared/competitive';

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function isSkfTag(tag: string | null | undefined): boolean {
  return typeof tag === 'string' && tag.toLowerCase().includes('skf');
}

function teamKey(team: CompetitiveMatchPlayer['team']): string | null {
  if (team == null) return null;
  return String(team);
}

function clanTeamForMatch(match: CompetitiveMatch): CompetitiveMatchPlayer['team'] {
  const counts = new Map<string, { team: CompetitiveMatchPlayer['team']; n: number }>();
  for (const player of match.players.filter((p) => isSkfTag(p.clan))) {
    const key = teamKey(player.team);
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, { team: player.team, n: (current?.n ?? 0) + 1 });
  }
  const ordered = [...counts.values()].sort((a, b) => b.n - a.n);
  if (!ordered.length) return null;
  if (ordered.length > 1 && ordered[0]!.n === ordered[1]!.n) return null;
  return ordered[0]!.team;
}

function scoreForTeam(match: CompetitiveMatch, team: CompetitiveMatchPlayer['team']): number | null {
  const key = teamKey(team);
  if (key === '1') return match.team1Score;
  if (key === '2') return match.team2Score;
  return null;
}

function resultForTeam(match: CompetitiveMatch, team: CompetitiveMatchPlayer['team']): CompetitiveResult | null {
  const ours = scoreForTeam(match, team);
  if (ours == null) return null;
  const theirs = teamKey(team) === '1' ? match.team2Score : match.team1Score;
  if (ours > theirs) return 'win';
  if (ours < theirs) return 'loss';
  return 'draw';
}

function addWeapon(target: CompetitiveWeaponLine, source: CompetitiveWeaponLine): void {
  target.hits += source.hits || 0;
  target.shots += source.shots || 0;
  target.kills += source.kills || 0;
  target.damage += source.damage || 0;
}

function weaponSummaries(map: Map<string, CompetitiveWeaponLine>): CompetitiveWeaponSummary[] {
  return [...map.entries()]
    .map(([weapon, w]) => ({
      weapon,
      ...w,
      accuracy: w.shots > 0 ? round1((w.hits / w.shots) * 100) : 0,
    }))
    .sort((a, b) => b.damage - a.damage || b.kills - a.kills);
}

function viewMatch(match: CompetitiveMatch): CompetitiveMatchView {
  const clanTeam = clanTeamForMatch(match);
  const scoreUs = scoreForTeam(match, clanTeam);
  const scoreThem =
    scoreUs == null ? null : teamKey(clanTeam) === '1' ? match.team2Score : match.team1Score;
  const clanPlayers = match.players.filter((p) => isSkfTag(p.clan)).map((p) => p.name);
  return {
    ...match,
    clanTeam,
    clanResult: resultForTeam(match, clanTeam),
    scoreUs,
    scoreThem,
    clanPlayers,
  };
}

interface PlayerAcc {
  steamId: string;
  name: string;
  clan: string | null;
  appearances: number;
  wins: number;
  losses: number;
  draws: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  performanceTotal: number;
  performanceCount: number;
  eloChange: number;
  form: CompetitiveResult[];
  weapons: Map<string, CompetitiveWeaponLine>;
}

export function summarizeCompetitive(store: CompetitiveStore): CompetitiveSummary {
  const matches = store.matches
    .filter((m) => !m.aborted)
    .sort((a, b) => String(b.playedAt).localeCompare(String(a.playedAt)));

  const views = matches.map(viewMatch);
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const m of views) {
    if (m.clanResult === 'win') wins += 1;
    else if (m.clanResult === 'loss') losses += 1;
    else if (m.clanResult === 'draw') draws += 1;
  }

  const playerMap = new Map<string, PlayerAcc>();
  const allWeapons = new Map<string, CompetitiveWeaponLine>();

  for (const match of matches) {
    const tagged = match.players.filter((p) => isSkfTag(p.clan));
    const tracked = tagged.length ? tagged : match.players;
    for (const p of tracked) {
      if (!p.steamId) continue;
      let acc = playerMap.get(p.steamId);
      if (!acc) {
        acc = {
          steamId: p.steamId,
          name: p.name,
          clan: p.clan,
          appearances: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          kills: 0,
          deaths: 0,
          damageDealt: 0,
          damageTaken: 0,
          performanceTotal: 0,
          performanceCount: 0,
          eloChange: 0,
          form: [],
          weapons: new Map(),
        };
        playerMap.set(p.steamId, acc);
      }

      acc.name = p.name || acc.name;
      acc.clan = p.clan || acc.clan;
      acc.appearances += 1;
      acc.kills += p.kills || 0;
      acc.deaths += p.deaths || 0;
      acc.damageDealt += p.damageDealt || 0;
      acc.damageTaken += p.damageTaken || 0;
      if (typeof p.performance === 'number') {
        acc.performanceTotal += p.performance;
        acc.performanceCount += 1;
      }
      if (typeof p.eloChange === 'number') acc.eloChange += p.eloChange;

      const result = resultForTeam(match, p.team);
      if (result === 'win') acc.wins += 1;
      else if (result === 'loss') acc.losses += 1;
      else if (result === 'draw') acc.draws += 1;
      if (result && acc.form.length < 10) acc.form.push(result);

      for (const [weapon, w] of Object.entries(p.weapons || {})) {
        const pw = acc.weapons.get(weapon) ?? { hits: 0, shots: 0, kills: 0, damage: 0 };
        addWeapon(pw, w);
        acc.weapons.set(weapon, pw);

        const all = allWeapons.get(weapon) ?? { hits: 0, shots: 0, kills: 0, damage: 0 };
        addWeapon(all, w);
        allWeapons.set(weapon, all);
      }
    }
  }

  const players: CompetitivePlayerSummary[] = [...playerMap.values()]
    .map((p) => {
      const decided = p.wins + p.losses + p.draws;
      return {
        steamId: p.steamId,
        name: p.name,
        clan: p.clan,
        appearances: p.appearances,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate: decided > 0 ? round1((p.wins / decided) * 100) : 0,
        kills: p.kills,
        deaths: p.deaths,
        kd: round1(p.kills / Math.max(1, p.deaths)),
        damageDealt: p.damageDealt,
        damageTaken: p.damageTaken,
        avgPerformance:
          p.performanceCount > 0 ? round1(p.performanceTotal / p.performanceCount) : 0,
        eloChange: round1(p.eloChange),
        recentForm: p.form,
        weapons: weaponSummaries(p.weapons),
      };
    })
    .sort(
      (a, b) =>
        b.avgPerformance - a.avgPerformance ||
        b.appearances - a.appearances ||
        b.kd - a.kd ||
        a.name.localeCompare(b.name),
    );

  const decided = wins + losses + draws;
  return {
    updatedAt: store.updatedAt,
    source: 'quakeclub',
    totalMatches: matches.length,
    wins,
    losses,
    draws,
    winRate: decided > 0 ? round1((wins / decided) * 100) : 0,
    playerCount: players.length,
    players,
    weapons: weaponSummaries(allWeapons),
    recentMatches: views.slice(0, 60),
  };
}
