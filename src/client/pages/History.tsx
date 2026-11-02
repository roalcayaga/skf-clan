import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './history.css';

interface Milestone {
  id: number;
  sortYear: number;
  dateLabel: string;
  category: string | null;
  title: string;
  body: string;
  imageUrl: string | null;
}

export default function HistoryPage() {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);

  useEffect(() => {
    api
      .get<{ milestones: Milestone[] }>('/history')
      .then(({ milestones }) => setMilestones(milestones))
      .catch(() => setMilestones([]));
  }, []);

  if (milestones === null) return <div className="loading">Cargando historia…</div>;

  return (
    <section className="history-page">
      <header className="history-hero">
        <span>SHAOLIN KUNG FU · DESDE 1998</span>
        <h1>Historia</h1>
        <p>
          La memoria del Dragón. Orígenes, guerras, campeonatos, regresos y momentos que fueron
          construyendo SkF.
        </p>
      </header>

      {milestones.length === 0 ? (
        <div className="panel"><p className="muted">Todavía no hay hitos publicados.</p></div>
      ) : (
        <div className="history-timeline">
          {milestones.map((m, index) => (
            <article className="history-milestone" key={m.id}>
              <div className="history-axis">
                <span>{m.dateLabel}</span>
                <i />
              </div>
              <div className="history-content">
                {m.imageUrl && (
                  <figure>
                    <img src={m.imageUrl} alt="" loading={index > 1 ? 'lazy' : 'eager'} />
                  </figure>
                )}
                <div className="history-copy">
                  {m.category && <span className="history-category">{m.category}</span>}
                  <h2>{m.title}</h2>
                  <p>{m.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
