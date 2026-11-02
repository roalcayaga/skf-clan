import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Health {
  generatedAt: number;
  trackedRows: number;
  demoBytes: number;
  tables: Record<string, number>;
  guard: { status: 'healthy' | 'review'; note: string };
}

function bytes(n: number): string {
  if (n < 1_000_000) return Math.round(n / 1000) + ' KB';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + ' MB';
  return (n / 1_000_000_000).toFixed(2) + ' GB';
}

const LABELS: Record<string, string> = {
  links: 'Steam links',
  matches: 'Quake matches',
  matchPlayers: 'Match players',
  publicCurrent: 'Public current',
  publicDaily: 'Public daily',
  pulse: 'Pulse events',
  rooms: 'Match Rooms',
  demos: 'Demo records',
  goals: 'Training goals',
};

export default function PerformanceOSAdmin() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setHealth(await api.get<Health>('/performance/system'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Performance OS health.');
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="admin-tool">
      <div className="admin-tool-head">
        <div>
          <h1>Performance OS</h1>
          <p>Internal footprint for SkF competitive data. This is our early-warning guard, not Cloudflare billing.</p>
        </div>
        <button className="mini" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="callout danger">{error}</div>}
      {!health ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <span>Guard</span>
              <strong>{health.guard.status === 'healthy' ? 'HEALTHY' : 'REVIEW'}</strong>
              <small>{health.guard.note}</small>
            </div>
            <div className="stat-card">
              <span>Tracked rows</span>
              <strong>{health.trackedRows.toLocaleString('es-CL')}</strong>
              <small>Performance OS only</small>
            </div>
            <div className="stat-card">
              <span>Demo Vault</span>
              <strong>{bytes(health.demoBytes)}</strong>
              <small>Files referenced by Match Room</small>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head"><h2>Data footprint</h2></header>
            <div className="settings-list">
              {Object.entries(health.tables).map(([key, value]) => (
                <div className="settings-row" key={key}>
                  <span>{LABELS[key] || key}</span>
                  <strong>{value.toLocaleString('es-CL')}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
