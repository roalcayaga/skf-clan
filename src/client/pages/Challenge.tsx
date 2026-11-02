import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Challenge() {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const minDate = useMemo(() => localInputValue(new Date(Date.now() + 10 * 60 * 1000)), []);
  const [form, setForm] = useState({
    clanName: '',
    contactName: '',
    contactDiscord: '',
    contactEmail: '',
    mode: 'CA',
    teamSize: '4v4',
    preferred: '',
    alternate: '',
    notes: '',
    website: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/scrims', {
        clanName: form.clanName,
        contactName: form.contactName,
        contactDiscord: form.contactDiscord,
        contactEmail: form.contactEmail || undefined,
        mode: form.mode,
        teamSize: form.teamSize,
        preferredAt: form.preferred ? Math.floor(new Date(form.preferred).getTime() / 1000) : 0,
        alternateAt: form.alternate ? Math.floor(new Date(form.alternate).getTime() / 1000) : null,
        timezone,
        notes: form.notes,
        website: form.website,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar el desafío.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="public-action-page">
        <div className="public-action-card success">
          <div className="public-action-kicker">DESAFÍO RECIBIDO</div>
          <h1>El Dragón acepta invitaciones.</h1>
          <p>
            Tu solicitud quedó en manos de SkF. Revisaremos fecha, formato y disponibilidad antes de confirmar el scrim.
          </p>
          <div className="public-action-actions">
            <Link className="btn-cta primary" to="/">Volver al Templo</Link>
            <Link className="btn-cta" to="/history">Conocer la historia de SkF</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="public-action-page">
      <header className="public-action-hero">
        <div className="public-action-kicker">SCRIM · PCW · FRIENDLY</div>
        <h1>Desafía a SkF</h1>
        <p>
          ¿Tu clan quiere entrenar contra Shaolin Kung Fu? Propón el partido y coordinamos formato, fecha y servidor.
        </p>
      </header>

      <form className="public-action-card public-action-form" onSubmit={submit}>
        <div className="public-action-grid">
          <label>
            Clan / equipo
            <input required maxLength={80} value={form.clanName} onChange={(e) => set('clanName', e.target.value)} placeholder="Nombre del clan" />
          </label>
          <label>
            Contacto
            <input required maxLength={80} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Tu nick o nombre" />
          </label>
          <label>
            Discord
            <input required maxLength={100} value={form.contactDiscord} onChange={(e) => set('contactDiscord', e.target.value)} placeholder="@usuario" />
          </label>
          <label>
            Email <span className="muted">(opcional)</span>
            <input type="email" maxLength={160} value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="contacto@clan.gg" />
          </label>
          <label>
            Modo
            <select value={form.mode} onChange={(e) => set('mode', e.target.value)}>
              <option value="CA">Clan Arena</option>
              <option value="CTF">Capture the Flag</option>
              <option value="TDM">Team Deathmatch</option>
              <option value="DUEL">Duel</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label>
            Formato
            <select value={form.teamSize} onChange={(e) => set('teamSize', e.target.value)}>
              <option value="2v2">2v2</option>
              <option value="3v3">3v3</option>
              <option value="4v4">4v4</option>
              <option value="5v5">5v5</option>
              <option value="1v1">1v1</option>
            </select>
          </label>
          <label>
            Fecha propuesta
            <input required type="datetime-local" min={minDate} value={form.preferred} onChange={(e) => set('preferred', e.target.value)} />
          </label>
          <label>
            Fecha alternativa <span className="muted">(opcional)</span>
            <input type="datetime-local" min={minDate} value={form.alternate} onChange={(e) => set('alternate', e.target.value)} />
          </label>
        </div>

        <label className="public-action-wide">
          Notas
          <textarea
            rows={5}
            maxLength={1500}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Map pool, servidor, país, horarios, reglas o cualquier dato útil."
          />
        </label>

        <label className="scrim-honeypot" aria-hidden>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </label>

        <div className="public-action-meta">Zona horaria detectada: {timezone}</div>
        {error && <div className="alert">{error}</div>}

        <div className="public-action-actions">
          <button className="btn-cta primary" type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar desafío'}
          </button>
          <Link className="btn-cta ghost" to="/">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
