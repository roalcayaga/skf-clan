import { useEffect, useState, type ChangeEvent } from 'react';
import { api } from '../lib/api';
import { useAction, Alerts } from '../lib/action';

interface Milestone {
  id: number;
  sortYear: number;
  dateLabel: string;
  category: string | null;
  title: string;
  body: string;
  imageUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
}

const emptyDraft = {
  sortYear: new Date().getFullYear(),
  dateLabel: String(new Date().getFullYear()),
  category: '',
  title: '',
  body: '',
  imageUrl: null as string | null,
  isPublished: true,
  sortOrder: 0,
};

export default function HistoryAdmin() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { milestones } = await api.get<{ milestones: Milestone[] }>('/history/manage');
    setItems(milestones);
    if (selectedId != null && !milestones.some((m) => m.id === selectedId)) setSelectedId(null);
  }

  const { run, busy, error, notice, warning } = useAction(load);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const selected = items.find((m) => m.id === selectedId) ?? null;

  if (loading) return <div className="loading">Cargando Historia…</div>;

  return (
    <section className="panel history-admin">
      <header className="panel-head">
        <div>
          <h2>Historia de SkF</h2>
          <p className="muted">
            Agrega, corrige o reordena hitos. Los cambios publicados aparecen automáticamente en /history.
          </p>
        </div>
        <button className="primary" onClick={() => { setCreating(true); setSelectedId(null); }}>
          + Nuevo hito
        </button>
      </header>

      <Alerts error={error} warning={warning} notice={notice} />

      <div className="history-admin-layout">
        <ol className="history-admin-list">
          {items.map((m) => (
            <li key={m.id}>
              <button
                className={selectedId === m.id ? 'history-admin-chip active' : 'history-admin-chip'}
                onClick={() => { setSelectedId(m.id); setCreating(false); }}
              >
                <span>{m.dateLabel}</span>
                <strong>{m.title}</strong>
                <small>{m.isPublished ? 'Publicado' : 'Borrador'}{m.category ? ' · ' + m.category : ''}</small>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="muted small">Aún no hay hitos.</li>}
        </ol>

        <div className="history-admin-editor">
          {creating ? (
            <MilestoneEditor
              milestone={null}
              busy={busy}
              onCancel={() => setCreating(false)}
              onSave={(draft) =>
                run(async () => {
                  const { milestone } = await api.post<{ milestone: Milestone }>('/history', draft);
                  setCreating(false);
                  setSelectedId(milestone.id);
                  return 'Hito creado.';
                })
              }
            />
          ) : selected ? (
            <MilestoneEditor
              key={selected.id}
              milestone={selected}
              busy={busy}
              onCancel={() => setSelectedId(null)}
              onSave={(patch) =>
                run(async () => {
                  await api.patch('/history/' + selected.id, patch);
                  return 'Hito guardado.';
                })
              }
              onDelete={() =>
                run(async () => {
                  await api.del('/history/' + selected.id);
                  setSelectedId(null);
                  return 'Hito eliminado.';
                })
              }
            />
          ) : (
            <div className="empty-editor">
              Selecciona un hito o crea uno nuevo. Ejemplo: <strong>2003 · Campeones de…</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MilestoneEditor({
  milestone,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  milestone: Milestone | null;
  busy: boolean;
  onSave: (value: {
    sortYear: number;
    dateLabel: string;
    category: string | null;
    title: string;
    body: string;
    imageUrl: string | null;
    isPublished: boolean;
    sortOrder: number;
  }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const initial = milestone ?? emptyDraft;
  const [sortYear, setSortYear] = useState(initial.sortYear);
  const [dateLabel, setDateLabel] = useState(initial.dateLabel);
  const [category, setCategory] = useState(initial.category ?? '');
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const { url } = await api.upload<{ url: string }>('/media/history', file);
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  const valid = Number.isInteger(sortYear) && !!dateLabel.trim() && !!title.trim() && !!body.trim();

  return (
    <div className="role-editor history-editor-form">
      <div className="history-editor-grid">
        <label>
          Año para ordenar
          <input type="number" min="1900" max="2200" value={sortYear} onChange={(e) => setSortYear(Number(e.target.value))} />
          <span className="muted small">Sirve para ubicar el hito en la línea de tiempo.</span>
        </label>
        <label>
          Fecha visible
          <input value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="2003 o 1997–1998" />
        </label>
        <label>
          Categoría
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="CAMPEONATO, ORIGEN, REGRESO…" />
        </label>
        <label>
          Orden dentro del año
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </label>
      </div>

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campeones del torneo…" />
      </label>

      <label>
        Relato
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Qué pasó, por qué fue importante, quiénes participaron…"
        />
      </label>

      <div className="history-image-editor">
        {imageUrl ? <img src={imageUrl} alt="" /> : <div className="history-image-placeholder">Sin imagen</div>}
        <div>
          <label className="upload-btn">
            {uploading ? 'Subiendo…' : imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={busy || uploading}
              onChange={(e) => void pickFile(e)}
            />
          </label>
          {imageUrl && <button className="mini" onClick={() => setImageUrl(null)} disabled={busy || uploading}>Quitar imagen</button>}
          {uploadError && <span className="small warn">{uploadError}</span>}
        </div>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        Publicado
      </label>

      <div className="history-editor-actions">
        <button
          className="primary"
          disabled={busy || uploading || !valid}
          onClick={() =>
            onSave({
              sortYear,
              dateLabel: dateLabel.trim(),
              category: category.trim() || null,
              title: title.trim(),
              body: body.trim(),
              imageUrl,
              isPublished,
              sortOrder,
            })
          }
        >
          {milestone ? 'Guardar cambios' : 'Crear hito'}
        </button>
        <button className="mini" disabled={busy} onClick={onCancel}>Cancelar</button>
        {onDelete && <button className="danger" disabled={busy} onClick={onDelete}>Eliminar hito</button>}
      </div>
    </div>
  );
}
