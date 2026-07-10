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
- `render.yaml` — Render blueprint
- `backend` start script runs migrations automatically

### What you must do (I cannot do these)

1. **GitHub**
   - Create a repo at [github.com/new](https://github.com/new)
   - Push this project:
     ```powershell
     cd C:\Users\Hassan\Downloads\Viral_Velocity_App
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USER/viral-velocity.git
     git push -u origin main
     ```

2. **Render**
   - Sign up at [render.com](https://render.com) (free)
   - **New → Blueprint**
   - Connect GitHub → select your repo
   - Render reads `render.yaml` and creates the service
   - Wait for deploy (~5 min)

3. **Get your URL**
   - Render dashboard → service → URL like `https://viral-velocity-api.onrender.com`
   - Test: open `https://YOUR-URL.onrender.com/api/health` → should show `{"ok":true,...}`

4. **Seed demo users (once)**
   - Render → service → **Shell**:
     ```bash
     npm run seed
     ```

5. **Update mobile build**
   - Edit `mobile/eas.json`:
     ```json
     "EXPO_PUBLIC_API_BASE": "https://YOUR-URL.onrender.com"
     ```

---

## Notes
- **Free Render** sleeps after ~15 min idle; first request may be slow.
- **SQLite** on Render resets if the service is wiped; OK for testing, not production.
- Never commit `.env` — JWT secret is auto-generated on Render.
