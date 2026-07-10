import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { toast } from '../ui';

export function Profile() {
  const { admin, setAdmin } = useAuth();
  const [name, setName] = useState(admin?.name || '');
  const [email, setEmail] = useState(admin?.email || '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [twofa, setTwofa] = useState(!!admin?.twofa_enabled);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<any>('/admin/profile', { method: 'PUT', body: { name, email } });
      setAdmin(r.admin);
      toast('Profile saved');
    } catch (err: any) { toast(err.message, 'error'); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr({});
    try {
      await api('/admin/profile/change-password', { method: 'POST', body: pw });
      toast('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      if (err.details) setPwErr(err.details);
      toast(err.message, 'error');
    }
  }

  async function toggle2fa() {
    try {
      const next = !twofa;
      const r = await api<any>(`/admin/profile/2fa/${next ? 'enable' : 'disable'}`, { method: 'POST' });
      setTwofa(r.twofa_enabled);
      setAdmin(admin ? { ...admin, twofa_enabled: r.twofa_enabled } : admin);
      toast(r.message);
    } catch (err: any) { toast(err.message, 'error'); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <form className="panel" style={{ marginTop: 0 }} onSubmit={saveProfile}>
        <h2>Profile</h2>
        <div className="field"><label>Full Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
        <button className="btn">Save Changes</button>
      </form>

      <form className="panel" onSubmit={changePassword}>
        <h2>Change Password</h2>
        <div className="field"><label>Current Password</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
        <div className="field"><label>New Password</label><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />{pwErr.newPassword && <div className="err">{pwErr.newPassword}</div>}</div>
        <div className="field"><label>Confirm Password</label><input type="password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} />{pwErr.confirmPassword && <div className="err">{pwErr.confirmPassword}</div>}</div>
        <button className="btn">Update Password</button>
      </form>

      <div className="panel">
        <h2>Two-Factor Authentication</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div>{twofa ? 'Enabled' : 'Disabled'}</div>
            <div className="muted" style={{ fontSize: 13 }}>When enabled, your next login requires an emailed 6-digit code.</div>
          </div>
          <button className={`btn ${twofa ? 'danger' : ''}`} onClick={toggle2fa}>{twofa ? 'Disable 2FA' : 'Enable 2FA'}</button>
        </div>
      </div>
    </div>
  );
}
