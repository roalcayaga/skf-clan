import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

type Availability = 'available' | 'tentative' | 'unavailable';
type Slot = 'starter' | 'sub' | 'reserve';

interface Room {
  id: number;
  eventId: number;
  rivalId: number;
  rival: string;
  rivalTag: string | null;
  rivalNotes: string | null;
  format: string;
  mapPool: string[] | null;
  status: 'scheduled' | 'played' | 'cancelled';
  quakeMatchId: string | null;
  scoreUs: number | null;
  scoreThem: number | null;
  report: string | null;
  notes: string | null;
  startsAt: number;
  endsAt: number;
  location: string;
  lineup: { roomId: number; userId: number; slot: Slot; role: string | null; name: string }[];
  demos: { id: number; name: string; bytes: number; notes: string | null; createdAt: number }[];
  availabilityCounts: { available: number; tentative: number; unavailable: number };
  myAvailability: Availability | null;
}

interface Rival {
  id: number;
  name: string;
  tag: string | null;
  notes: string | null;
  meetings: number;
  wins: number;
  losses: number;
  draws: number;
}

interface Member {
  id: number;
  displayName: string | null;
  globalName: string | null;
  username: string;
  status: string;
}

function fmt(unix: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000));
}

function bytes(value: number): string {
  if (value < 1_000_000) return Math.max(1, Math.round(value / 1000)) + ' KB';
  return (value / 1_000_000).toFixed(1) + ' MB';
}

function memberName(m: Member): string {
  return m.displayName || m.globalName || m.username;
}

