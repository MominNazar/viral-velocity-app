# Viral Velocity App — Full Process Documentation & Timeline

> **Purpose:** Document the entire build process (timeline-style) so the team can summarize the AI-assisted development experience at the end of the assignment.  
> **Audience:** Manager / reviewer / Part 1 & Part 2 report authors.  
> **Last updated:** June 2026

---

## 1. Executive Summary

The **Viral Velocity Engine** is a photo scoring and AI-enhancement product built as a **monorepo** with three applications:

| App | Stack | Role |
|-----|-------|------|
| **Backend** | Node.js, Express (ESM), SQLite | REST API, auth, photos, scoring, enhancement, subscriptions, admin |
| **Admin Web** | React, Vite, TypeScript, React Query | Internal portal for KPIs, users, discounts, moderation |
| **Mobile** | Expo SDK 56, React Native, NativeWind | End-user app (upload, score, enhance, library, billing, settings) |

**Build method:** AI coding assistant (Cursor) with human direction, QA, and iteration.  
**Duration:** ~5 planned days (core build) + additional iteration for device testing, enhancement engine, subscription wireframe, and UI polish.  
**Verification:** Backend automated QA = **30/30** BRD-mapped checks; mobile tested on **Android physical device via Expo Go** on LAN.

---

## 2. Project Scope (BRD Mapping)

The build follows `Viral_Velocity_BRD.docx`. High-level requirement groups:

| Area | Key FRs | Status |
|------|---------|--------|
| Auth & onboarding | FR-1–6 (signup, login, OTP, parental gate, ToS, free trial) | ✅ |
| Photo upload & scoring | FR-7–11 (multi-upload, social score, sub-scores) | ✅ |
| Enhancement | FR-12–16 (5 versions, swipe, compare, prompts, no face alteration policy) | ✅ |
| Library | FR-18–20 (sort, filter, batch prompt) | ✅ |
| Subscription | FR-21–25 (plans, discounts, upgrade, cancel, paywall) | ✅ |
| Settings | FR-26–27 (profile, disable account) | ✅ |
| Admin | FR-28–36 (dashboard, images matched, subscribers, 2FA, retention) | ✅ |

**Known BRD tension resolved:** Subscription wireframe prose describes a **token tier model** (Starter/Pro/Expert); FR-21–25 and DB schema originally described **Monthly/Annual**. Final mobile UI implements **wireframe tier + token model**; backend supports tier pricing, token balance, one-time packs, and subscription lifecycle.

---

## 3. Timeline (Day-by-Day + Post-Delivery)

### Phase 0 — Planning & Setup (Day 0)

| Step | Activity | Outcome |
|------|----------|---------|
| 0.1 | Read Part 1 Overview + Part 2 Log templates + BRD | Understood deliverables: working app + experience/bug logs |
| 0.2 | Initialize monorepo (`backend/`, `admin-web/`, `mobile/`, `docs/`) | Single repo, root README |
| 0.3 | Record architecture decisions | `docs/DECISIONS.md` (SQLite, JWT, mock AI boundary) |

---

### Phase 1 — Backend Foundation (Day 1)

| Time | Task | Files / artifacts |
|------|------|-------------------|
| AM | Express scaffold, config, error middleware, SQLite connection | `backend/src/server.js`, `app.js`, `config.js` |
| AM | Full DB migration from BRD MySQL schema | `backend/migrations/001_init.sql` |
| PM | Auth: signup, login, Remember Me, OTP reset, rate limits | `backend/src/routes/auth.js` |
| PM | Parental consent (<18), welcome email (console), audit log | `auth.js`, `services/email.js` |
| PM | JWT + bcrypt utilities | `backend/src/lib/tokens.js` |

**Decision D-1:** SQLite instead of MySQL for zero-config Windows dev.

---

### Phase 2 — Backend Core + Admin (Day 2)

| Time | Task | Files / artifacts |
|------|------|-------------------|
| AM | Photo upload (1–5), scoring, moderation gate | `routes/photos.js`, `services/ai.js`, `services/moderation.js` |
| AM | Enhancement: 5 versions, swipe save/discard, prompts | `photos.js`, `services/ai.js` |
| PM | Subscription: plans, subscribe, upgrade, cancel | `routes/subscriptions.js` |
| PM | Admin: dashboard, images matched, subscribers, pricing, 2FA | `routes/admin.js` |
| PM | Smoke script + QA harness | `backend/scripts/qa.mjs` → 30 checks |

**Decision D-2:** Monthly/Annual subscription per FR-21–25 (later extended to tiers — see Phase 6).

