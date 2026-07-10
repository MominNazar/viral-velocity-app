import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

type Detail = {
  user: { user_id: number; name: string; email: string; plan_type: string };
  uploaded: { photo_id: number; score: number; upload_date: string; status: string }[];
  enhancements: { enhancement_id: number; photo_id: number; version_number: number; score: number; result: 'Passed' | 'Failed' }[];
};

export function ImagesMatchedDetail() {
  const { userId } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['im-detail', userId], queryFn: () => api<Detail>(`/admin/images-matched/${userId}`) });

  if (isLoading) return <div className="empty">Loading…</div>;
  if (!data) return <div className="empty">Not found.</div>;

  return (
    <div>
      <button className="btn ghost sm" onClick={() => nav(-1)}>← Back</button>
      <div className="panel">
        <h2>{data.user.name} · {data.user.email} · {data.user.plan_type}</h2>
      </div>

      <div className="panel">
        <h2>Images Uploaded ({data.uploaded.length})</h2>
        <div className="img-grid">
          {data.uploaded.map((p) => (
            <div className="img-card" key={p.photo_id}>
              <div className="img-thumb">🖼</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span className="muted">#{p.photo_id}</span>
                <span className="score-chip">{p.score}</span>
              </div>
            </div>
          ))}
          {!data.uploaded.length && <div className="empty">No uploads.</div>}
        </div>
      </div>

      <div className="panel">
        <h2>Enhanced Images — Passed / Failed ({data.enhancements.length})</h2>
        <div className="img-grid">
          {data.enhancements.map((e) => (
            <div className="img-card" key={e.enhancement_id}>
              <div className="img-thumb">✦</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
                <span className={`badge ${e.result === 'Passed' ? 'pass' : 'fail'}`}>{e.result}</span>
                <span className="score-chip">{e.score}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Photo #{e.photo_id} · v{e.version_number}</div>
            </div>
          ))}
          {!data.enhancements.length && <div className="empty">No enhanced images.</div>}
        </div>
      </div>
    </div>
  );
}
