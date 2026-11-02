import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { memberName } from '../../shared/names';
import MemberDetail from './MemberDetail';

interface MemberRow {
  id: number;
  username: string;
  globalName: string | null;
  displayName: string | null;
  status: string;
  rankName: string | null;
}

export default function MembersAdmin() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ members: MemberRow[] }>('/members?limit=100&sort=name&dir=asc')
      .then(({ members }) => {
        setMembers(members);
        setSelectedId((current) => current ?? members[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.displayName, m.globalName, m.username, m.rankName, m.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [filter, members]);

  if (loading) return <div className="loading">Cargando miembros…</div>;

  return (
    <div className="members-admin">
      <div className="admin-tool-head">
        <div>
          <h1>Miembros</h1>
          <p>Gestiona identidad, rango, roles, medallas y estado sin alterar la navegación normal del sitio.</p>
        </div>
      </div>

      <div className="members-admin-layout">
        <aside className="members-admin-list panel-sub">
          <input
            type="search"
            placeholder="Buscar miembro…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div>
            {visible.map((member) => (
              <button
                key={member.id}
                type="button"
                className={selectedId === member.id ? 'active' : ''}
                onClick={() => setSelectedId(member.id)}
              >
                <span>
                  <strong>{memberName(member)}</strong>
                  <small>{member.rankName || 'Sin rango'} · {member.status}</small>
                </span>
              </button>
            ))}
            {!visible.length && <p className="muted small">Sin resultados.</p>}
          </div>
        </aside>

        <div className="members-admin-detail">
          {selectedId ? (
            <MemberDetail
              key={selectedId}
              memberIdOverride={selectedId}
              managementMode
              embedded
            />
          ) : (
            <div className="empty">Selecciona un miembro.</div>
          )}
        </div>
      </div>
    </div>
  );
}
