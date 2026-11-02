export interface CompetitiveWeaponLine {
  hits: number;
  shots: number;
  kills: number;
  damage: number;
}

export interface CompetitiveMatchPlayer {
  steamId: string;
  name: string;
  team: number | string | null;
  kills: number;
  deaths: number;
  score: number;
  damageDealt: number;
  damageTaken: number;
  rounds: number;
  roundsWon: number;
  performance: number | null;
  eloChange: number | null;
  clan: string | null;
  weapons: Record<string, CompetitiveWeaponLine>;
  medals: Record<string, number>;
}

export interface CompetitiveMatch {
  id: string;
  matchId: string | null;
  map: string;
  gameType: string;
  playedAt: string;
  duration: number;
  serverName: string;
  team1Score: number;
  team2Score: number;
  rated: boolean;
  aborted?: boolean;
  players: CompetitiveMatchPlayer[];
}

export interface CompetitiveStore {
  version: 1;
  updatedAt: string | null;
  source: 'quakeclub';
  matches: CompetitiveMatch[];
}

export type CompetitiveResult = 'win' | 'loss' | 'draw';

export interface CompetitiveMatchView extends CompetitiveMatch {
  clanTeam: number | string | null;
  clanResult: CompetitiveResult | null;
  scoreUs: number | null;
  scoreThem: number | null;
  clanPlayers: string[];
}

export interface CompetitiveWeaponSummary extends CompetitiveWeaponLine {
  weapon: string;
  accuracy: number;
}

export interface CompetitivePlayerSummary {
  steamId: string;
  name: string;
  clan: string | null;
  appearances: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  deaths: number;
  kd: number;
  damageDealt: number;
  damageTaken: number;
  avgPerformance: number;
  eloChange: number;
  recentForm: CompetitiveResult[];
  weapons: CompetitiveWeaponSummary[];
}

export interface CompetitiveSummary {
  updatedAt: string | null;
  source: 'quakeclub';
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  playerCount: number;
  players: CompetitivePlayerSummary[];
  weapons: CompetitiveWeaponSummary[];
  recentMatches: CompetitiveMatchView[];
}
