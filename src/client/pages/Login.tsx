import { Navigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../lib/session';
import { useSigil } from '../lib/sigil';
import SigilStage from '../components/SigilStage';

const ERRORS: Record<string, string> = {
  state: 'El intento de acceso expiró o no coincidió. Intenta nuevamente.',
  not_in_guild: 'Debes pertenecer al servidor de Discord del clan para ingresar.',
  banned: 'Esta cuenta está bloqueada.',
  discord: 'Discord rechazó el inicio de sesión.',
};

export default function Login() {
  const { viewer, siteName } = useSession();
  const { sigil, loaded: sigilLoaded } = useSigil();
  const [params] = useSearchParams();
  const error = params.get('error');
  const detail = params.get('detail');

  if (viewer) return <Navigate to="/" replace />;

  const showSigil = sigilLoaded && sigil.enabled;

  const message = error
    ? (ERRORS[error] ?? 'No se pudo iniciar sesión. Intenta nuevamente.') +
      (error === 'discord' && detail ? ` (${detail})` : '')
    : null;

  return (
    <div className="login">
      {showSigil && (
        <div className="login-sigil">
          <SigilStage recipe={sigil.recipe} loop />
        </div>
      )}
      <h1>
        <span className="brand-lead">{(siteName || '').slice(0, 1)}</span>
        {(siteName || '').slice(1)}
      </h1>
      <p className="muted">
        Usa la misma cuenta de Discord con la que participas en el servidor de SkF.
      </p>

      {message && <div className="alert">{message}</div>}

      <a className="discord-btn large" href="/api/auth/login">
        Continuar en Discord
      </a>

      <div className="login-security-note">
        <strong>Acceso seguro mediante Discord OAuth</strong>
        <span>
          Serás redirigido al sitio oficial <code>discord.com</code>. SkF nunca solicita,
          almacena ni recibe tu contraseña de Discord.
        </span>
      </div>
    </div>
  );
}