---

### Phase 3 — Admin Web Portal (Day 2–3)

| Time | Task | Screens |
|------|------|---------|
| PM | Vite + React + TS scaffold, API client, auth context | `admin-web/src/` |
| PM | Login + 2FA challenge | Login, Verify2FA |
| PM | Dashboard KPIs, Images Matched, Subscribers, Discount modal | Dashboard, ImagesMatched, Subscribers |
| PM | Admin profile, change password, enable/disable 2FA | Profile |

Admin verified: `npm run build` passes TypeScript strict mode.

---

### Phase 4 — Mobile App (Day 3–4)

| Time | Task | Screens |
|------|------|---------|
| AM | Expo + NativeWind + React Query + navigation scaffold | `mobile/App.tsx`, `navigation/types.ts` |
| AM | Auth flow | Landing, Login, SignUp, ForgotPassword, OTP, ResetPassword |
| PM | Core flow | Dashboard, PhotoUpload, Score |
| PM | Enhance swipe stack (gesture-handler + Reanimated) | EnhanceScreen |
| PM | Compare, Library, ImageDetail | Compare, Library, ImageDetail |
| PM | Subscription, Settings, Change Password | Subscription, Settings |

**Hardest mobile piece:** Swipe save/discard — required explicit gesture thresholds and Reanimated worklets (Part 1 predicted this as an AI weakness).

---

### Phase 5 — QA, Reports & Polish (Day 5)

| Task | Result |
|------|--------|
| Run `backend/scripts/qa.mjs` | 30/30 PASS |
| Fill Part 2 Word doc (Experience Log, Bug Log, Final Assessment) | `Viral_Velocity_App_Part2_Logs.docx` |
| Mirror logs in markdown | `docs/EXPERIENCE_LOG.md` |
| Mobile `tsc --noEmit` + Metro bundle | Clean build |

---

### Phase 6 — Real Device Testing & Iteration (Post Day 5)

This phase happened during live testing on **Android phone + Expo Go + LAN backend** (`http://192.168.1.4:4000`).

| # | Issue reported | Root cause | Fix |
|---|----------------|------------|-----|
| 6.1 | Upload / keyboard / nav bar overlap on Android | Safe area insets = 0 on 3-button nav | `useScreenInsets()` helper, extra bottom padding |
| 6.2 | OTP / login quirks | Validation + API base URL on device | `EXPO_PUBLIC_API_BASE` for LAN IP |
| 6.3 | **Add Prompt not working** | Replicate API: 422 bad model, 402 no credits, 429 rate limit | Switched default to **Sharp** (free local processing) |
| 6.4 | Enhance 500 error | Sharp `gamma()` received value < 1.0 | Darkening via brightness only; gamma clamped ≥ 1.0 |
| 6.5 | Prompt 500 error | `ReferenceError: result is not defined` in route | Fixed variable in `photos.js` |
| 6.6 | Some prompts subtle / “not working” | Keyword parser gaps; negation label bugs | Expanded `analyzePrompt()` in `imageEnhance.js`; user feedback via `appliedStyle` + `notice` |
| 6.7 | User chose **no paid APIs** | Replicate requires credits | `ENHANCE_ENGINE=sharp` in `.env`; documented limitations |
| 6.8 | Subscription wireframe (SB-F*) | App had old Monthly/Annual-only UI | Tier plans (Starter/Pro/Expert), token balance, one-time purchase, Profile tab |
| 6.9 | Status bar overlap + white Android nav bar | Missing top safe area; system UI not themed | SafeAreaView `edges={['top',...]}`, dark `app.json`, `expo-navigation-bar` |
| 6.10 | **App crash on launch** | Expo SDK 56 removed `setBackgroundColorAsync` | Updated to `NavigationBar.setStyle('dark')` |
| 6.11 | Settings hard to find | Only hidden gear icon | **Subscription \| Settings** toggle on Profile tab |

