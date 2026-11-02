import { Link } from 'react-router-dom';
import type { CompetitiveSummary } from '../../shared/competitive';
import type { TournamentSummary } from '../lib/tournaments';
import { shareActivityWhatsApp } from '../lib/share';

type Availability = 'available' | 'tentative' | 'unavailable';

export interface DojoScheduleEvent {
  id: number;
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number;
  location: string;
  signupCount: number;
  availabilityCounts?: {
    available: number;
    tentative: number;
    unavailable: number;
  };
  mySignup: { roleId: number | null; availability: Availability } | null;
}

type ActivityKind = 'training' | 'war' | 'tournament' | 'event';

function kindForEvent(title: string): ActivityKind {
  if (/^DOJO\s*[·:-]/i.test(title)) return 'training';
  if (/^WAR\s*[·:-]/i.test(title)) return 'war';
  return 'event';
}

function titleForEvent(title: string): string {
  return title
    .replace(/^DOJO\s*[·:-]\s*/i, '')
    .replace(/^WAR\s*[·:-]\s*/i, '')
    .trim();
}

function kindLabel(kind: ActivityKind): string {
  if (kind === 'training') return 'ENTRENAMIENTO';
  if (kind === 'war') return 'WAR';
  if (kind === 'tournament') return 'TORNEO';
  return 'ACTIVIDAD';
}

function fmtDate(unix: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function fmtTime(unix: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(date);
}

function mobileDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const delta = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (delta === 0) return 'HOY';
  if (delta === 1) return 'MAÑANA';
  return new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(date).toUpperCase();
}

function monthDay(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(date);
}

