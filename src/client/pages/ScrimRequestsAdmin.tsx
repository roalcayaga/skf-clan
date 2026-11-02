import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface ScrimRequest {
  id: number;
  clanName: string;
  contactName: string;
  contactDiscord: string;
  contactEmail: string | null;
  mode: string;
  teamSize: string;
  preferredAt: number;
  alternateAt: number | null;
  timezone: string;
  notes: string | null;
  status: 'pending' | 'contacted' | 'scheduled' | 'declined';
  eventId: number | null;
  createdAt: number;
}

const STATUS_LABEL: Record<ScrimRequest['status'], string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  scheduled: 'Agendado',
  declined: 'Rechazado',
};

export default function ScrimRequestsAdmin() {
  const [requests, setRequests] = useState<ScrimRequest[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ requests: ScrimRequest[] }>('/scrims')
      .then((d) => setRequests(d.requests))
      .catch(() => setRequests([]));

  useEffect(() => {
    void load();
  }, []);

  async function update(id: number, patch: { status?: ScrimRequest['status']; eventId?: number | null }) {
    setBusy(id);
    setMessage(null);
    try {
      await api.patch(`/scrims/${id}`, patch);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo actualizar la solicitud.');
    } finally {
      setBusy(null);
    }
  }

  async function schedule(req: ScrimRequest, startsAt: number) {
    setBusy(req.id);
    setMessage(null);
    try {
      const created = await api.post<{ event: { id: number } }>('/events', {
        title: `Scrim vs ${req.clanName}`,
        description: [
          `${req.mode} ${req.teamSize}`,
          `Contacto rival: ${req.contactName} · Discord: ${req.contactDiscord}`,
          req.contactEmail ? `Email: ${req.contactEmail}` : '',
          req.notes || '',
        ].filter(Boolean).join('\n'),
        startsAt,
        endsAt: startsAt + 90 * 60,
        location: 'Servidor SkF · Quake Live',
        recurrence: 'none',
        shareAlliance: false,
      });
      await api.patch(`/scrims/${req.id}`, { status: 'scheduled', eventId: created.event.id });
      setMessage(`Scrim vs ${req.clanName} agendado y convertido en evento.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo agendar el scrim.');
    } finally {
      setBusy(null);
    }
  }

  if (!requests) return <div className="loading">Loading…</div>;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Scrims / PCW</h2>
      </header>
      <p className="muted small">
        Desafíos enviados desde la web pública. Al agendar uno se crea un evento normal de SkF y entra al calendario + Discord.
      </p>

      {message && <div className="notice">{message}</div>}

      {requests.length === 0 ? (
        <p className="empty">No hay desafíos pendientes.</p>
      ) : (
        <ul className="scrim-admin-list">
          {requests.map((req) => (
            <li key={req.id} className={`scrim-admin-card status-${req.status}`}>
              <div className="scrim-admin-head">
                <div>
                  <span className="scrim-admin-kicker">{req.mode} · {req.teamSize}</span>
                  <h3>{req.clanName}</h3>
                </div>
                <span className={`status-chip status-${req.status}`}>{STATUS_LABEL[req.status]}</span>
              </div>

              <div className="scrim-admin-grid">
                <div>
                  <span>Contacto</span>
                  <strong>{req.contactName}</strong>
                  <small>Discord: {req.contactDiscord}</small>
                  {req.contactEmail && <small>{req.contactEmail}</small>}
                </div>
                <div>
                  <span>Fecha propuesta</span>
                  <strong>{new Date(req.preferredAt * 1000).toLocaleString('es-CL')}</strong>
                  <small>{req.timezone}</small>
                </div>
                <div>
                  <span>Alternativa</span>
                  <strong>{req.alternateAt ? new Date(req.alternateAt * 1000).toLocaleString('es-CL') : '—'}</strong>
                  <small>Recibido {new Date(req.createdAt * 1000).toLocaleDateString('es-CL')}</small>
                </div>
              </div>

              {req.notes && <p className="scrim-admin-notes">{req.notes}</p>}

              <div className="scrim-admin-actions">
                {req.status !== 'contacted' && req.status !== 'scheduled' && (
                  <button type="button" disabled={busy === req.id} onClick={() => void update(req.id, { status: 'contacted' })}>
                    Marcar contactado
                  </button>
                )}
                {req.status !== 'scheduled' && (
                  <button className="primary" type="button" disabled={busy === req.id} onClick={() => void schedule(req, req.preferredAt)}>
                    Agendar fecha propuesta
                  </button>
                )}
                {req.status !== 'scheduled' && req.alternateAt && (
                  <button type="button" disabled={busy === req.id} onClick={() => void schedule(req, req.alternateAt!)}>
                    Agendar alternativa
                  </button>
                )}
                {req.status !== 'declined' && req.status !== 'scheduled' && (
                  <button className="ghost danger" type="button" disabled={busy === req.id} onClick={() => void update(req.id, { status: 'declined' })}>
                    Rechazar
                  </button>
                )}
                {req.eventId && <Link className="btn-link" to={`/events?event=${req.eventId}`}>Ver evento →</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
