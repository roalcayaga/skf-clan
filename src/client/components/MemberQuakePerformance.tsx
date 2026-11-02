import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './home-pulse.css';

interface SkfPlayer {
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  avgPerformance: number;
  eloChange: number;
  weapons: { weapon: string; accuracy: number; kills: number; damage: number }[];
}

interface PublicMode {
  gameType: string;
  username: string;
  rating: number | null;
  deviation: number | null;
  totalGames: number;
  wins: number;
  losses: number;
  kd: number | null;
  capturedAt: number;
}

interface Payload {
  linked: boolean;
  steamId?: string;
  quakeName?: string | null;
  public: PublicMode[];
  skf: SkfPlayer | null;
}

function delta(a: number | null | undefined, b: number | null | undefined, suffix = '') {
  if (a == null || b == null) return '—';
  const d = Math.round((a - b) * 10) / 10;
  return (d > 0 ? '+' : '') + d + suffix;
}

export default function MemberQuakePerformance({
  memberId,
  linkedSteamId,
}: {
  memberId: number;
  linkedSteamId: string | null;
}) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    if (!linkedSteamId) {
      setData(null);
      return;
    }
    api.get<Payload>('/competitive/member/' + memberId).then(setData).catch(() => setData(null));
  }, [memberId, linkedSteamId]);

  if (!linkedSteamId) {
    return (
      <section className="block quake-performance">
        <h3>Quake Live Performance</h3>
        <p className="muted">Vincula tu SteamID64 arriba para activar Public Arena y el benchmark SkF vs público.</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="block quake-performance">
        <h3>Quake Live Performance</h3>
        <p className="muted">Cargando datos de Quake Club…</p>
      </section>
    );
  }

  const ca = data.public.find((m) => m.gameType === 'CA') ?? data.public[0] ?? null;
  const rail = data.skf?.weapons.find((w) => w.weapon === 'RG') ?? null;

  return (
    <section className="block quake-performance">
      <div className="quake-performance-head">
        <div>
          <span className="quake-performance-kicker">QUAKE LIVE</span>
          <h3>{data.quakeName || data.skf?.name || 'Competitive profile'}</h3>
        </div>
        <a className="btn-link" href="/competitive">Competitive Hub →</a>
      </div>

      <div className="quake-performance-grid">
        <div>
          <span>SkF K/D</span>
          <strong>{data.skf?.kd ?? '—'}</strong>
          <small>{data.skf ? data.skf.appearances + ' partidas' : 'sin partidas SkF'}</small>
        </div>
        <div>
          <span>SkF win rate</span>
          <strong>{data.skf ? data.skf.winRate + '%' : '—'}</strong>
          <small>{data.skf ? data.skf.wins + 'W / ' + data.skf.losses + 'L' : '—'}</small>
        </div>
        <div>
          <span>Public ELO {ca?.gameType || 'CA'}</span>
          <strong>{ca?.rating != null ? Math.round(ca.rating) : '—'}</strong>
          <small>{ca ? ca.totalGames + ' partidas públicas' : 'esperando snapshot'}</small>
        </div>
        <div>
          <span>Public win rate</span>
          <strong>{ca?.totalGames ? Math.round((ca.wins / ca.totalGames) * 1000) / 10 + '%' : '—'}</strong>
          <small>{ca ? ca.wins + 'W / ' + ca.losses + 'L' : '—'}</small>
        </div>
      </div>

      <div className="quake-benchmark">
        <strong>BENCHMARK</strong>
        <span>SkF K/D {data.skf?.kd ?? '—'} vs Público {ca?.kd ?? 'N/A'}</span>
        {ca?.kd != null && data.skf && <b>{delta(data.skf.kd, ca.kd)}</b>}
        {rail && <span>Rail SkF: {rail.accuracy}%</span>}
      </div>
    </section>
  );
}
