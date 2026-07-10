import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

type Dash = {
  kpis: { totalUsers: number; activeSubscribers: number; revenue: number; avgImageScore: number };
  recentActivity: { user: string; plan: string; images_scored: number; avg_score: number; last_active: string }[];
};

export function Dashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dash>('/admin/dashboard') });

  if (isLoading) return <div className="empty">Loading dashboard…</div>;
  if (isError || !data) return <div className="empty">Could not load dashboard data.</div>;

  const k = data.kpis;
  const cards = [
    { label: 'Total Users', value: k.totalUsers },
    { label: 'Active Subscribers', value: k.activeSubscribers },
    { label: 'Revenue', value: `$${k.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: 'Avg. Image Score', value: k.avgImageScore },
  ];

  return (
    <div>
      <div className="cards">
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Recent Activity</h2>
        {data.recentActivity.length === 0 ? (
          <div className="empty">No activity yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>User</th><th>Plan</th><th>Images Scored</th><th>Avg. Image Score</th><th>Last Active</th></tr>
            </thead>
            <tbody>
              {data.recentActivity.map((r, i) => (
                <tr key={i}>
                  <td>{r.user}</td>
                  <td>{r.plan}</td>
                  <td>{r.images_scored}</td>
                  <td>{r.avg_score ?? '—'}</td>
                  <td className="muted">{r.last_active ? new Date(r.last_active).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
