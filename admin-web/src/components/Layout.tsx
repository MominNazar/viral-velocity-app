import { useState, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/', label: 'Dashboard', ico: '▦', end: true },
  { to: '/images-matched', label: 'Images Matched', ico: '🖼' },
  { to: '/subscribers', label: 'Subscribers', ico: '👥' },
  { to: '/profile', label: 'Admin Profile', ico: '⚙' },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/images-matched': 'Images Matched',
  '/subscribers': 'Subscribers',
  '/profile': 'Admin Profile',
};

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { admin, logout } = useAuth();
  const loc = useLocation();
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith('/images-matched') ? 'Images Matched' : 'Admin');

  return (
    <div className="shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <span className="dot" />
          <span>Viral Velocity</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{n.ico}</span>
              <span className="label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="btn ghost sm" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
            {collapsed ? '»' : '« Collapse'}
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="muted">{admin?.name} · {admin?.role}</span>
            <button className="btn secondary sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