export default function DojoOverview({
  summary,
  weekStart,
  weekEnd,
  weekEvents,
  upcomingEvents,
  tournaments,
  canViewEvents,
  onWeekOffset,
  onToday,
  onAvailability,
  onOpenTraining,
  onOpenMatches,
  onOpenPlayers,
  onOpenWars,
  onOpenTournaments,
}: {
  summary: CompetitiveSummary;
  weekStart: Date;
  weekEnd: Date;
  weekEvents: DojoScheduleEvent[];
  upcomingEvents: DojoScheduleEvent[];
  tournaments: TournamentSummary[];
  canViewEvents: boolean;
  onWeekOffset: (delta: number) => void;
  onToday: () => void;
  onAvailability: (eventId: number, availability: Availability) => void;
  onOpenTraining: () => void;
  onOpenMatches: () => void;
  onOpenPlayers: () => void;
  onOpenWars: () => void;
  onOpenTournaments: () => void;
}) {
  const weekStartSec = Math.floor(weekStart.getTime() / 1000);
  const weekEndSec = Math.floor(weekEnd.getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const weekTournaments = tournaments.filter(
    (t) => t.startsAt != null && t.startsAt >= weekStartSec && t.startsAt < weekEndSec && t.status !== 'complete',
  );

  const futureActivities = [
    ...upcomingEvents
      .filter((e) => e.endsAt >= nowSec)
      .map((event) => ({
        key: 'e:' + event.id,
        kind: kindForEvent(event.title),
        title: titleForEvent(event.title),
        startsAt: event.startsAt,
        location: event.location,
        event,
        tournament: null as TournamentSummary | null,
      })),
    ...tournaments
      .filter((t) => t.startsAt != null && t.startsAt >= nowSec && t.status !== 'complete')
      .map((t) => ({
        key: 't:' + t.id,
        kind: 'tournament' as ActivityKind,
        title: t.name,
        startsAt: t.startsAt!,
        location: t.gameName || 'SkF',
        event: null as DojoScheduleEvent | null,
        tournament: t,
      })),
  ].sort((a, b) => a.startsAt - b.startsAt);

  const next = futureActivities[0] ?? null;
  const trainings = weekEvents.filter((e) => kindForEvent(e.title) === 'training').length;
  const wars = weekEvents.filter((e) => kindForEvent(e.title) === 'war').length;
  const allResponses = weekEvents.reduce((sum, e) => {
    const c = e.availabilityCounts;
    return sum + (c ? c.available + c.tentative + c.unavailable : e.signupCount);
  }, 0);
  const availableResponses = weekEvents.reduce(
    (sum, e) => sum + (e.availabilityCounts?.available ?? e.signupCount),
    0,
  );
  const attendanceRate = allResponses ? Math.round((availableResponses / allResponses) * 100) : 0;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const start = Math.floor(date.getTime() / 1000);
    const end = start + 86_400;
    return {
      date,
      events: weekEvents.filter((e) => e.startsAt >= start && e.startsAt < end),
      tournaments: weekTournaments.filter((t) => t.startsAt != null && t.startsAt >= start && t.startsAt < end),
    };
  });

  return (
    <div className="competitive-stack dojo-overview">
      <section className="dojo-next-activity">
        <div className="dojo-next-label">PRÓXIMA ACTIVIDAD</div>
        {next ? (
          <div className="dojo-next-grid">
            <div>
              <span className={'dojo-kind is-' + next.kind}>{kindLabel(next.kind)}</span>
              <h2>{next.title}</h2>
              <p>{fmtDate(next.startsAt)} · {next.location}</p>
            </div>

            {next.event && (
              <div className="dojo-next-rsvp">
                <button
                  type="button"
                  className="share-whatsapp"
                  onClick={() =>
                    shareActivityWhatsApp({
                      title: next.title,
                      startsAt: next.event!.startsAt,
                      endsAt: next.event!.endsAt,
                      location: next.event!.location,
                      description: next.event!.description,
                      path: '/competitive',
                      label: kindLabel(next.kind) + ' · ' + next.title,
                    })
                  }
                >
                  Compartir por WhatsApp
                </button>
                <div>
                  <span className="available">{next.event.availabilityCounts?.available ?? next.event.signupCount} ✓</span>
                  <span className="tentative">{next.event.availabilityCounts?.tentative ?? 0} ?</span>
                  <span className="unavailable">{next.event.availabilityCounts?.unavailable ?? 0} ×</span>
                </div>
                <div>
                  <button
                    className={next.event.mySignup?.availability === 'available' ? 'active available' : ''}
                    onClick={() => onAvailability(next.event!.id, 'available')}
                  >✓ Disponible</button>
                  <button
                    className={next.event.mySignup?.availability === 'tentative' ? 'active tentative' : ''}
                    onClick={() => onAvailability(next.event!.id, 'tentative')}
                  >? Quizás</button>
                  <button
                    className={next.event.mySignup?.availability === 'unavailable' ? 'active unavailable' : ''}
                    onClick={() => onAvailability(next.event!.id, 'unavailable')}
                  >× No puedo</button>
                </div>
              </div>
            )}

            {next.tournament && (
              <Link className="dojo-next-link" to={'/tournaments/' + next.tournament.slug}>
                Abrir torneo →
              </Link>
            )}
          </div>
        ) : (
          <p className="muted">No hay actividad programada en los próximos días.</p>
        )}
      </section>

      <section className="dojo-calendar-panel">
        <header className="dojo-calendar-head">
          <div>
            <span>CALENDARIO DEL DOJO</span>
            <h2>{monthDay(weekStart)} — {monthDay(new Date(weekEnd.getTime() - 1))}</h2>
          </div>
          <div className="competitive-dojo-actions">
            <button className="mini" onClick={() => onWeekOffset(-1)}>‹</button>
            <button className="mini" onClick={onToday}>Esta semana</button>
            <button className="mini" onClick={() => onWeekOffset(1)}>›</button>
            <button className="primary small" onClick={onOpenTraining}>+ Entrenamiento</button>
          </div>
        </header>

        {!canViewEvents ? (
          <p className="muted">Tu rol no tiene acceso al calendario de actividades.</p>
        ) : (
          <div className="dojo-master-week">
            {days.map(({ date, events, tournaments: dayTournaments }) => (
              <div
                className={'dojo-master-day' + (events.length || dayTournaments.length ? ' has-activity' : ' is-empty')}
                key={date.toISOString()}
              >
                <header>
                  <span className="dojo-day-desktop">{dayLabel(date)}</span>
                  <span className="dojo-day-mobile">{mobileDayLabel(date)}</span>
                  <strong>{date.getDate()}</strong>
                </header>
                <div>
                  {events.map((event) => {
                    const kind = kindForEvent(event.title);
                    const counts = event.availabilityCounts ?? {
                      available: event.signupCount,
                      tentative: 0,
                      unavailable: 0,
                    };
                    return (
                      <article className={'dojo-master-card is-' + kind} key={'e:' + event.id}>
                        <span>{kindLabel(kind)}</span>
                        <time>{fmtTime(event.startsAt)}</time>
                        <h3>{titleForEvent(event.title)}</h3>
                        <small>{event.location}</small>
                        <div className="dojo-master-counts">
                          <b>{counts.available} ✓</b>
                          {counts.tentative > 0 && <b>{counts.tentative} ?</b>}
                        </div>
                        <button
                          type="button"
                          className="dojo-card-share"
                          onClick={() =>
                            shareActivityWhatsApp({
                              title: titleForEvent(event.title),
                              startsAt: event.startsAt,
                              endsAt: event.endsAt,
                              location: event.location,
                              description: event.description,
                              path: '/competitive',
                              label: kindLabel(kind) + ' · ' + titleForEvent(event.title),
                            })
                          }
                        >
                          Compartir
                        </button>
                      </article>
                    );
                  })}
                  {dayTournaments.map((t) => (
                    <Link className="dojo-master-card is-tournament" key={'t:' + t.id} to={'/tournaments/' + t.slug}>
                      <span>TORNEO</span>
                      <time>{t.startsAt ? fmtTime(t.startsAt) : ''}</time>
                      <h3>{t.name}</h3>
                      <small>{t.entrantCount} {t.competitorType === 'team' ? 'equipos' : 'participantes'}</small>
                    </Link>
                  ))}
                  {!events.length && !dayTournaments.length && <i>Sin actividad</i>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dojo-legend">
          <span className="is-training">Entrenamiento</span>
          <span className="is-war">War</span>
          <span className="is-tournament">Torneo</span>
          <span className="is-event">Otro</span>
        </div>
      </section>

      <section className="dojo-week-pulse">
        <div><span>ENTRENAMIENTOS</span><strong>{trainings}</strong></div>
        <div><span>WARS</span><strong>{wars}</strong></div>
        <div><span>TORNEOS</span><strong>{weekTournaments.length}</strong></div>
        <div><span>DISPONIBILIDAD</span><strong>{attendanceRate ? attendanceRate + '%' : '—'}</strong></div>
      </section>

      <div className="competitive-two-col">
        <section className="competitive-panel">
          <div className="competitive-section-head">
            <div><span>ÚLTIMAS PARTIDAS</span><h2>Actividad reciente</h2></div>
            <button className="link-btn" onClick={onOpenMatches}>Ver todas</button>
          </div>
          <div className="dojo-recent-list">
            {summary.recentMatches.slice(0, 5).map((match) => (
              <div key={match.id}>
                <b className={'is-' + (match.clanResult || 'draw')}>
                  {match.clanResult === 'win' ? 'W' : match.clanResult === 'loss' ? 'L' : 'D'}
                </b>
                <span><strong>{match.map}</strong><small>{match.gameType || 'QL'} · {match.clanPlayers.join(' · ')}</small></span>
                <em>{match.scoreUs != null && match.scoreThem != null ? match.scoreUs + ':' + match.scoreThem : '—'}</em>
              </div>
            ))}
            {!summary.recentMatches.length && <p className="muted">Aún no hay partidas guardadas.</p>}
          </div>
        </section>

        <section className="competitive-panel">
          <div className="competitive-section-head">
            <div><span>ESTADO DEL DOJO</span><h2>Guerreros</h2></div>
            <button className="link-btn" onClick={onOpenPlayers}>Ver ranking</button>
          </div>
          <div className="competitive-mini-ranking">
            {summary.players.slice(0, 5).map((p, i) => (
              <button key={p.steamId} onClick={onOpenPlayers}>
                <b>{i + 1}</b>
                <span><strong>{p.name}</strong><small>{p.appearances} partidas · K/D {p.kd}</small></span>
                <em>{p.avgPerformance}</em>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="dojo-shortcuts">
        <button onClick={onOpenTraining}><span>ENTRENAR</span><strong>Entrenamiento</strong><small>Sesiones, RSVP y foco semanal</small></button>
        <button onClick={onOpenWars}><span>COMBATIR</span><strong>Wars</strong><small>Match Room, lineup y rivales</small></button>
        <button onClick={onOpenTournaments}><span>COMPETIR</span><strong>Torneos</strong><small>Brackets, standings y campeones</small></button>
      </section>
    </div>
  );
}
