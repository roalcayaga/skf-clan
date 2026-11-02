/**
 * The front page. Rather than hard-coding a layout, it loads the admin-arranged
 * 'home' layout (falling back to the built-in default) and renders it through
 * the module system, so what appears here is whatever modules an admin has
 * arranged in the Pages editor.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import PageRenderer from '../components/PageRenderer';
import HomePulse from '../components/HomePulse';
import { defaultLayout, sanitizeLayout, type PageLayout } from '../../shared/layout';

export default function Home() {
  const { viewer, loading: sessionLoading } = useSession();
  const [state, setState] = useState<{ layout: PageLayout; isPublic: boolean } | null>(null);

  useEffect(() => {
    api
      .get<{ layout: unknown; isPublic?: boolean }>('/pages/home')
      .then(({ layout, isPublic }) => setState({ layout: sanitizeLayout(layout), isPublic: isPublic !== false }))
      .catch(() => setState({ layout: defaultLayout('home'), isPublic: true }));
  }, []);

  if (sessionLoading || !state) return <div className="loading">Loading…</div>;
  // A logged-out visitor may only see the home page when it's marked public.
  // (PageRenderer still hides members-only and role-only modules from them.)
  if (!viewer && !state.isPublic) return <Navigate to="/login" replace />;

  return (
    <>
      {!viewer && (
        <section className="public-home-hero">
          <div className="public-home-kicker">SHAOLIN KUNG FU · DESDE 1998</div>
          <h1>La Leyenda del Dragón</h1>
          <p>
            SkF es una comunidad nacida en los primeros años de Quake. Historia, crónicas y actividad
            del clan son públicas; el Dojo y las herramientas competitivas quedan reservadas para miembros.
          </p>
          <div className="public-home-actions">
            <Link className="btn-cta primary" to="/challenge">Desafiar a SkF</Link>
            <Link className="btn-cta" to="/join">Postular a SkF</Link>
            <Link className="btn-cta ghost" to="/history">Ver Historia</Link>
            <Link className="btn-cta ghost" to="/news">Leer Crónicas</Link>
          </div>
        </section>
      )}

      <HomePulse />
      <PageRenderer layout={state.layout} />
    </>
  );
}
