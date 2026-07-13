# Deploy backend (Part 1)

Two options: **quick tunnel** (5 min, PC must stay on) or **Render** (permanent URL).

---

## Option A — Quick tunnel (test today)

Your backend is already running locally. In a **new terminal**:

```powershell
npx localtunnel --port 4000
```

Copy the URL it prints (e.g. `https://something.loca.lt`).

**Use as API base:** `https://something.loca.lt` (no `/api` suffix).

Put that in `mobile/eas.json` → `EXPO_PUBLIC_API_BASE`, then build the APK.

**Limits:** PC must stay on; tunnel URL changes each run; first request may show a “Click to continue” page in browser (fine for API).

---

## Option B — Render (permanent, for real testers)

### What I prepared
- `render.yaml` — Render blueprint (API + admin)
- `backend` start script runs migrations automatically

### What you must do (I cannot do these)

1. **GitHub** — already done: https://github.com/MominNazar/viral-velocity-app

2. **Backend** — already live: https://viral-velocity-app.onrender.com

3. **Admin web (new)**
   - Easiest: [vercel.com](https://vercel.com) → Import GitHub repo `viral-velocity-app`
   - **Root Directory:** `admin-web`
   - **Build Command:** `npm run build`
   - **Output:** `dist`
   - Env var: `VITE_API_BASE` = `https://viral-velocity-app.onrender.com`
   - Deploy → copy admin URL

   Or on Render: New → Static Site → same repo, root `admin-web`, build `npm install && npm run build`, publish `dist`, env `VITE_API_BASE`.

4. **Seed demo users (once)** on API Shell: `npm run seed`

---

## OTP emails (password reset / 2FA)

Without SMTP, codes only appear in **Render Logs**.

Add on Render → API service → Environment:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_16_char_app_password
MAIL_FROM=Viral Velocity <your@gmail.com>
```

Then Manual Deploy. Use a **real Gmail** in the app to receive OTPs.

---

## Notes
- Free Render sleeps after idle; first request may be slow.
- SQLite / uploads on free Render can reset; OK for demos.
