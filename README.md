# Viral Velocity Engine

AI-assisted build of the **Viral Velocity Engine** — a photo "social score" + AI-enhancement app — implemented per the project BRD (`Viral_Velocity_BRD.docx`).

This repository is also the deliverable for an AI-coding research exercise. The process, timeline, capability analysis and risk register live in `Viral_Velocity_App_Part1_Overview.docx`; the experience log, bug log and final assessment are tracked in `Viral_Velocity_App_Part2_Logs.docx` and mirrored in `docs/EXPERIENCE_LOG.md`.

## Monorepo layout

```
backend/      Node.js + Express REST API, SQLite, migrations  (Releases 1, 2, 4)
admin-web/    React + Vite + TypeScript admin portal           (Release 1, 4)
mobile/       React Native (Expo) + NativeWind app             (Releases 3, 4)
docs/         Experience log, bug log, decisions, **process timeline**
```

## Tech stack & key decisions

| Area        | Choice                          | Why |
|-------------|---------------------------------|-----|
| Backend     | Express (ESM)                   | Lightweight, matches BRD REST endpoints |
| Database    | SQLite via `better-sqlite3`     | Zero external server on Windows; schema mirrors the BRD MySQL tables (ENUMs emulated via CHECK constraints, JSON stored as TEXT) |
| Auth        | JWT + bcrypt                    | Stateless; "Remember Me" = long-lived token |
| AI scoring  | Deterministic mock scorer       | No paid model key in this exercise; isolated in `services/ai.js` so a real model can be dropped in |
| Email       | Nodemailer (console transport)  | Welcome / OTP / verification emails print to console in dev |
| Admin web   | Vite + React + TS + React Query | Per BRD; "AI-native editor" workflow |
| Mobile      | Expo + NativeWind + React Query | NativeWind (NOT web Tailwind) per Part 1 risk note |

## Subscription model note

The BRD's *Subscription wireframe text* mentions a token model (Starter/Pro/Expert), but the **Functional Requirements (FR-21–25), DB schema, and QA cases** define a **Monthly / Annual subscription with a one-time 30-day / 5-photo Free Trial and admin-configurable discounts**. The latter is internally consistent, so the build implements the **Monthly/Annual** model.

## Getting started

```bash
# Backend
cd backend
npm install
npm run migrate        # create + migrate the SQLite DB
npm run seed           # seed an admin + demo data
npm run dev            # http://localhost:4000

# Admin web
cd admin-web
npm install
npm run dev            # http://localhost:5173

# Mobile
cd mobile
npm install
npm start              # Expo dev server (press a = Android, i = iOS)
```

### Mobile run notes
- **Node ≥ 22.13** is recommended (RN 0.85 / Expo SDK 56 warns on older). You're on 22.11 — bump Node before `npm start` if Metro complains.
- **API base URL**: defaults to `http://localhost:4000` (iOS sim / web). The Android emulator auto-uses `http://10.0.2.2:4000`. For a physical device, set `EXPO_PUBLIC_API_BASE=http://<your-LAN-ip>:4000` before `npm start`.
- The mobile app was verified via `tsc --noEmit` and a full Metro bundle (1364 modules) — runtime testing needs a simulator/device.

## Seeded logins
```
Admin:  admin@viralvelocity.app / Admin123
Users:  emily@example.com / Demo1234   (also james@, sofia@)
```

## Verification
- Backend: `cd backend && node scripts/qa.mjs` → **30/30** BRD-mapped checks pass (server must be running).
- Admin web: `npm run build` passes TypeScript strict mode.
- Mobile: `npx tsc --noEmit` clean; `npx expo export -p android` bundles successfully.

See `docs/BUILD_EXPERIENCE.md` / **`Viral_Velocity_App_Build_Experience.docx`** (narrative experience only), `docs/EXPERIENCE_LOG.md`, **`docs/PROJECT_PROCESS_TIMELINE.md`**, **`Viral_Velocity_App_Process_Timeline.docx`** (full technical timeline), and `docs/DECISIONS.md` for the running build log; the Part 2 `.docx` has the filled Experience Log, Bug Log, and Final Assessment.