function RoomCard({
  room,
  canManage,
  members,
  reload,
}: {
  room: Room;
  canManage: boolean;
  members: Member[];
  reload: () => Promise<void>;
}) {
  const [scoreUs, setScoreUs] = useState(room.scoreUs == null ? '' : String(room.scoreUs));
  const [scoreThem, setScoreThem] = useState(room.scoreThem == null ? '' : String(room.scoreThem));
  const [report, setReport] = useState(room.report ?? '');
  const [lineupUser, setLineupUser] = useState('');
  const [slot, setSlot] = useState<Slot>('starter');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function rsvp(availability: Availability) {
    setBusy(true);
    try {
      await api.post('/events/' + room.eventId + '/signup', { roleId: null, availability });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function linkNearest() {
    setBusy(true);
    setNotice(null);
    try {
      const data = await api.post<{ report?: string }>('/matchrooms/' + room.id + '/link-nearest');
      if (data.report) setReport(data.report);
      setNotice('Partida vinculada y crónica generada.');
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se encontró una partida cercana.');
    } finally {
      setBusy(false);
    }
  }

  async function saveResult() {
    setBusy(true);
    try {
      await api.patch('/matchrooms/' + room.id, {
        status: 'played',
        scoreUs: scoreUs === '' ? null : Number(scoreUs),
        scoreThem: scoreThem === '' ? null : Number(scoreThem),
        report: report.trim() || null,
      });
      setNotice('Resultado guardado.');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addLineup() {
    if (!lineupUser) return;
    setBusy(true);
    try {
      await api.post('/matchrooms/' + room.id + '/lineup', {
        userId: Number(lineupUser),
        slot,
      });
      setLineupUser('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removeLineup(userId: number) {
    setBusy(true);
    try {
      await api.del('/matchrooms/' + room.id + '/lineup/' + userId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function uploadDemo(file: File) {
    setBusy(true);
    setNotice(null);
    try {
      await api.upload('/matchrooms/' + room.id + '/demo', file);
      setNotice('Demo guardado en el Vault.');
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo subir el demo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={'match-room-card is-' + room.status}>
      <header>
        <div>
          <span className="match-room-kicker">{room.status === 'scheduled' ? 'PRÓXIMO WAR' : 'MATCH ROOM'}</span>
          <h3>SkF vs {room.rivalTag ? room.rivalTag + ' · ' : ''}{room.rival}</h3>
          <small>{fmt(room.startsAt)} · {room.format} · {room.location}</small>
        </div>
        {room.scoreUs != null && room.scoreThem != null ? (
          <div className="match-room-score"><strong>{room.scoreUs}</strong><span>:</span><strong>{room.scoreThem}</strong></div>
        ) : (
          <span className="match-room-status">{room.status}</span>
        )}
      </header>

      {room.mapPool && room.mapPool.length > 0 && (
        <div className="match-room-maps">
          <span>MAP POOL</span>
          {room.mapPool.map((map) => <b key={map}>{map}</b>)}
        </div>
      )}

      <div className="match-room-rsvp">
        <div>
          <span className="available">{room.availabilityCounts.available} ✓</span>
          <span className="tentative">{room.availabilityCounts.tentative} ?</span>
          <span className="unavailable">{room.availabilityCounts.unavailable} ×</span>
        </div>
        <div>
          <button disabled={busy} className={room.myAvailability === 'available' ? 'active available' : ''} onClick={() => void rsvp('available')}>✓ Disponible</button>
          <button disabled={busy} className={room.myAvailability === 'tentative' ? 'active tentative' : ''} onClick={() => void rsvp('tentative')}>? Quizás</button>
          <button disabled={busy} className={room.myAvailability === 'unavailable' ? 'active unavailable' : ''} onClick={() => void rsvp('unavailable')}>× No puedo</button>
        </div>
      </div>

      <div className="match-room-lineup">
        <span>LINEUP</span>
        {room.lineup.length ? (
          <div className="match-room-lineup-list">
            {room.lineup.map((p) => (
              <div key={p.userId}>
                <b>{p.name}</b>
                <small>{p.slot}{p.role ? ' · ' + p.role : ''}</small>
                {canManage && <button onClick={() => void removeLineup(p.userId)}>×</button>}
              </div>
            ))}
          </div>
        ) : <p className="muted small">Lineup todavía no definido.</p>}
        {canManage && members.length > 0 && (
          <div className="match-room-lineup-add">
            <select value={lineupUser} onChange={(e) => setLineupUser(e.target.value)}>
              <option value="">Agregar guerrero…</option>
              {members.filter((m) => !room.lineup.some((p) => p.userId === m.id) && m.status === 'active').map((m) => (
                <option key={m.id} value={m.id}>{memberName(m)}</option>
              ))}
            </select>
            <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
              <option value="starter">Starter</option>
              <option value="sub">Sub</option>
              <option value="reserve">Reserva</option>
            </select>
            <button disabled={!lineupUser || busy} onClick={() => void addLineup()}>Agregar</button>
          </div>
        )}
      </div>

      {(room.report || room.notes) && (
        <div className="match-room-report">
          <span>{room.report ? 'CRÓNICA' : 'NOTAS'}</span>
          <p>{room.report || room.notes}</p>
        </div>
      )}

      <div className="match-room-demos">
        <span>DEMO VAULT</span>
        {room.demos.length > 0 && (
          <ul>
            {room.demos.map((demo) => (
              <li key={demo.id}>
                <a href={'/api/matchrooms/' + room.id + '/demos/' + demo.id + '/download'}>{demo.name}</a>
                <small>{bytes(demo.bytes)}</small>
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <label className="match-room-upload">
            + Subir demo
            <input
              type="file"
              accept=".zip,.dm_68,.dm_73,.dm_90,.dm_91"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadDemo(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        )}
      </div>

      {canManage && (
        <div className="match-room-manage">
          <button disabled={busy} onClick={() => void linkNearest()}>↻ Vincular partida QuakeClub</button>
          <input inputMode="numeric" placeholder="SkF" value={scoreUs} onChange={(e) => setScoreUs(e.target.value.replace(/\D/g, ''))} />
          <span>:</span>
          <input inputMode="numeric" placeholder="Rival" value={scoreThem} onChange={(e) => setScoreThem(e.target.value.replace(/\D/g, ''))} />
          <textarea value={report} rows={2} placeholder="Crónica / resumen…" onChange={(e) => setReport(e.target.value)} />
          <button className="primary" disabled={busy} onClick={() => void saveResult()}>Guardar</button>
        </div>
      )}
      {notice && <p className="match-room-notice">{notice}</p>}
    </article>
  );
}

export default function MatchRoomsTab({ managementMode = false }: { managementMode?: boolean } = {}) {
  const { can } = useSession();
  const canView = can('events.view');
  const canManage = managementMode && can('events.manage');
  const canRoster = can('roster.view');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rival, setRival] = useState('');
  const [rivalTag, setRivalTag] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('22:00');
  const [format, setFormat] = useState('CA');
  const [maps, setMaps] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    if (!canView) return;
    const [roomData, rivalData] = await Promise.all([
      api.get<{ rooms: Room[] }>('/matchrooms'),
      api.get<{ rivals: Rival[] }>('/matchrooms/rivals'),
    ]);
    setRooms(roomData.rooms);
    setRivals(rivalData.rivals);
    if (canManage && canRoster) {
      const data = await api.get<{ members: Member[] }>('/members?limit=100&sort=name&dir=asc');
      setMembers(data.members);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [canView, canManage, canRoster]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createRoom() {
    const start = new Date(date + 'T' + time + ':00');
    if (!rival.trim() || Number.isNaN(start.getTime())) return;
    setBusy(true);
    try {
      await api.post('/matchrooms', {
        rivalName: rival.trim(),
        rivalTag: rivalTag.trim() || null,
        startsAt: Math.floor(start.getTime() / 1000),
        endsAt: Math.floor(start.getTime() / 1000) + 2 * 3600,
        location: 'Servidor SkF',
        format,
        mapPool: maps.split(/[,\n]/).map((v) => v.trim()).filter(Boolean),
        notes: notes.trim() || null,
      });
      setRival('');
      setRivalTag('');
      setMaps('');
      setNotes('');
      setShowCreate(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) return <div className="competitive-panel"><p className="muted">Tu rol no tiene acceso a Events / Match Room.</p></div>;
  if (loading) return <div className="loading">Cargando Match Room…</div>;

  const upcoming = rooms.filter((r) => r.status === 'scheduled').sort((a, b) => a.startsAt - b.startsAt);
  const history = rooms.filter((r) => r.status !== 'scheduled').sort((a, b) => b.startsAt - a.startsAt);

  return (
    <div className="competitive-stack match-room-tab">
      <section className="competitive-dojo-head">
        <div>
          <div className="competitive-kicker">WAR ROOM · SKF</div>
          <h2>Match Room</h2>
        </div>
        {canManage && (
          <button className="primary small" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cerrar' : '+ Nuevo war'}
          </button>
        )}
      </section>

      {showCreate && canManage && (
        <section className="competitive-panel">
          <div className="competitive-section-head"><div><span>CONVOCATORIA</span><h2>Crear Match Room</h2></div></div>
          <div className="competitive-form-grid">
            <label>Rival<input value={rival} onChange={(e) => setRival(e.target.value)} placeholder="Nombre del clan" /></label>
            <label>Tag<input value={rivalTag} onChange={(e) => setRivalTag(e.target.value)} placeholder="TAG" /></label>
            <label>Formato<select value={format} onChange={(e) => setFormat(e.target.value)}><option>CA</option><option>CTF</option><option>TDM</option><option>DUEL</option></select></label>
            <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>Hora<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            <label>Map pool<input value={maps} onChange={(e) => setMaps(e.target.value)} placeholder="campgrounds, asylum, ..." /></label>
            <label className="is-wide">Notas<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </div>
          <button className="primary" disabled={busy || !rival.trim()} onClick={() => void createRoom()}>
            {busy ? 'Creando…' : 'Crear + publicar en Discord'}
          </button>
        </section>
      )}

      <div className="match-room-layout">
        <section className="match-room-main">
          <div className="competitive-section-head"><div><span>PRÓXIMOS</span><h2>Convocatorias</h2></div></div>
          <div className="match-room-list">
            {upcoming.map((room) => <RoomCard key={room.id} room={room} canManage={canManage} members={members} reload={load} />)}
            {!upcoming.length && <div className="competitive-panel"><p className="muted">No hay wars agendados.</p></div>}
          </div>

          {history.length > 0 && (
            <>
              <div className="competitive-section-head match-room-history-head"><div><span>ARCHIVO</span><h2>Wars anteriores</h2></div></div>
              <div className="match-room-list">
                {history.slice(0, 20).map((room) => <RoomCard key={room.id} room={room} canManage={canManage} members={members} reload={load} />)}
              </div>
            </>
          )}
        </section>

        <aside className="competitive-panel rival-intel">
          <div className="competitive-section-head"><div><span>RIVAL INTEL</span><h2>Historial</h2></div></div>
          {rivals.length ? (
            <div className="rival-intel-list">
              {rivals.map((r) => (
                <div key={r.id}>
                  <span><strong>{r.tag || r.name}</strong><small>{r.tag ? r.name : ''}</small></span>
                  <b>{r.wins}W / {r.losses}L{r.draws ? ' / ' + r.draws + 'D' : ''}</b>
                  <small>{r.meetings} cruces</small>
                  {r.notes && <p>{r.notes}</p>}
                </div>
              ))}
            </div>
          ) : <p className="muted">El historial de rivales comenzará con el primer Match Room.</p>}
        </aside>
      </div>
    </div>
  );
}
