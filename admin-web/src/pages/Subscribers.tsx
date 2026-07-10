import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, downloadCsv } from '../api';
import { Modal, toast } from '../ui';

type Row = { user_id: number; username: string; email: string; plan_type: string; renewal_date: string; status: string };
type Pricing = { monthly: { price: number; discount: number }; annual: { price: number; discount: number } };

export function Subscribers() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: '', plan: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [pErrors, setPErrors] = useState<Record<string, string>>({});

  const qs = new URLSearchParams(Object.entries(applied).filter(([, v]) => v)).toString();
  const { data, isLoading } = useQuery({ queryKey: ['subscribers', applied], queryFn: () => api<{ rows: Row[] }>(`/admin/subscribers?${qs}`) });

  const setStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api(`/admin/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
    onSuccess: () => { toast('Status updated'); qc.invalidateQueries({ queryKey: ['subscribers'] }); },
    onError: (e: any) => toast(e.message, 'error'),
  });

  const savePricing = useMutation({
    mutationFn: (body: Pricing) => api('/admin/pricing', { method: 'PUT', body }),
    onSuccess: () => { toast('Discount / pricing saved'); setPricing(null); setPErrors({}); },
    onError: (e: any) => { toast(e.message, 'error'); },
  });

  async function openDiscount() {
    const r = await api<{ pricing: Pricing }>('/admin/pricing');
    setPricing(r.pricing);
  }

  function validateAndSave() {
    if (!pricing) return;
    const errs: Record<string, string> = {};
    const check = (p: { price: number; discount: number }, k: string) => {
      if (!(p.price >= 0)) errs[`${k}_price`] = 'Price must be ≥ 0';
      if (!(p.discount >= 0 && p.discount <= 100)) errs[`${k}_discount`] = 'Discount 0–100';
    };
    check(pricing.monthly, 'm'); check(pricing.annual, 'a');
    setPErrors(errs);
    if (Object.keys(errs).length) return;
    savePricing.mutate(pricing);
  }

  function onStatusChange(r: Row, value: string) {
    const active = value === 'Active';
    if (confirm(`Set ${r.username} to ${value}?`)) setStatus.mutate({ id: r.user_id, active });
  }

  return (
    <div>
      <div className="toolbar">
        <div className="field">
          <label>Search</label>
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Username or email" />
        </div>
        <div className="field">
          <label>Plan Type</label>
          <select value={filters.plan} onChange={(e) => setFilters({ ...filters, plan: e.target.value })}>
            <option value="">All</option><option>Free</option><option>Monthly</option><option>Annual</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option><option>Active</option><option>Inactive</option>
          </select>
        </div>
        <button className="btn" onClick={() => setApplied(filters)}>Search</button>
        <div className="spacer" />
        <button className="btn secondary" onClick={openDiscount}>Discount</button>
        <button className="btn secondary" onClick={() => downloadCsv(`/admin/subscribers?${qs}&format=csv`, 'subscribers.csv')}>Export</button>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        {isLoading ? <div className="empty">Loading…</div> : !data?.rows.length ? <div className="empty">No subscribers.</div> : (
          <table>
            <thead>
              <tr><th>User Name</th><th>Email</th><th>Plan Type</th><th>Renewal Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.username}</td>
                  <td className="muted">{r.email}</td>
                  <td>{r.plan_type}</td>
                  <td className="muted">{r.renewal_date || '—'}</td>
                  <td>
                    <select value={r.status === 'Active' ? 'Active' : 'Inactive'} onChange={(e) => onStatusChange(r, e.target.value)} style={{ width: 130 }}>
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pricing && (
        <Modal title="Add Package · Discount Configuration" onClose={() => setPricing(null)}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Monthly</h3>
          <div className="row">
            <div className="field">
              <label>Price ($)</label>
              <input value={pricing.monthly.price} onChange={(e) => setPricing({ ...pricing, monthly: { ...pricing.monthly, price: Number(e.target.value) } })} />
              {pErrors.m_price && <div className="err">{pErrors.m_price}</div>}
            </div>
            <div className="field">
              <label>Discount (%)</label>
              <input value={pricing.monthly.discount} onChange={(e) => setPricing({ ...pricing, monthly: { ...pricing.monthly, discount: Number(e.target.value) } })} />
              {pErrors.m_discount && <div className="err">{pErrors.m_discount}</div>}
            </div>
          </div>
          <h3 style={{ fontSize: 14, margin: '8px 0' }}>Annual</h3>
          <div className="row">
            <div className="field">
              <label>Price ($)</label>
              <input value={pricing.annual.price} onChange={(e) => setPricing({ ...pricing, annual: { ...pricing.annual, price: Number(e.target.value) } })} />
              {pErrors.a_price && <div className="err">{pErrors.a_price}</div>}
            </div>
            <div className="field">
              <label>Discount (%)</label>
              <input value={pricing.annual.discount} onChange={(e) => setPricing({ ...pricing, annual: { ...pricing.annual, discount: Number(e.target.value) } })} />
              {pErrors.a_discount && <div className="err">{pErrors.a_discount}</div>}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setPricing(null)}>Cancel</button>
            <button className="btn" onClick={validateAndSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
