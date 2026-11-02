import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';

export default function Join() {
  const { viewer } = useSession();

  if (viewer?.pending) {
    return (
      <section className="public-action-page">
        <div className="public-action-card success">
          <div className="public-action-kicker">POSTULACIÓN EN REVISIÓN</div>
          <h1>Ya tocaste la puerta del Templo.</h1>
          <p>
            Tu cuenta ya está registrada como postulante. Completa tu perfil para que el clan pueda conocerte mejor.
          </p>
          <Link className="btn-cta primary" to={`/members/${viewer.id}`}>Completar mi perfil</Link>
        </div>
      </section>
    );
  }

  if (viewer) {
    return (
      <section className="public-action-page">
        <div className="public-action-card success">
          <div className="public-action-kicker">YA ERES SKF</div>
          <h1>El Templo ya es tu casa.</h1>
          <p>No necesitas volver a postular. Puedes ir directamente a tu perfil o al Dojo.</p>
          <div className="public-action-actions">
            <Link className="btn-cta primary" to={`/members/${viewer.id}`}>Mi perfil</Link>
            <Link className="btn-cta" to="/competitive">Ir al Dojo</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="public-action-page">
      <header className="public-action-hero">
        <div className="public-action-kicker">RECLUTAMIENTO SKF</div>
        <h1>Postula a SkF</h1>
        <p>
          Shaolin Kung Fu está abierto a jugadores que quieran competir, entrenar y ser parte de una historia que comenzó en 1998.
        </p>
      </header>

      <div className="public-action-card join-card">
        <div className="join-steps">
          <div><b>01</b><span>Identifícate con Discord.</span></div>
          <div><b>02</b><span>Completa tu nick, bio y perfil de jugador.</span></div>
          <div><b>03</b><span>Tu postulación entra a revisión del clan.</span></div>
          <div><b>04</b><span>Si eres aceptado, pasas a formar parte del roster SkF.</span></div>
        </div>

        <p className="muted">
          No necesitas pertenecer todavía al Discord de SkF. El acceso con Discord se usa para identificar tu postulación de forma segura.
        </p>

        <div className="public-action-actions">
          <a className="discord-btn large" href="/api/auth/login">Postular con Discord</a>
          <Link className="btn-cta ghost" to="/">Volver</Link>
        </div>
      </div>
    </section>
  );
}
