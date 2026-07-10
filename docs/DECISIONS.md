# Architecture & Build Decisions

A running log of choices made while building the Viral Velocity Engine with AI assistance.

## D-1 — Database: SQLite instead of MySQL
The BRD schema (section 7) is written in MySQL syntax (`ENUM`, `JSON`, `AUTO_INCREMENT`). To keep the exercise zero-config on Windows we use **SQLite (`better-sqlite3`)** and map types faithfully:
- `INT PK AUTO_INCREMENT` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `ENUM(...)` → `TEXT` + `CHECK (col IN (...))`
- `JSON` → `TEXT` holding JSON (parsed/serialized in the data layer)
- `DATETIME` / `DATE` → ISO-8601 `TEXT`

## D-2 — Subscription model
Implemented **Monthly/Annual + Free Trial** per FR-21–25 and the DB schema, not the token model in the subscription wireframe prose. Discounts are admin-configurable (FR-22, FR-35).

## D-3 — AI scoring & enhancement (Sharp-based, free)
No external AI key is required. **Scoring** uses `imageScore.js`: Sharp reads each photo’s pixels (resolution, exposure, contrast, color spread, aspect ratio) and maps them to the 5 BRD sub-scores + Social Score. **Enhancement** uses `imageEnhance.js` (Sharp filters, optional Replicate). Enhanced versions are re-scored from the output file with a small bias so scores usually improve (FR-17). Hash fallback remains if a file is unreadable.

## D-4 — Auth
JWT access tokens (bcrypt password hashing). "Remember Me" issues a long-lived token (30d) vs the default short one (1d). OTP reset codes are 6-digit, hashed at rest, expire in 10 min, and are **rate-limited** (NFR-6 / FP-NF7).

## D-5 — Email
Nodemailer with a JSON/console transport in dev — welcome (FR-3), OTP, and change-password verification emails are logged to the server console.

## D-6 — Content moderation
A configurable tolerance threshold (NFR-10) gates uploads. With no real vision model, moderation is a stub that can flag by filename keyword / a mock NSFW score and respects the admin tolerance setting.

## D-7 — Image enhancement: Sharp default, Replicate optional
`backend/src/services/imageEnhance.js` uses **Sharp** (free, local) by default. Set `ENHANCE_ENGINE=replicate` and `REPLICATE_API_TOKEN` for paid cloud AI. Prompts are parsed into color/contrast/blur intents; impossible prompts (e.g. “add a hat”) return a notice and apply a style tweak instead.

## D-8 — Subscription tiers + tokens (wireframe)
Migration `002_tokens_and_tiers.sql` adds `token_balance`, `plan_tier` (Starter/Pro/Expert), and `billing_cycle`. Mobile Profile tab implements the subscription wireframe (SB-F*) with one-time token packs. Admin can configure per-tier annual discounts via `tier_pricing` in app settings.

## D-9 — Android system UI
Dark status bar and navigation bar via `app.json`, `expo-status-bar`, and `NavigationBar.setStyle('dark')` (Expo SDK 56 — older `setBackgroundColorAsync` was removed).
