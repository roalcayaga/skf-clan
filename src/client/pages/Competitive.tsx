import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import '../competitive.css';
import { useSession } from '../lib/session';
import { shareActivityWhatsApp } from '../lib/share';
import MatchRoomsTab from '../components/MatchRoomsTab';
import DojoOverview from '../components/DojoOverview';
import Tournaments from './Tournaments';
import type { TournamentSummary } from '../lib/tournaments';
import type {
  CompetitiveMatchView,
  CompetitivePlayerSummary,
  CompetitiveResult,
  CompetitiveSummary,
} from '../../shared/competitive';

type Tab = 'overview' | 'matches' | 'players' | 'wars' | 'tournaments' | 'training';
type Availability = 'available' | 'tentative' | 'unavailable';
type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface DojoEvent {
  id: number;
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number;
  location: string;
  recurrence: Recurrence;
  signupCount: number;
  availabilityCounts?: {
    available: number;
    tentative: number;
    unavailable: number;
  };
  mySignup: { roleId: number | null; availability: Availability } | null;
}

interface PublicMode {
  gameType: string;
  username: string;
  rating: number | null;
  deviation: number | null;
  totalGames: number;
  wins: number;
  losses: number;
  kills: number | null;
  deaths: number | null;
  kd: number | null;
  winRate: number;
  capturedAt: number;
}

interface PublicArenaPlayer {
  userId: number;
  steamId: string;
  quakeName: string | null;
  siteName: string;
  modes: PublicMode[];
}


const EMPTY_SUMMARY: CompetitiveSummary = {
  updatedAt: null,
  source: 'quakeclub',
  totalMatches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winRate: 0,
  playerCount: 0,
  players: [],
  weapons: [],
  recentMatches: [],
};

const RESULT_LABEL: Record<CompetitiveResult, string> = {
  win: 'W',
  loss: 'L',
  draw: 'D',
};

const pad = (n: number) => String(n).padStart(2, '0');

function mondayForOffset(offset: number): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const sinceMonday = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - sinceMonday + offset * 7);
  return now;
}

