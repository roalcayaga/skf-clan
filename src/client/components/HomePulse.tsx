import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import './home-pulse.css';

interface PulsePlayer {
  steamId: string;
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  avgPerformance: number;
  eloChange: number;
  weapons: { weapon: string; accuracy: number }[];
}

interface PublicMode {
  gameType: string;
  username: string;
  rating: number | null;
  totalGames: number;
  wins: number;
  losses: number;
  kd: number | null;
}

interface PulseEvent {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  value: number | null;
  delta: number | null;
  occurredAt: number;
  sharePath: string | null;
}

interface PulseData {
  updatedAt: string | null;
  yesterday: {
    day: string;
    matches: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    warrior: PulsePlayer | null;
    topRail: { name: string; rail: number } | null;
    mostActive: PulsePlayer | null;
  };
  warrior: PulsePlayer | null;
  rising: {
    steamId: string;
    name: string;
    kd: number;
    performance: number;
    kdDelta: number | null;
    performanceDelta: number | null;
    appearances: number;
  }[];
  nextDojo: {
    id: number;
    title: string;
    description: string | null;
    startsAt: number;
    endsAt: number;
    location: string;
  } | null;
  feed: PulseEvent[];
  publicArena: {
    userId: number;
    name: string;
    gameType: string;
    rating: number | null;
    totalGames: number;
    wins: number;
    losses: number;
    kd: number | null;
    capturedAt: number;
  }[];
  legacy: {
    id: number;
    name: string;
    profileImageUrl: string | null;
    yearsActive: string | null;
    note: string | null;
  } | null;
  personal: {
    steamId: string;
    quakeName: string | null;
    skf: PulsePlayer | null;
    public: PublicMode[];
  } | null;
}

function stripDojo(title: string): string {
  return title.replace(/^DOJO\s*[·:-]\s*/i, '').trim();
}

