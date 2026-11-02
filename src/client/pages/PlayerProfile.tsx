import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import MemberDetail from './MemberDetail';

export default function PlayerProfile() {
  const { slug = '' } = useParams();
  const [memberId, setMemberId] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    setMemberId(undefined);
    api
      .get<{ id: number }>('/members/public/slug/' + encodeURIComponent(slug))
      .then(({ id }) => setMemberId(id))
      .catch(() => setMemberId(null));
  }, [slug]);

  if (memberId === undefined) return <div className="loading">Cargando guerrero…</div>;
  if (memberId === null) return <div className="empty">Guerrero no encontrado.</div>;
  return <MemberDetail memberIdOverride={memberId} />;
}