function dateInput(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtTime(unix: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('es-CL').format(n);
}

function stripDojo(title: string): string {
  return title.replace(/^DOJO\s*[·:-]\s*/i, '').trim() || 'Entrenamiento SkF';
}

function resultClass(result: CompetitiveResult | null): string {
  return result ? ' is-' + result : '';
}

function MatchRow({ match }: { match: CompetitiveMatchView }) {
  return (
    <div className={'competitive-match' + resultClass(match.clanResult)}>
      <div className="competitive-match-result">
        {match.clanResult ? RESULT_LABEL[match.clanResult] : '—'}
      </div>
      <div className="competitive-match-main">
        <strong>{match.map}</strong>
        <span>
          {match.gameType || 'QL'} · {fmtDate(match.playedAt)}
        </span>
        {match.clanPlayers.length > 0 && (
          <small>{match.clanPlayers.join(' · ')}</small>
        )}
      </div>
      <div className="competitive-match-score">
        {match.scoreUs != null && match.scoreThem != null ? (
          <>
            <strong>{match.scoreUs}</strong>
            <span>:</span>
            <strong>{match.scoreThem}</strong>
          </>
        ) : (
          <span>sin score</span>
        )}
      </div>
    </div>
  );
}

function FormDots({ form }: { form: CompetitiveResult[] }) {
  if (!form.length) return <span className="muted">—</span>;
  return (
    <span className="competitive-form" aria-label="Forma reciente">
      {form.slice(0, 8).map((r, i) => (
        <i key={i} className={'form-dot is-' + r} title={r} />
      ))}
    </span>
  );
}

function PlayerTable({
  players,
  onSelect,
}: {
  players: CompetitivePlayerSummary[];
  onSelect?: (steamId: string) => void;
}) {
  return (
    <div className="competitive-table-wrap">
      <table className="competitive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Guerrero</th>
            <th>Partidas</th>
            <th>W%</th>
            <th>K/D</th>
            <th>Perf.</th>
            <th>ELO</th>
            <th>Forma</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.steamId} onClick={() => onSelect?.(p.steamId)} className={onSelect ? 'is-clickable' : ''}>
              <td className="competitive-rank">{i + 1}</td>
              <td>
                <strong>{p.name}</strong>
                {p.clan && <small>{p.clan}</small>}
              </td>
              <td>{p.appearances}</td>
              <td>{p.winRate}%</td>
              <td>{p.kd}</td>
              <td>{p.avgPerformance}</td>
              <td className={p.eloChange > 0 ? 'positive' : p.eloChange < 0 ? 'negative' : ''}>
                {p.eloChange > 0 ? '+' : ''}{p.eloChange}
              </td>
              <td><FormDots form={p.recentForm} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Competitive({ managementMode = false }: { managementMode?: boolean } = {}) {
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<CompetitiveSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedSteamId, setSelectedSteamId] = useState<string | null>(null);
  const [publicPlayers, setPublicPlayers] = useState<PublicArenaPlayer[]>([]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekEvents, setWeekEvents] = useState<DojoEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DojoEvent[]>([]);
  const [dojo, setDojo] = useState<DojoEvent[]>([]);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [dojoLoading, setDojoLoading] = useState(false);
  const [dojoError, setDojoError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [trainingName, setTrainingName] = useState('CA Teamplay');
  const [trainingDate, setTrainingDate] = useState(dateInput(new Date()));
  const [trainingTime, setTrainingTime] = useState('22:00');
  const [trainingDuration, setTrainingDuration] = useState(90);
  const [trainingLocation, setTrainingLocation] = useState('Discord + Servidor SkF');
  const [trainingNotes, setTrainingNotes] = useState('');
  const [trainingRecurrence, setTrainingRecurrence] = useState<Recurrence>('weekly');
  const [trainingBusy, setTrainingBusy] = useState(false);

  const canRefresh = managementMode && can('matches.record');
  const canViewDojo = can('events.view');
  const canManageDojo = managementMode && can('events.manage');

  async function loadStats() {
    setStatsError(null);
    try {
      const data = await api.get<CompetitiveSummary>('/competitive');
      setSummary(data);
      if (!selectedSteamId && data.players[0]) setSelectedSteamId(data.players[0].steamId);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPublicArena() {
    try {
      const data = await api.get<{ players: PublicArenaPlayer[] }>('/competitive/public');
      setPublicPlayers(data.players);
    } catch {
      setPublicPlayers([]);
    }
  }


  const weekStart = useMemo(() => mondayForOffset(weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  async function loadDojo() {
    if (!canViewDojo) {
      try {
        const tournamentData = await api.get<{ tournaments: TournamentSummary[] }>('/tournaments');
        setTournaments(tournamentData.tournaments);
      } catch {
        setTournaments([]);
      }
      return;
    }
    setDojoLoading(true);
    setDojoError(null);
    const from = Math.floor(weekStart.getTime() / 1000);
    const to = Math.floor(weekEnd.getTime() / 1000) - 1;
    const now = Math.floor(Date.now() / 1000);
    const horizon = now + 30 * 86_400;
    try {
      const [weekData, upcomingData, tournamentData] = await Promise.all([
        api.get<{ events: DojoEvent[] }>('/events?from=' + from + '&to=' + to),
        api.get<{ events: DojoEvent[] }>('/events?from=' + now + '&to=' + horizon),
        api.get<{ tournaments: TournamentSummary[] }>('/tournaments'),
      ]);
      setWeekEvents(weekData.events);
      setUpcomingEvents(upcomingData.events);
      setDojo(weekData.events.filter((event) => /^DOJO\s*[·:-]/i.test(event.title)));
      setTournaments(tournamentData.tournaments);
    } catch (err) {
      setDojoError(err instanceof Error ? err.message : 'No se pudo cargar el calendario del Dojo.');
      setWeekEvents([]);
      setUpcomingEvents([]);
      setDojo([]);
    } finally {
      setDojoLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
    void loadPublicArena();
  }, []);

  useEffect(() => {
    void loadDojo();
  }, [weekOffset, canViewDojo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshStats() {
    if (!canRefresh) return;
    setStatsBusy(true);
    setStatsError(null);
    try {
      const data = await api.post<{ summary: CompetitiveSummary }>('/competitive/refresh');
      setSummary(data.summary);
      void loadPublicArena();
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'No se pudo actualizar QuakeClub.');
    } finally {
      setStatsBusy(false);
    }
  }

  async function setAvailability(eventId: number, availability: Availability) {
    try {
      await api.post('/events/' + eventId + '/signup', { roleId: null, availability });
      await loadDojo();
    } catch (err) {
      setDojoError(err instanceof Error ? err.message : 'No se pudo guardar tu disponibilidad.');
    }
  }

  async function cancelTraining(eventId: number) {
    if (!canManageDojo) return;
    try {
      await api.del('/events/' + eventId);
      await loadDojo();
    } catch (err) {
      setDojoError(err instanceof Error ? err.message : 'No se pudo cancelar el entrenamiento.');
    }
  }

  async function createTraining() {
    if (!canManageDojo || !trainingName.trim() || !trainingDate || !trainingTime) return;
    const start = new Date(trainingDate + 'T' + trainingTime + ':00');
    if (Number.isNaN(start.getTime())) return;
    const startsAt = Math.floor(start.getTime() / 1000);
    const endsAt = startsAt + Math.max(30, trainingDuration) * 60;

    setTrainingBusy(true);
    setDojoError(null);
    try {
      await api.post('/events', {
        title: 'DOJO · ' + trainingName.trim(),
        description: trainingNotes.trim() || null,
        startsAt,
        endsAt,
        location: trainingLocation.trim() || 'Discord + Servidor SkF',
        recurrence: trainingRecurrence,
        roles: [],
      });
      setShowCreate(false);
      setTrainingNotes('');
      const targetMonday = new Date(start);
      targetMonday.setHours(0, 0, 0, 0);
      targetMonday.setDate(targetMonday.getDate() - ((targetMonday.getDay() + 6) % 7));
      const currentMonday = mondayForOffset(0);
      setWeekOffset(Math.round((targetMonday.getTime() - currentMonday.getTime()) / (7 * 86_400_000)));
      await loadDojo();
    } catch (err) {
      setDojoError(err instanceof Error ? err.message : 'No se pudo crear el entrenamiento.');
    } finally {
      setTrainingBusy(false);
    }
  }

  const selectedPlayer =
    summary.players.find((p) => p.steamId === selectedSteamId) ?? summary.players[0] ?? null;
  const selectedPublic =
    publicPlayers.find((p) => p.steamId === (selectedPlayer?.steamId ?? selectedSteamId)) ?? null;
  const selectedPublicCA =
    selectedPublic?.modes.find((m) => m.gameType === 'CA') ?? selectedPublic?.modes[0] ?? null;


  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);
        const start = Math.floor(date.getTime() / 1000);
        const end = start + 86_400;
        return {
          date,
          events: dojo.filter((event) => event.startsAt >= start && event.startsAt < end),
        };
      }),
    [dojo, weekStart],
  );

  return (
    <div className="competitive-hub">
      <header className="competitive-hero">
        <div>
          <div className="competitive-kicker">SHAOLIN KUNG FU · DOJO</div>
          <h1>SkF Dojo</h1>
          <p>Entrenar. Competir. Evolucionar. La actividad deportiva y competitiva de SkF en un solo lugar.</p>
        </div>
        <div className="competitive-hero-actions">
          {summary.updatedAt && (
            <span className="competitive-updated">Actualizado {fmtDate(summary.updatedAt)}</span>
          )}
          {canRefresh && (
            <button className="mini" disabled={statsBusy} onClick={() => void refreshStats()}>
              {statsBusy ? 'Actualizando…' : '↻ QuakeClub'}
            </button>
          )}
        </div>
      </header>

      <nav className="competitive-tabs" aria-label="SkF Dojo">
        {([
          ['overview', 'Resumen'],
          ['players', 'Guerreros'],
          ['matches', 'Partidas'],
          ['wars', 'Wars'],
          ['tournaments', 'Torneos'],
          ['training', 'Entrenamiento'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {statsError && <div className="competitive-alert">{statsError}</div>}
      {loading ? (
        <div className="loading">Cargando SkF Dojo…</div>
      ) : (
        <>
          {tab === 'overview' && (
            <DojoOverview
              summary={summary}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekEvents={weekEvents}
              upcomingEvents={upcomingEvents}
              tournaments={tournaments}
              canViewEvents={canViewDojo}
              onWeekOffset={(delta) => setWeekOffset((v) => v + delta)}
              onToday={() => setWeekOffset(0)}
              onAvailability={(eventId, availability) => void setAvailability(eventId, availability)}
              onOpenTraining={() => { setTab('training'); if (canManageDojo) setShowCreate(true); }}
              onOpenMatches={() => setTab('matches')}
              onOpenPlayers={() => setTab('players')}
              onOpenWars={() => setTab('wars')}
              onOpenTournaments={() => setTab('tournaments')}
            />
          )}

          {tab === 'matches' && (
            <section className="competitive-panel">
              <div className="competitive-section-head">
                <div><span>HISTORIAL</span><h2>Partidas SkF</h2></div>
                <small>Últimas {summary.recentMatches.length} guardadas</small>
              </div>
              <div className="competitive-match-list is-full">
                {summary.recentMatches.map((match) => <MatchRow key={match.id} match={match} />)}
                {!summary.recentMatches.length && <p className="muted">El collector todavía no encontró partidas SkF.</p>}
              </div>
            </section>
          )}

          {tab === 'players' && (
            <div className="competitive-players-layout">
              <section className="competitive-panel">
                <div className="competitive-section-head">
                  <div><span>GUERREROS</span><h2>Ranking</h2></div>
                </div>
                <PlayerTable players={summary.players} onSelect={setSelectedSteamId} />
              </section>

              <aside className="competitive-player-card">
                {selectedPlayer ? (
                  <>
                    <div className="competitive-player-head">
                      <span>{selectedPlayer.clan || 'SkF'}</span>
                      <h2>{selectedPlayer.name}</h2>
                      <FormDots form={selectedPlayer.recentForm} />
                    </div>
                    <div className="competitive-player-kpis">
                      <div><span>PARTIDAS</span><strong>{selectedPlayer.appearances}</strong></div>
                      <div><span>WIN RATE</span><strong>{selectedPlayer.winRate}%</strong></div>
                      <div><span>K/D</span><strong>{selectedPlayer.kd}</strong></div>
                      <div><span>PERF.</span><strong>{selectedPlayer.avgPerformance}</strong></div>
                      <div><span>KILLS</span><strong>{fmtNumber(selectedPlayer.kills)}</strong></div>
                      <div><span>ELO Δ</span><strong>{selectedPlayer.eloChange > 0 ? '+' : ''}{selectedPlayer.eloChange}</strong></div>
                    </div>
                    <div className="competitive-player-weapons">
                      {selectedPlayer.weapons.slice(0, 5).map((w) => (
                        <div key={w.weapon}>
                          <span>{w.weapon}</span>
                          <strong>{w.accuracy}%</strong>
                          <small>{w.kills} kills · {fmtNumber(w.damage)} dmg</small>
                        </div>
                      ))}
                    </div>
                    <div className="competitive-benchmark-card">
                      <span>SKF vs PUBLIC ARENA</span>
                      {selectedPublicCA ? (
                        <>
                          <div><small>SkF K/D</small><strong>{selectedPlayer.kd}</strong></div>
                          <div><small>Public {selectedPublicCA.gameType}</small><strong>{selectedPublicCA.kd ?? 'N/A'}</strong></div>
                          <div><small>Public ELO</small><strong>{selectedPublicCA.rating != null ? Math.round(selectedPublicCA.rating) : '—'}</strong></div>
                          <div><small>Public W%</small><strong>{selectedPublicCA.winRate}%</strong></div>
                        </>
                      ) : (
                        <p className="muted small">Vincula SteamID64 en el perfil para activar el benchmark público.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="muted">Selecciona un guerrero.</p>
                )}
              </aside>
            </div>
          )}

          {tab === 'wars' && <MatchRoomsTab managementMode={managementMode} />}

          {tab === 'tournaments' && <Tournaments />}

          {tab === 'training' && (
            <div className="competitive-stack">
              <section className="competitive-dojo-head">
                <div>
                  <div className="competitive-kicker">ENTRENAMIENTO · PLAN SEMANAL</div>
                  <h2>
                    {new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(weekStart)}
                    {' — '}
                    {new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(weekEnd.getTime() - 1))}
                  </h2>
                </div>
                <div className="competitive-dojo-actions">
                  <button className="mini" onClick={() => setWeekOffset((v) => v - 1)}>‹</button>
                  <button className="mini" onClick={() => setWeekOffset(0)}>Esta semana</button>
                  <button className="mini" onClick={() => setWeekOffset((v) => v + 1)}>›</button>
                  {canManageDojo && (
                    <button className="primary small" onClick={() => setShowCreate((v) => !v)}>
                      {showCreate ? 'Cerrar' : '+ Entrenamiento'}
                    </button>
                  )}
                </div>
              </section>

              {dojoError && <div className="competitive-alert">{dojoError}</div>}

              {showCreate && canManageDojo && (
                <section className="competitive-panel competitive-dojo-form">
                  <div className="competitive-section-head">
                    <div><span>NUEVA SESIÓN</span><h2>Agendar entrenamiento</h2></div>
                  </div>
                  <div className="competitive-form-grid">
                    <label>
                      Objetivo
                      <input value={trainingName} onChange={(e) => setTrainingName(e.target.value)} placeholder="CA Teamplay" />
                    </label>
                    <label>
                      Fecha
                      <input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} />
                    </label>
                    <label>
                      Hora
                      <input type="time" value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} />
                    </label>
                    <label>
                      Duración
                      <select value={trainingDuration} onChange={(e) => setTrainingDuration(Number(e.target.value))}>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                      </select>
                    </label>
                    <label>
                      Repetición
                      <select value={trainingRecurrence} onChange={(e) => setTrainingRecurrence(e.target.value as Recurrence)}>
                        <option value="none">Una vez</option>
                        <option value="weekly">Semanal</option>
                        <option value="biweekly">Cada 2 semanas</option>
                        <option value="daily">Diario</option>
                      </select>
                    </label>
                    <label>
                      Lugar
                      <input value={trainingLocation} onChange={(e) => setTrainingLocation(e.target.value)} />
                    </label>
                    <label className="is-wide">
                      Foco / notas
                      <textarea rows={3} value={trainingNotes} onChange={(e) => setTrainingNotes(e.target.value)} placeholder="Rotaciones, focus fire, mapas, etc." />
                    </label>
                  </div>
                  <button className="primary" disabled={trainingBusy} onClick={() => void createTraining()}>
                    {trainingBusy ? 'Creando…' : 'Crear y publicar en Discord'}
                  </button>
                </section>
              )}

              {!canViewDojo ? (
                <div className="competitive-panel"><p className="muted">Tu rol no tiene acceso al calendario de entrenamientos.</p></div>
              ) : dojoLoading ? (
                <div className="loading">Cargando semana…</div>
              ) : (
                <section className="competitive-week">
                  {days.map(({ date, events }) => (
                    <div className="competitive-day" key={date.toISOString()}>
                      <header>
                        <span>{new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(date)}</span>
                        <strong>{date.getDate()}</strong>
                      </header>
                      <div className="competitive-day-body">
                        {events.map((event) => {
                          const counts = event.availabilityCounts ?? {
                            available: event.signupCount,
                            tentative: 0,
                            unavailable: 0,
                          };
                          return (
                            <article className="dojo-card" key={event.id}>
                              <time>{fmtTime(event.startsAt)}</time>
                              <h3>{stripDojo(event.title)}</h3>
                              {event.description && <p>{event.description}</p>}
                              <small>{event.location}</small>
                              <div className="dojo-counts">
                                <span className="available">{counts.available} ✓</span>
                                <span className="tentative">{counts.tentative} ?</span>
                                <span className="unavailable">{counts.unavailable} ×</span>
                              </div>
                              <button
                                type="button"
                                className="share-whatsapp"
                                onClick={() =>
                                  shareActivityWhatsApp({
                                    title: stripDojo(event.title),
                                    startsAt: event.startsAt,
                                    endsAt: event.endsAt,
                                    location: event.location,
                                    description: event.description,
                                    path: '/competitive',
                                    label: 'Entrenamiento · ' + stripDojo(event.title),
                                  })
                                }
                              >
                                Compartir por WhatsApp
                              </button>
                              <div className="dojo-rsvp">
                                <button
                                  className={event.mySignup?.availability === 'available' ? 'active available' : ''}
                                  onClick={() => void setAvailability(event.id, 'available')}
                                  title="Disponible"
                                >✓</button>
                                <button
                                  className={event.mySignup?.availability === 'tentative' ? 'active tentative' : ''}
                                  onClick={() => void setAvailability(event.id, 'tentative')}
                                  title="Por confirmar"
                                >?</button>
                                <button
                                  className={event.mySignup?.availability === 'unavailable' ? 'active unavailable' : ''}
                                  onClick={() => void setAvailability(event.id, 'unavailable')}
                                  title="No puedo"
                                >×</button>
                              </div>
                              {canManageDojo && (
                                <button className="dojo-cancel" onClick={() => void cancelTraining(event.id)}>
                                  Cancelar
                                </button>
                              )}
                            </article>
                          );
                        })}
                        {!events.length && <span className="competitive-empty-day">—</span>}
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