function fmtDateTime(unix: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function fmtAgo(unix: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return 'hace ' + Math.floor(seconds / 60) + ' min';
  if (seconds < 86400) return 'hace ' + Math.floor(seconds / 3600) + ' h';
  return 'hace ' + Math.floor(seconds / 86400) + ' d';
}

function shareWhatsApp(title: string, body: string, path: string) {
  const url = new URL(path, window.location.origin).toString();
  const text = '🐉 *SkF · ' + title + '*\n' + body + '\n\n' + url;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
}

export default function HomePulse() {
  const { viewer } = useSession();
  const [pulse, setPulse] = useState<PulseData | null>(null);

  useEffect(() => {
    let active = true;
    const loadPulse = async () => {
      try {
        const data = await api.get<PulseData>('/skf/pulse');
        if (active) setPulse(data);
      } catch {
        // Keep the rest of Home usable if Pulse is temporarily unavailable.
      }
    };
    void loadPulse();
    const pulseTimer = window.setInterval(loadPulse, 60_000);
    return () => {
      active = false;
      window.clearInterval(pulseTimer);
    };
  }, []);

  if (!pulse) return null;

  const ca = pulse?.personal?.public.find((m) => m.gameType === 'CA') ?? pulse?.personal?.public[0] ?? null;
  const rail = pulse?.personal?.skf?.weapons.find((w) => w.weapon === 'RG')?.accuracy ?? null;

  return (
    <section className="home-pulse" aria-label="SkF Pulse">
      <header className="home-pulse-head">
        <div>
          <span>SKF PULSE</span>
          <h2>Qué está pasando en el Templo</h2>
        </div>
        <Link to="/competitive">SkF Arena →</Link>
      </header>

      <div className="pulse-grid">
        <article className="pulse-card pulse-yesterday">
          <div className="pulse-card-kicker">ANOCHE EN SkF</div>
          {pulse?.yesterday.matches ? (
            <>
              <div className="pulse-big-stat">
                <strong>{pulse.yesterday.matches}</strong>
                <span>partidas</span>
              </div>
              <div className="pulse-record">
                <b>{pulse.yesterday.wins}W</b>
                <span>{pulse.yesterday.losses}L</span>
                {pulse.yesterday.draws > 0 && <span>{pulse.yesterday.draws}D</span>}
                <em>{pulse.yesterday.winRate}%</em>
              </div>
              <ul>
                {pulse.yesterday.warrior && (
                  <li><span>Mejor performance</span><strong>{pulse.yesterday.warrior.name} · {pulse.yesterday.warrior.avgPerformance}</strong></li>
                )}
                {pulse.yesterday.topRail && pulse.yesterday.topRail.rail > 0 && (
                  <li><span>Mejor Rail</span><strong>{pulse.yesterday.topRail.name} · {pulse.yesterday.topRail.rail}%</strong></li>
                )}
                {pulse.yesterday.mostActive && (
                  <li><span>Más activo</span><strong>{pulse.yesterday.mostActive.name} · {pulse.yesterday.mostActive.appearances}</strong></li>
                )}
              </ul>
              <button
                className="pulse-share"
                onClick={() =>
                  shareWhatsApp(
                    'Anoche en el Templo',
                    pulse.yesterday.matches + ' partidas · ' + pulse.yesterday.wins + 'W/' + pulse.yesterday.losses + 'L' +
                      (pulse.yesterday.warrior ? '\nMVP: ' + pulse.yesterday.warrior.name + ' · Perf ' + pulse.yesterday.warrior.avgPerformance : '') +
                      (pulse.yesterday.topRail?.rail ? '\nMejor Rail: ' + pulse.yesterday.topRail.name + ' · ' + pulse.yesterday.topRail.rail + '%' : ''),
                    '/competitive',
                  )
                }
              >
                Compartir en WhatsApp
              </button>
            </>
          ) : (
            <p className="muted">Ayer el Templo descansó. La próxima actividad aparecerá aquí automáticamente.</p>
          )}
        </article>

        <article className="pulse-card pulse-warrior">
          <div className="pulse-card-kicker">GUERRERO DEL DÍA</div>
          {pulse?.warrior ? (
            <>
              <h3>{pulse.warrior.name}</h3>
              <div className="pulse-warrior-stats">
                <div><span>K/D</span><strong>{pulse.warrior.kd}</strong></div>
                <div><span>PERF.</span><strong>{pulse.warrior.avgPerformance}</strong></div>
                <div><span>W%</span><strong>{pulse.warrior.winRate}%</strong></div>
              </div>
              <button
                className="pulse-share"
                onClick={() =>
                  shareWhatsApp(
                    'Guerrero del Día',
                    pulse.warrior!.name + ' · K/D ' + pulse.warrior!.kd + ' · Performance ' + pulse.warrior!.avgPerformance,
                    '/competitive',
                  )
                }
              >
                Compartir
              </button>
            </>
          ) : (
            <p className="muted">Aparecerá cuando exista actividad competitiva del día anterior.</p>
          )}
        </article>

        <article className="pulse-card pulse-dojo">
          <div className="pulse-card-kicker">PRÓXIMO DOJO</div>
          {pulse?.nextDojo ? (
            <>
              <time>{fmtDateTime(pulse.nextDojo.startsAt)}</time>
              <h3>{stripDojo(pulse.nextDojo.title)}</h3>
              <p>{pulse.nextDojo.description || pulse.nextDojo.location}</p>
              <Link to="/competitive">Ver Dojo →</Link>
            </>
          ) : (
            <p className="muted">No hay entrenamiento agendado todavía.</p>
          )}
        </article>
      </div>

      {viewer && (
        <article className="pulse-personal">
          <div>
            <span className="pulse-card-kicker">TU PULSO</span>
            <h3>{pulse?.personal?.quakeName || viewer.displayName || viewer.globalName || viewer.username}</h3>
          </div>
          {pulse?.personal ? (
            <div className="pulse-personal-stats">
              <div><span>SkF K/D</span><strong>{pulse.personal.skf?.kd ?? '—'}</strong><small>últimos 7 días / histórico si no hay actividad</small></div>
              <div><span>SkF Perf.</span><strong>{pulse.personal.skf?.avgPerformance ?? '—'}</strong><small>{pulse.personal.skf?.appearances ?? 0} partidas</small></div>
              <div><span>Public ELO {ca?.gameType || 'CA'}</span><strong>{ca?.rating != null ? Math.round(ca.rating) : '—'}</strong><small>{ca?.totalGames ?? 0} partidas</small></div>
              <div><span>Rail SkF</span><strong>{rail != null ? rail + '%' : '—'}</strong><small>accuracy</small></div>
            </div>
          ) : (
            <div className="pulse-link-steam">
              <p>Vincula tu SteamID64 para activar Public Arena, benchmarks y seguimiento personal.</p>
              <Link to={'/members/' + viewer.id}>Vincular Steam →</Link>
            </div>
          )}
        </article>
      )}

      <div className="pulse-grid pulse-grid-lower">
        <article className="pulse-card">
          <div className="pulse-card-kicker">EN ALZA · 7 DÍAS</div>
          {pulse?.rising.length ? (
            <ol className="pulse-rising">
              {pulse.rising.map((p, i) => (
                <li key={p.steamId}>
                  <b>{i + 1}</b>
                  <span><strong>{p.name}</strong><small>{p.appearances} partidas</small></span>
                  <em>
                    {p.performanceDelta != null && p.performanceDelta > 0
                      ? '+' + p.performanceDelta + ' perf'
                      : p.kdDelta != null
                        ? (p.kdDelta > 0 ? '+' : '') + p.kdDelta + ' K/D'
                        : 'nuevo'}
                  </em>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Necesitamos dos semanas comparables para detectar quién viene subiendo.</p>
          )}
        </article>

        <article className="pulse-card pulse-feed-card">
          <div className="pulse-card-kicker">CLAN PULSE</div>
          {pulse?.feed.length ? (
            <ul className="pulse-feed">
              {pulse.feed.slice(0, 6).map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    {event.body && <span>{event.body}</span>}
                    <small>{fmtAgo(event.occurredAt)}</small>
                  </div>
                  {event.sharePath && (
                    <button onClick={() => shareWhatsApp(event.title, event.body || '', event.sharePath!)}>↗</button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">El feed se irá llenando con partidas, ELO, récords y actividad relevante.</p>
          )}
        </article>

        <article className="pulse-card pulse-public-arena">
          <div className="pulse-card-kicker">PUBLIC ARENA · CA</div>
          {pulse?.publicArena.length ? (
            <ol className="pulse-rising">
              {pulse.publicArena.map((p, i) => (
                <li key={p.userId}>
                  <b>{i + 1}</b>
                  <span><strong>{p.name}</strong><small>{p.totalGames} partidas · K/D {p.kd ?? 'N/A'}</small></span>
                  <em>{p.rating != null ? Math.round(p.rating) + ' ELO' : '—'}</em>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Aparecerá cuando los guerreros vinculen su SteamID64.</p>
          )}
          <Link to="/competitive">Ver Public Arena →</Link>
        </article>

        <article className="pulse-card pulse-legacy">
          <div className="pulse-card-kicker">VIEJAS DINASTÍAS</div>
          {pulse?.legacy ? (
            <div className="pulse-legacy-body">
              {pulse.legacy.profileImageUrl && <img src={pulse.legacy.profileImageUrl} alt="" />}
              <div>
                <h3>{pulse.legacy.name}</h3>
                {pulse.legacy.yearsActive && <span>{pulse.legacy.yearsActive}</span>}
                {pulse.legacy.note && <p>{pulse.legacy.note}</p>}
              </div>
            </div>
          ) : (
            <p className="muted">La historia del clan aparecerá aquí en rotación.</p>
          )}
        </article>
      </div>
    </section>
  );
}
