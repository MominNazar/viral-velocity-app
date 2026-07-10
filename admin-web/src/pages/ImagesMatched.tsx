import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { Modal, toast } from '../ui';

type Row = { user_id: number; user: string; email: string; plan: string; images_scored: number; avg_score: number; last_active: string };

export function ImagesMatched() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ user: '', plan: '', minAvg: '' });
  const [applied, setApplied] = useState(filters);
  const [retention, setRetention] = useState<{ months: number; days: number } | null>(null);

  const qs = new URLSearchParams(Object.entries(applied).filter(([, v]) => v)).toString();
  const { data, isLoading } = useQuery({ queryKey: ['images-matched', applied], queryFn: () => api<{ rows: Row[] }>(`/admin/images-matched?${qs}`) });

  const del = useMutation({
    mutationFn: (userId: number) => api(`/admin/users/${userId}/images`, { method: 'DELETE' }),
    onSuccess: () => { toast('User images deleted'); qc.invalidateQueries({ queryKey: ['images-matched'] }); },
    onError: (e: any) => toast(e.message, 'error'),
  });

  const saveRetention = useMutation({
    mutationFn: (body: { months: number; days: number }) => api('/admin/settings/retention', { method: 'PUT', body }),
    onSuccess: () => { toast('Retention policy saved'); setRetention(null); },
    onError: (e: any) => toast(e.message, 'error'),
  });

  async function openRetention() {
    const r = await api<{ months: number; days: number }>('/admin/settings/retention');
    setRetention({ months: r.months, days: r.days });
  }

  return (
    <div>
      <div className="toolbar">
        <div className="field">
          <label>User</label>
          <input value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} placeholder="Name contains…" />
        </div>
        <div className="field">
          <label>Plan</label>
          <select value={filters.plan} onChange={(e) => setFilters({ ...filters, plan: e.target.value })}>
            <option value="">All</option><option>Free</option><option>Monthly</option><option>Annual</option>
          </select>
        </div>
        <div className="field">
          <label>Min Avg Score</label>
          <input value={filters.minAvg} onChange={(e) => setFilters({ ...filters, minAvg: e.target.value.replace(/\D/g, '') })} placeholder="0-100" />
        </div>
        <button className="btn" onClick={() => setApplied(filters)}>Search</button>
        <div className="spacer" />
        <button className="btn secondary" onClick={openRetention}>Data Self-Deletion</button>
        <button className="btn secondary" onClick={() => downloadCsv(`/admin/images-matched?${qs}&format=csv`, 'images-matched.csv')}>Export</button>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        {isLoading ? <div className="empty">Loading…</div> : !data?.rows.length ? <div className="empty">No results.</div> : (
          <table>
            <thead>
              <tr><th>User</th><th>Plan</th><th>Images Scored</th><th>Avg. Image Score</th><th>Last Active</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.user}</td>
                  <td>{r.plan}</td>
                  <td>{r.images_scored}</td>
                  <td><span className="score-chip">{r.avg_score ?? '—'}</span></td>
                  <td className="muted">{r.last_active ? new Date(r.last_active).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="icon-btn" title="View" onClick={() => nav(`/images-matched/${r.user_id}`)}>View</button>{' '}
                    <button className="icon-btn" title="Delete" onClick={() => { if (confirm(`Delete all images for ${r.user}?`)) del.mutate(r.user_id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {retention && (
        <Modal title="Data Self-Deletion Window" onClose={() => setRetention(null)}>
          <p className="muted">Images are purged this long after a subscription ends.</p>
          <div className="row">
            <div className="field">
              <label>Months</label>
              <input value={retention.months} onChange={(e) => setRetention({ ...retention, months: Number(e.target.value.replace(/\D/g, '') || 0) })} />
            </div>
            <div className="field">
              <label>Days</label>
              <input value={retention.days} onChange={(e) => setRetention({ ...retention, days: Number(e.target.value.replace(/\D/g, '') || 0) })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setRetention(null)}>Cancel</button>
            <button className="btn" onClick={() => saveRetention.mutate(retention)}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
