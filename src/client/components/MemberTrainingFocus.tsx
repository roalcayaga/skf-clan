import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import './home-pulse.css';

interface Goal {
  userId: number;
  focus: string | null;
  target: string | null;
  notes: string | null;
  baseline: Record<string, unknown> | null;
  startedAt: number;
  updatedAt: number;
}

interface Impact {
  goal: Goal | null;
  dojoSessions: number;
  deltas: {
    skfKd: number | null;
    skfPerformance: number | null;
    skfRail: number | null;
    publicRating: number | null;
    publicKd: number | null;
  } | null;
}

function metric(label: string, value: number | null | undefined, suffix = '') {
  if (value == null) return null;
  return (
    <div>
      <span>{label}</span>
      <strong className={value > 0 ? 'positive' : value < 0 ? 'negative' : ''}>
        {value > 0 ? '+' : ''}{value}{suffix}
      </strong>
    </div>
  );
}

export default function MemberTrainingFocus({ memberId }: { memberId: number }) {
  const { viewer, can } = useSession();
  const editable = viewer?.id === memberId || can('training.manage');
  const [impact, setImpact] = useState<Impact | null>(null);
  const [focus, setFocus] = useState('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api.get<Impact>('/performance/impact/' + memberId);
      setImpact(data);
      setFocus(data.goal?.focus ?? '');
      setTarget(data.goal?.target ?? '');
      setNotes(data.goal?.notes ?? '');
    } catch {
      setImpact(null);
    }
  }

  useEffect(() => {
    void load();
  }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(resetBaseline = false) {
    setBusy(true);
    try {
      await api.put('/performance/goals/' + memberId, {
        focus: focus.trim() || null,
        target: target.trim() || null,
        notes: notes.trim() || null,
        resetBaseline,
      });
      setEditing(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="block training-focus">
      <div className="training-focus-head">
        <div>
          <span>DOJO · PERFORMANCE LAB</span>
          <h3>Foco de entrenamiento</h3>
        </div>
        {editable && !editing && <button className="btn-link" onClick={() => setEditing(true)}>{impact?.goal ? 'Editar' : '+ Definir foco'}</button>}
      </div>

      {editing ? (
        <div className="training-focus-editor">
          <label>Foco actual<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Rail, rockets, positioning, comms…" /></label>
          <label>Objetivo<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ej: llevar Rail a 38% en 30 días" /></label>
          <label>Notas<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div>
            <button className="primary" disabled={busy} onClick={() => void save(!impact?.goal)}>Guardar</button>
            {impact?.goal && <button className="mini" disabled={busy} onClick={() => void save(true)}>Reiniciar baseline hoy</button>}
            <button className="mini" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      ) : impact?.goal ? (
        <>
          <div className="training-focus-copy">
            <div><span>FOCO</span><strong>{impact.goal.focus || '—'}</strong></div>
            <div><span>OBJETIVO</span><strong>{impact.goal.target || '—'}</strong></div>
            <div><span>DOJOS DESDE BASELINE</span><strong>{impact.dojoSessions}</strong></div>
          </div>
          {impact.goal.notes && <p className="training-focus-notes">{impact.goal.notes}</p>}
          {impact.deltas && (
            <div className="training-impact">
              {metric('SkF K/D', impact.deltas.skfKd)}
              {metric('Performance', impact.deltas.skfPerformance)}
              {metric('Rail', impact.deltas.skfRail, ' pp')}
              {metric('Public ELO', impact.deltas.publicRating)}
              {metric('Public K/D', impact.deltas.publicKd)}
            </div>
          )}
          <p className="muted small">Las variaciones muestran evolución desde el baseline; no atribuyen causalidad al Dojo.</p>
        </>
      ) : (
        <p className="muted">Todavía no hay un objetivo activo. Al definirlo guardaremos el baseline actual para comparar evolución.</p>
      )}
    </section>
  );
}