**Migration added:** `002_tokens_and_tiers.sql` — `token_balance`, `plan_tier`, `billing_cycle`, tier subscription fields.

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE (Expo Go)                          │
│  Home │ Gallery │ Library │ Profile (Subscription │ Settings)   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP /api  (JWT Bearer)
┌────────────────────────────▼────────────────────────────────────┐
│                     BACKEND (Express :4000)                      │
│  /auth  /photos  /subscription  /admin                           │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ SQLite   │  │ ai.js        │  │ imageEnhance.js (Sharp) │   │
│  │ users    │  │ mock scorer  │  │ optional Replicate      │   │
│  │ photos   │  │ enhance flow │  │ keyword prompt parser   │   │
│  │ subs     │  └──────────────┘  └─────────────────────────┘   │
│  └──────────┘                                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   ADMIN WEB (Vite :5173)                         │
│  Dashboard │ Images Matched │ Subscribers │ Discount │ 2FA      │
└─────────────────────────────────────────────────────────────────┘
```

### Enhancement engine (current)

| Mode | Config | Cost | Capability |
|------|--------|------|------------|
| **Sharp (default)** | `ENHANCE_ENGINE=sharp` | Free | Color, contrast, blur, B&W — **not** object editing |
| **Replicate (optional)** | `ENHANCE_ENGINE=replicate` + token | Paid credits | Instruct-pix2pix style edits |

Prompt flow: free text → `analyzePrompt()` → Sharp filters → new enhancement version + re-score.

---

## 5. Complete Feature Inventory

### 5.1 Backend API Endpoints

**Auth** (`/api/auth`)
- `POST /signup`, `/login`, `/forgot-password`, `/verify-reset-otp`, `/reset-password`
- `GET /me`, `PUT /profile`, `POST /change-password`, `/disable-profile`

**Photos** (`/api/photos`)
- `POST /upload`, `GET /`, `GET /library`, `GET /:id`
- `POST /:id/enhance`, `POST /:id/prompt`, `POST /library/prompt`
- `POST /enhancements/:id/save|discard`, `DELETE /:id`, `/enhancements/:id`

**Subscription** (`/api/subscription`)
- `GET /plans`, `/me`
- `POST /subscribe`, `/upgrade`, `/purchase`, `/cancel`

**Admin** (`/api/admin`)
- Login, 2FA, dashboard, images-matched, subscribers, pricing, retention, moderation, profile

### 5.2 Mobile Screens (17)

| Screen | Purpose |
|--------|---------|
| Landing, Login, SignUp, ForgotPassword, Otp, ResetPassword | Auth |
| Dashboard | Home, upload CTA, recent photos, token balance |
| Gallery | Photo grid |
| PhotoUpload, Score | Upload & view scores |
| Enhance, Compare, ImageDetail | Enhancement workflow |
| Library | Saved/filtered images, batch prompt |
| Subscription | Tier plans, one-time tokens, upgrade, cancel |
| Settings, ChangePassword | Profile & account |

### 5.3 Admin Web Pages

Login, 2FA verify, Dashboard, Images Matched (+ detail), Subscribers (+ discount config), Profile.

---

## 6. Key Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D-1 | SQLite over MySQL | Zero external DB setup on Windows |
| D-2 | Subscription lifecycle per FR-21–25 | Schema + QA consistency |
| D-3 | Mock deterministic scorer | No API key required for assignment |
| D-4 | JWT + bcrypt, OTP rate limits | NFR-6 security |
| D-5 | Console email in dev | Demo-friendly |
| D-6 | Configurable moderation stub | NFR-10 without vision API |
| **D-7** | **Sharp as default enhancer** | Free, offline, no Replicate credits |
| **D-8** | **Tier + token UI (wireframe)** | Matches SB-F QA + boss wireframe |
| **D-9** | **Keyword prompt parser + hash fallback** | Makes Sharp feel responsive to prompts |
| **D-10** | **Subscription maintenance job** | Expire subs + purge data per retention (SB-F10/F11) |

Full log: `docs/DECISIONS.md`

---

## 7. Bug Log Summary (All Phases)

| # | Area | Symptom | Fix |
|---|------|---------|-----|
| 1 | OTP | No brute-force protection | Rate limit middleware |
| 2 | Deps | multer 1.x advisory | Upgraded to 2.x |
| 3 | Forgot password | Email enumeration | Uniform API response |
| 4 | Upload | >5 files → 500 | Map multer LIMIT errors → 400 |
| 5 | Mobile swipe | Janky gestures | Reanimated + Pan gesture |
| 6 | Mobile build | babel-preset-expo missing | Added dependency |
| 7 | Enhance | gamma() crash | Brightness-only darkening |
| 8 | Prompt route | `result is not defined` | Use `engine` / `notice` vars |
| 9 | Replicate | 402/429/422 | Default to Sharp |
| 10 | Expo SDK 56 | nav bar API removed | `NavigationBar.setStyle('dark')` |
| 11 | UI | Status bar overlap | Top safe area on all tab screens |
| 12 | UX | Settings hidden | Profile: Subscription \| Settings toggle |

Detailed table: `docs/EXPERIENCE_LOG.md` § Bug Log

---

## 8. Testing & Verification

### Automated (backend)
```powershell
cd backend
npm run dev          # terminal 1
node scripts/qa.mjs  # terminal 2 → expect 30/30 PASS
```

### Manual mobile checklist (device)
- [ ] Signup / login on LAN
- [ ] Upload 1–5 photos → score screen
- [ ] Enhance → swipe save/discard
- [ ] Add Prompt (try: `warm golden sunset`, `very vibrant`)
- [ ] Profile → Subscription → select plan → Upgrade
- [ ] Profile → Settings → edit profile → Change Password
- [ ] Token balance visible on Home / Profile

### Subscription QA (SB-F1–F14) — implemented behaviors
- Plans render with SALE tags; current plan highlighted
- Upgrade hidden on Expert Annual
- Cancel shows no-refund + term end + deletion date
- Debounce on Upgrade/Cancel buttons (`busy` state)
- Bottom nav: Home, Gallery, Library, Profile

---

## 9. AI Assistance — Experience Summary (for Part 2)

### What AI did well (Score 4–5)
- Rapid scaffolding of Express + SQLite schema from BRD
- Consistent REST patterns, validation, JWT auth
- Admin web pages with React Query
- Mobile screen layout with NativeWind
- End-to-end smoke scripts and QA mapping

### What needed human steering (Score 3–4)
- Security details (OTP rate limit, no email enumeration) — **omitted unless explicitly requested**
- React Native gestures / Reanimated — **needed iteration**
- BRD contradictions (token vs Monthly model) — **needed product decision**
- Real-device issues (LAN IP, safe areas, Android nav bar) — **not caught in simulator**
- Sharp vs Replicate trade-offs — **needed cost/reality discussion**

### Overall assessment template (copy to Part 2)
> AI accelerated **~70–80%** of boilerplate and CRUD. Highest value on backend and admin web. Mobile gestures, device-specific UI, and enhancement realism required the most manual QA and follow-up prompts. For production, AI is strong as a **pair programmer** but weak as a **sole QA engineer** on physical devices and paid API edge cases.

---

## 10. How to Run (Demo for Boss)

### Prerequisites
- Node.js ≥ 22.13 recommended
- PC and phone on **same Wi‑Fi**
- Expo Go on Android phone

### Start backend
```powershell
cd backend
npm install
npm run migrate
npm run seed
npm run dev
# Note your PC LAN IP, e.g. 192.168.1.4
```

### Start mobile
```powershell
cd mobile
$env:EXPO_PUBLIC_API_BASE="http://192.168.1.4:4000"
npx expo start --lan
# Scan QR with Expo Go
```

### Start admin (optional)
```powershell
cd admin-web
npm install
npm run dev
# http://localhost:5173 — admin@viralvelocity.app / Admin123
```

### Demo logins
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@viralvelocity.app | Admin123 |
| User | emily@example.com | Demo1234 |
| QA test | test@example.com | Passw0rd |

---

## 11. File Reference (Documentation Map)

| Document | Purpose |
|----------|---------|
| `README.md` | Quick start + stack overview |
| **`docs/PROJECT_PROCESS_TIMELINE.md`** | **This file — full process timeline** |
| `docs/EXPERIENCE_LOG.md` | Feature-by-feature AI scores (Part 2 table) |
| `docs/DECISIONS.md` | Architecture decision record |
| `Viral_Velocity_App_Part1_Overview.docx` | Plan, risks, 5-day timeline (assignment) |
| `Viral_Velocity_App_Part2_Logs.docx` | Filled experience + bug logs + ratings |
| `backend/scripts/qa.mjs` | 30 automated BRD checks |
| `backend/.env` | `ENHANCE_ENGINE`, trial limits, optional Replicate token |

---

## 12. Final State Summary (One Paragraph for Report)

We delivered a working **Viral Velocity Engine** monorepo: REST backend with SQLite, React admin portal, and Expo mobile app covering auth, photo upload/scoring, AI-style enhancement with user prompts, library management, tiered subscription/billing with token balance, and admin operations including discounts and 2FA. Development followed a **5-day AI-assisted plan**, then extended with **real-device testing** that surfaced enhancement API costs, Sharp-based free processing, prompt parser improvements, subscription wireframe alignment, and Android UI fixes. Backend QA passes **30/30** automated checks; the mobile app runs on **Expo Go over LAN**. The process demonstrates that AI tools excel at scaffolding and CRUD but require human oversight for security, gestures, device layout, and third-party API economics.

---

*End of process documentation.*
