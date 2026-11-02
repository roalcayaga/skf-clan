/**
 * Crónicas — the latest published chronicle is readable in full; older entries
 * remain as a compact archive. Published posts only.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MorphIcon } from 'morphicons/react';
import { Pin } from 'lucide';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { sanitizeHtml } from '../lib/richtext';

interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  pinned: boolean;
  publishedAt: number | null;
  author: string | null;
}

function dateLabel(unix: number | null): string {
  if (!unix) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(unix * 1000));
}

export default function News() {
  useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ posts: Post[] }>('/news')
      .then(({ posts }) => setPosts(posts))
      .finally(() => setLoading(false));
  }, []);

  const ordered = useMemo(
    () =>
      [...posts].sort(
        (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0) || b.id - a.id,
      ),
    [posts],
  );
  const latest = ordered[0] ?? null;
  const archive = ordered.slice(1);

  if (loading) return <div className="loading">Cargando crónicas…</div>;

  return (
    <section className="chronicles-page">
      <header className="chronicles-head">
        <div>
          <span>MEMORIA DEL TEMPLO</span>
          <h1>Crónicas</h1>
          <p>Historias, wars, hitos y capítulos de Shaolin Kung Fu.</p>
        </div>
      </header>

      {!latest ? (
        <section className="panel">
          <p className="muted">Todavía no hay crónicas publicadas.</p>
        </section>
      ) : (
        <>
          <article className="chronicle-feature">
            <div className="chronicle-feature-kicker">
              ÚLTIMA CRÓNICA
              {latest.pinned && (
                <span className="tag pin">
                  <MorphIcon icon={Pin} size={12} aria-hidden /> Destacada
                </span>
              )}
            </div>

            <header>
              <h2>{latest.title}</h2>
              <div className="chronicle-meta">
                <span>{latest.author ?? 'SkF'}</span>
                {latest.publishedAt && <span>· {dateLabel(latest.publishedAt)}</span>}
              </div>
            </header>

            <div
              className="news-body chronicle-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(latest.body) }}
            />

            <Link className="chronicle-permalink" to={`/news/${latest.slug}`}>
              Abrir enlace permanente →
            </Link>
          </article>

          {archive.length > 0 && (
            <section className="chronicle-archive">
              <header>
                <span>REGISTRO</span>
                <h2>Archivo de Crónicas</h2>
              </header>

              <ol>
                {archive.map((post) => (
                  <li key={post.id}>
                    <Link to={`/news/${post.slug}`}>
                      <div>
                        <h3>{post.title}</h3>
                        <span>
                          {post.author ?? 'SkF'}
                          {post.publishedAt ? ` · ${dateLabel(post.publishedAt)}` : ''}
                        </span>
                      </div>
                      <b>→</b>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </section>
  );
}
