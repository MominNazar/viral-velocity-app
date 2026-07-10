import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore, ApiError } from '../api';
import { useAuth, Admin } from '../auth';

export function Login() {
  const nav = useNavigate();
  const { setAdmin } = useAuth();
  const [email, setEmail] = useState('admin@viralvelocity.app');
  const [password, setPassword] = useState('Admin123');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // 2FA challenge state (AWL-F6..F8)
  const [twofa, setTwofa] = useState<{ adminId: number } | null>(null);
  const [code, setCode] = useState('');

  function finish(token: string, admin: Admin) {
    tokenStore.set(token, remember);
    setAdmin(admin);
    nav('/', { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({}); setFormError('');
    const errs: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      const r = await api<any>('/admin/login', { method: 'POST', auth: false, body: { email, password, rememberMe: remember } });
      if (r.twofaRequired) setTwofa({ adminId: r.adminId });
      else finish(r.token, r.admin);
    } catch (err) {
      if (err instanceof ApiError) { setFormError(err.message); if (err.details) setErrors(err.details); }
    } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!/^\d{6}$/.test(code)) return setFormError('Enter the 6-digit code');
    setBusy(true);
    try {
      const r = await api<any>('/admin/verify-2fa', { method: 'POST', auth: false, body: { adminId: twofa!.adminId, code, rememberMe: remember } });
      finish(r.token, r.admin);
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Admin Portal</h1>
        <p className="sub">Viral Velocity Engine</p>

        {!twofa ? (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus />
              {errors.email && <div className="err">{errors.email}</div>}
            </div>
            <div className="field">
              <label>Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
              {errors.password && <div className="err">{errors.password}</div>}
            </div>
            <div className="field checkbox">
              <input id="rm" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <label htmlFor="rm" style={{ margin: 0 }}>Remember me</label>
            </div>
            {formError && <div className="err" style={{ marginBottom: 12 }}>{formError}</div>}
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
            <p className="muted center" style={{ marginTop: 16, fontSize: 12 }}>Seeded: admin@viralvelocity.app / Admin123</p>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <p className="sub">Two-factor authentication is enabled. Enter the 6-digit code sent to your email (printed to the API console in dev).</p>
            <div className="field">
              <label>Verification code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus />
            </div>
            {formError && <div className="err" style={{ marginBottom: 12 }}>{formError}</div>}
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
            <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setTwofa(null)}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
