# AI Coding Experience Log (mirrors Part 2, §7)

Build of the Viral Velocity Engine with AI assistance. Scores are 1–5 (AI effectiveness for that piece). This file is updated as features are completed and is transcribed into `Viral_Velocity_App_Part2_Logs.docx` for the final report.

| Feature / Screen | Time Taken | What AI Did Well | Issues & Fixes | Score |
|---|---|---|---|---|
| **Backend: scaffold & DB migrations** | ~20m | Generated full Express(ESM)+better-sqlite3 setup and faithfully mapped the BRD MySQL schema (ENUM→CHECK, JSON→TEXT, AUTO_INCREMENT→AUTOINCREMENT) into one migration. | None major; chose SQLite over MySQL for zero-config (documented in DECISIONS D-1). | 5 |
| **Backend: Auth APIs** | ~25m | Signup/login/OTP/change-password with bcrypt+JWT, parental (<18) gate, welcome email, Remember Me. Validation + error shape consistent. | Had to **explicitly** add OTP rate-limiting + "don't reveal account existence" (NFR-6/FP-NF6) — AI omitted by default, matching the Part 1 risk note. | 4 |
| **Backend: Photo upload + Scoring** | ~20m | Multer 1–5 limit, deterministic mock scorer with 5 sub-scores, moderation gate respecting admin tolerance. | Multer 1.x flagged as vulnerable → upgraded to 2.x. Trial accounting needed manual care. | 4 |
| **Backend: Enhancement API** | ~15m | Up to 5 versions, swipe save/discard (Passed/Failed), prompt-based further edits, soft delete. | Route ordering for `/enhancements/:id` vs `/:id` needed attention. | 4 |
| **Backend: Subscription API** | ~15m | Monthly/Annual + discount math, upgrade rule (Annual hides upgrade), cancel flow with term-end + data self-deletion date. | Resolved BRD token-vs-subscription contradiction toward FR/schema model (DECISIONS D-2). | 4 |
| **Backend: Admin APIs** | ~25m | Dashboard KPIs, Images Matched (+detail Passed/Failed), Subscribers, activate/deactivate, discount config, retention, 2FA login challenge, CSV export. | CSV export needed manual implementation (Part 1 flagged this as commonly incomplete). | 4 |
| **Admin Login (Web) + 2FA** | ~15m | Clean login, Remember Me, 2FA challenge screen, protected routes, token storage. | — | 5 |
| **Admin Dashboard (Web)** | ~10m | KPI cards + Recent Activity table via React Query. | — | 5 |
| **Admin Images Matched (Web)** | ~15m | Search filters, View detail, Delete w/ confirm, retention modal, Export. | — | 4 |
| **Admin Subscribers Page (Web)** | ~15m | Search/filter, inline status dropdown w/ confirm, discount modal w/ validation, Export. | — | 4 |
| **Admin Profile + 2FA (Web)** | ~10m | Edit profile, change password, enable/disable 2FA. | — | 5 |
| **Mobile: Auth screens** (Landing/Login/SignUp+parental/OTP) | ~70m | Clean NativeWind screens, validation, parental Modal wired to backend 403 code. | Parental branch + OTP throttle needed explicit prompting. | 4 |
| **Mobile: Dashboard / Upload / Scoring** | ~60m | expo-image-picker multi-select (cap 5), Recent Activity, score badge + collapsible sub-scores, batch arrows. | Selection-limit + "arrow only when >1" needed manual tightening. | 4 |
| **Mobile: Enhance (swipe) / Compare / Library / Subscription / Settings** | ~115m | Gesture-handler + Reanimated swipe stack, compare delta, filtered library, plans/discount, settings. | Swipe was hardest (worklets plugin + thresholds); `babel-preset-expo` missing for bundling; resolved. Android bundle OK. | 3–4 |
| **Post-build: Device QA + enhancement + billing wireframe** | ~8h+ | Sharp engine, prompt parser, tier subscription UI, safe areas, Android nav bar, crash fixes. | Replicate credits; Expo SDK 56 API changes; status bar overlap. See `docs/PROJECT_PROCESS_TIMELINE.md` Phase 6. | 3–4 |

**Verification:** Backend QA = **30/30** BRD-mapped checks pass (`backend/scripts/qa.mjs`); admin web builds clean under TS strict; mobile passes `tsc --noEmit` and Metro bundles all platforms.

## Bug & Issue Log (mirrors Part 2, §8)

| # | BRD Test ID | Screen / Feature | Bug | Root Cause | Fix | Status |
|---|---|---|---|---|---|---|
| 1 | NF-7 / FP-NF7 | Backend OTP | OTP reset had no brute-force protection initially | AI skipped throttling unless asked (known weakness) | Added in-memory `rateLimit` + per-OTP attempt cap | Fixed |
| 2 | — | Backend deps | `multer@1.x` high-severity advisory | Outdated default version | Upgraded to `multer@2.x`; `nodemailer` to latest | Fixed |
| 3 | FR-5 / FP-NF6 | Backend forgot-password | Response could reveal whether an email exists | Naive implementation | Uniform response regardless of account existence | Fixed |
| 4 | F-8 / PU-F8 | Backend upload | Need hard cap at 5 files | — | Enforced at multer layer + route check | Fixed |
| 5 | NF-3 | Backend upload | Uploading >5 files returned HTTP 500 (caught in QA) | Error handler mapped only one multer code | Map all multer `LIMIT_*` errors → 400 | Fixed |
| 6 | EV-NF15 | Mobile Enhance | Swipe save/discard janky | Default Animated unreliable on RN | gesture-handler Pan + Reanimated worklets + thresholds | Fixed |
| 7 | — | Mobile build | Android bundling failed (`babel-preset-expo` not found) | Custom `babel.config.js` needs it as direct dep | `expo install babel-preset-expo` | Fixed |
| 8 | FR-23 | Subscription | Upgrade shown on top (Annual) plan | Missing plan-rank check | Hide upgrade on Annual via plan rank | Fixed |
| 9 | FR-15 | Mobile prompt | Prompt appeared broken (Replicate 402/429) | Paid API unavailable | Default to Sharp; keyword parser + user notices | Fixed |
| 10 | — | Backend enhance | HTTP 500 on enhance | Sharp gamma out of range | Brightness-only darkening | Fixed |
| 11 | — | Mobile launch | `undefined is not a function` crash | Expo SDK 56 removed nav bar color API | `NavigationBar.setStyle('dark')` | Fixed |
| 12 | SB-* | Subscription UI | Wireframe tiers/tokens missing | Initial Monthly-only build | Tier plans + token balance + Profile toggle | Fixed |
| 13 | — | Mobile UI | Status bar / nav bar clash | Missing safe area + light system chrome | Top insets + dark theme | Fixed |
