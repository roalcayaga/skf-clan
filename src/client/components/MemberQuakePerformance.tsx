import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import './home-pulse.css';

type Result = 'win' | 'loss' | 'draw';

interface Weapon {
  weapon: string;
  accuracy: number;
  kills: number;
  damage: number;
  shots?: number;
}

interface SkfPlayer {
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  avgPerformance: number;
  eloChange: number;
  recentForm: Result[];
  weapons: Weapon[];
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

interface RecentMatch {
  id: string;
  map: string;
  gameType: string;
  playedAt: string;
  result: Result | null;
  scoreUs: number | null;
  scoreThem: number | null;
  kills: number;
  deaths: number;
  performance: number | null;
  eloChange: number | null;
}

interface Payload {
  linked: boolean;
  quakeName?: string | null;
  steamVerified?: boolean;
  steamIdMasked?: string | null;
  steamProfileUrl?: string | null;
  updatedAt?: string | null;
  public: PublicMode[];
  skf: SkfPlayer | null;
  recentMatches?: RecentMatch[];
}

const WEAPON_LABEL: Record<string, string> = {
  RG: 'Railgun',
  RL: 'Rocket Launcher',
  LG: 'Lightning Gun',
  SG: 'Shotgun',
  PG: 'Plasma Gun',
  GL: 'Grenade Launcher',
  MG: 'Machinegun',
};

function ago(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return 'recién actualizado';
  if (sec < 3600) return `actualizado hace ${Math.floor(sec / 60)} min`;
  if (sec < 86_400) return `actualizado hace ${Math.floor(sec / 3600)} h`;
  return `actualizado hace ${Math.floor(sec / 86_400)} d`;
}

function resultLabel(result: Result | null) {
  if (result === 'win') return 'W';
  if (result === 'loss') return 'L';
  if (result === 'draw') return 'D';
  return '—';
}

export default function MemberQuakePerformance({
  memberId,
  isSelf = false,
  editHref,
}: {
  memberId: number;
  isSelf?: boolean;
  editHref?: string;
}) {
  const [data, setData] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    setData(undefined);
    api.get<Payload>('/competitive/member/' + memberId + '/public').then(setData).catch(() => setData(null));
  }, [memberId]);

  const bestWeapon = useMemo(() => {
    if (!data?.skf?.weapons?.length) return null;
    return [...data.skf.weapons].sort(
      (a, b) => b.kills - a.kills || b.damage - a.damage || b.accuracy - a.accuracy,
    )[0] ?? null;
  }, [data]);

  if (data === undefined) {
    return (
      <section className="block quake-performance player-card">
        <p className="muted">Cargando perfil competitivo…</p>
      </section>
    );
  }

  if (!data?.linked) {
    return (
      <section className="block quake-performance player-card player-card-empty">
        <div>
          <span className="quake-performance-kicker">PERFIL COMPETITIVO</span>
          <h3>Quake Live</h3>
          <p className="muted">
            Este jugador aún no tiene una cuenta Steam vinculada, por lo que no hay ELO ni estadísticas públicas.
          </p>
        </div>
        {isSelf && editHref && (
          <a className="btn-cta primary" href={editHref}>
            Vincular Steam
          </a>
        )}
      </section>
    );
  }

  const ca = data.public.find((m) => m.gameType === 'CA') ?? data.public[0] ?? null;
  const publicWin = ca?.totalGames ? Math.round((ca.wins / ca.totalGames) * 1000) / 10 : null;
  const updated = ago(data.updatedAt) ?? (ca?.capturedAt ? ago(new Date(ca.capturedAt * 1000).toISOString()) : null);
  const form = data.skf?.recentForm?.slice(0, 8) ?? [];
  const matches = data.recentMatches ?? [];

  return (
    <section className="block quake-performance player-card">
      <div className="player-card-top">
        <div>
          <span className="quake-performance-kicker">CÉDULA COMPETITIVA SKF</span>
          <h3>{data.quakeName || data.skf?.name || 'Quake Live'}</h3>
          <div className="player-card-status">
            {data.steamVerified && <span className="steam-verified">✓ Steam verificado</span>}
            {data.steamIdMasked && <span>{data.steamIdMasked}</span>}
            {data.steamProfileUrl && (
              <a href={data.steamProfileUrl} target="_blank" rel="noopener noreferrer">
                Ver Steam ↗
              </a>
            )}
            {updated && <span>{updated}</span>}
          </div>
        </div>
        <a className="btn-link" href="/competitive">SkF Dojo →</a>
      </div>

      <div className="player-card-core">
        <div className="player-card-metric primary">
          <span>ELO</span>
          <strong>{ca?.rating != null ? Math.round(ca.rating) : '—'}</strong>
          <small>{ca?.gameType || 'CA'}</small>
        </div>
        <div className="player-card-metric">
          <span>K/D</span>
          <strong>{ca?.kd != null ? ca.kd.toFixed(2) : data.skf?.kd ?? '—'}</strong>
          <small>{ca ? 'público' : 'SkF'}</small>
        </div>
        <div className="player-card-metric">
          <span>WIN</span>
          <strong>{publicWin != null ? publicWin + '%' : data.skf ? data.skf.winRate + '%' : '—'}</strong>
          <small>{ca ? `${ca.wins}W · ${ca.losses}L` : data.skf ? `${data.skf.wins}W · ${data.skf.losses}L` : '—'}</small>
        </div>
        <div className="player-card-metric">
          <span>PARTIDAS</span>
          <strong>{ca?.totalGames ?? data.skf?.appearances ?? '—'}</strong>
          <small>{ca ? 'públicas' : 'SkF'}</small>
        </div>
      </div>

      <div className="player-card-lower">
        <div className="player-card-form">
          <span>FORMA RECIENTE</span>
          <div className="player-form-dots">
            {form.length ? form.map((r, i) => <b key={i} className={'is-' + r}>{resultLabel(r)}</b>) : <em>Sin historial SkF todavía</em>}
          </div>
        </div>

        <div className="player-card-strength">
          <span>FORTALEZA</span>
          {bestWeapon ? (
            <>
              <strong>{WEAPON_LABEL[bestWeapon.weapon] || bestWeapon.weapon}</strong>
              <small>{bestWeapon.accuracy}% precisión · {bestWeapon.kills} kills</small>
            </>
          ) : (
            <strong>En construcción</strong>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="player-recent-matches">
          <div className="player-recent-title">ÚLTIMAS PARTIDAS SKF</div>
          {matches.map((match) => (
            <div className="player-match-row" key={match.id}>
              <b className={'player-match-result is-' + (match.result ?? 'unknown')}>{resultLabel(match.result)}</b>
              <span className="player-match-map">{match.map}</span>
              <span>{match.gameType}</span>
              <span>{match.kills}/{match.deaths}</span>
              <span>{match.scoreUs != null && match.scoreThem != null ? `${match.scoreUs}:${match.scoreThem}` : '—'}</span>
              <small>{new Date(match.playedAt).toLocaleDateString('es-CL')}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
