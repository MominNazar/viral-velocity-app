# Building Viral Velocity — Our Experience

**Project:** Viral Velocity Engine (photo scoring + AI enhancement app)  
**How we built it:** AI-assisted development in Cursor, with human review, testing, and iteration  
**Date:** June 2026

---

## Introduction

This document captures **what it felt like** to build the Viral Velocity app — not the full technical spec, but the **experience**: what worked, what broke, what surprised us, and what we would do differently. It is written for anyone who wants to understand how AI coding tools performed on a real, multi-app product (backend + admin web + mobile).

We started from a Business Requirements Document (BRD), a 5-day plan, and assignment templates. We ended with a working monorepo, 30/30 automated backend QA checks, and a mobile app tested on a physical Android phone over Wi‑Fi.

---

## How We Approached the Build

We treated the AI assistant as a **fast junior developer** who could read the BRD and produce large amounts of code quickly — but who still needed a human to:

- Make product decisions when the BRD contradicted itself  
- Ask for security features the AI did not add by default  
- Test on a real phone, not just in the editor  
- Fix integration issues between third-party APIs and our budget (free vs paid)

Our workflow was simple: describe the feature → AI generates code → we run it → we report bugs in plain language → AI fixes → repeat until it works on device.

---

## Phase by Phase — What the Experience Was Like

### Days 1–2: Backend and admin — “This is going fast”

The first two days felt the most productive. The AI scaffolded Express, SQLite migrations, auth (signup, login, OTP reset), photo upload, scoring, enhancement APIs, subscriptions, and the full admin portal.

**What felt good:**  
We could go from BRD table names to working REST endpoints in minutes. The database migration faithfully translated MySQL-style schema into SQLite. Admin pages (dashboard, subscribers, discount config, 2FA) came together with minimal hand-coding.

**What we had to push for:**  
Security details did not appear unless we asked — OTP rate limiting, not revealing whether an email exists on forgot-password, proper error codes when uploading more than 5 photos. The AI’s first version often “worked on the happy path” only.

**Honest score for this phase:** 4–5 out of 5 for AI help. Backend and admin web are where AI shined brightest.

---

### Days 3–4: Mobile app — “Pretty screens, harder interactions”

The mobile app needed 17 screens: auth flow, upload, scoring, swipe-to-save enhancement, library, subscription, settings. NativeWind styling came quickly. Layouts looked clean.

**What felt good:**  
Forms, navigation, React Query wiring, and most screens were generated in a reasonable structure. Upload with multi-select and score badges worked without much fighting.

**What was hard:**  
The **enhance swipe** (save right, discard left) was the hardest single feature. Default React Native animations were janky. We needed gesture-handler, Reanimated worklets, and several rounds of tuning thresholds. This matched what our Part 1 risk register predicted: *“AI struggles with gesture-based mobile UX.”*

We also hit a build error (`babel-preset-expo` missing) that blocked Android bundling until we installed the right dependency.

**Honest score for this phase:** 3–4 out of 5. UI yes; gestures and device builds needed more human time.

---

### Day 5: QA and documentation — “Proof it works”

We ran an automated QA script against the backend (30 BRD-mapped checks). Everything passed. We filled the Part 2 Word document with experience logs and bug tables. At this point we thought we were done.

**Lesson:** Passing automated API tests is not the same as the app feeling good on a phone.

---

### Post-delivery: Real phone testing — “Where reality hit”

Testing on an Android phone via Expo Go over LAN (`192.168.1.4:4000`) opened a second wave of work. This phase took longer than some of the original build days combined.

| What we noticed | What we learned |
|-----------------|-----------------|
| Status bar and system nav bar overlapped content | Simulators hide Android 3-button nav and safe-area quirks |
| “Add Prompt” seemed broken | Replicate AI needed paid credits; errors were silent or confusing |
| Some prompts looked like they did nothing | Free Sharp processing ≠ real AI; we had to set expectations |
| Subscription screen didn’t match wireframe | First build used Monthly/Annual; boss wireframe wanted Starter/Pro/Expert + tokens |
| App crashed on launch after a UI fix | Expo SDK 56 removed old navigation-bar APIs — AI used outdated docs |
| Settings were hard to find | Small gear icon wasn’t enough; we added Subscription \| Settings toggle |

**The enhancement story** was especially educational. We wanted AI-powered photo edits from text prompts. Replicate worked in theory but failed in practice (no credits, rate limits, wrong model hash). We switched to **Sharp** — free, local, instant — and built a keyword parser so prompts like “warm golden sunset” or “very vibrant” still produce visible changes. Prompts like “add a hat” cannot work without paid true AI, and we now tell the user that honestly.

**Honest score for this phase:** 3 out of 5 for AI on its own — but 4 out of 5 when we treated AI as a fix loop driven by clear bug reports from real usage.

---

## Where AI Helped Most

1. **Boilerplate and CRUD** — routes, migrations, validation, JWT auth  
2. **Admin web** — forms, tables, React Query, protected routes  
3. **Consistency** — similar patterns across endpoints and screens  
4. **Documentation** — README, decision logs, QA scripts, Word doc generation  
5. **Debugging when given errors** — stack traces and log lines led to fast fixes  

**Rough estimate:** AI handled **70–80%** of the typing and structure. A traditional solo build might have taken 2–3× longer for the same scope.

---

## Where AI Struggled (and We Stepped In)

1. **Security by default** — rate limits, enumeration-safe responses  
2. **Mobile gestures** — swipe enhance needed multiple iterations  
3. **Device-specific UI** — safe areas, dark system bars, LAN API URL  
4. **Third-party economics** — AI suggested Replicate; we needed a free path  
5. **BRD contradictions** — token model vs Monthly/Annual; human decision required  
6. **Outdated API knowledge** — Expo SDK 56 breaking changes  

**Pattern:** AI is strong when the task is **well-defined and local**. It is weaker when the task needs **judgment, physical testing, or money decisions**.

---

## Bugs That Taught Us Something

- **OTP without rate limit** — AI shipped working auth but not abuse protection until we asked.  
- **Upload 6 files → 500 error** — edge cases need explicit QA, not assumption.  
- **`result is not defined` in prompt route** — copy-paste bugs still happen; tests catch some, not all.  
- **Sharp gamma crash** — AI used an API parameter outside valid range; one line fix after reading the error.  
- **Expo nav bar crash** — reminder to verify library version against current SDK docs.  

Each bug became a short conversation: “this happened on my phone” → fix → retest.

---

## Working With the BRD

The BRD was detailed but not always self-consistent. Example: subscription wireframe text described **token tiers** (Starter / Pro / Expert), while functional requirements and the database spoke **Monthly / Annual**. We implemented both over time: lifecycle rules from FR-21–25, tier UI from the wireframe after feedback.

**Experience takeaway:** AI will implement *something* from ambiguous specs. A human must choose which source of truth wins.

---

## Final Reflection

### Did we succeed?

Yes. We have:

- A backend with auth, photos, scoring, enhancement, subscriptions, admin  
- An admin web portal with dashboard, subscribers, discounts, 2FA  
- A mobile app with full user flow, tested on a real Android device  
- 30/30 automated backend QA checks  
- Process and experience documentation for the assignment  

### Would we use AI again this way?

**Yes — as a pair programmer, not as autopilot.**

We would still:

- Plan architecture decisions ourselves first  
- Run QA scripts early and often  
- Test on a physical device before calling a feature “done”  
- Be explicit about security and edge cases in prompts  
- Prefer free/local solutions when assignment budget is zero  

### One sentence summary

**AI got us to a demo-ready app quickly; human testing, product calls, and honest limits on “AI enhancement” turned it into something we could actually show and explain.**

---

## Self-Ratings (1–5, AI effectiveness)

| Area | Score | One-line reason |
|------|-------|-----------------|
| Backend APIs | 5 | Fast, accurate, easy to extend |
| Admin web | 5 | Standard React patterns; few surprises |
| Mobile UI (static) | 4 | Good layouts; minor polish needed |
| Mobile gestures | 3 | Needed several fix rounds |
| Real-device QA | 3 | Issues found only on phone |
| Enhancement / prompts | 3 | API cost + realism required pivot to Sharp |
| Documentation | 5 | Easy to generate and refine |
| **Overall** | **4** | Strong accelerator; not a replacement for testing and judgment |

---

## Closing Note for Management

This project was assigned to evaluate **how well AI coding tools build a production-style app with minimal hand-written code**. Our honest answer: they build **most of the app** well, but **the last mile** — security, gestures, device UI, paid APIs, and spec conflicts — still depends on a developer who reads errors, tests on hardware, and makes trade-offs.

The Viral Velocity app is proof that the combination works. The experience log is proof that the combination is not magic.

---

*Related files: `docs/EXPERIENCE_LOG.md` (detailed feature table), `docs/PROJECT_PROCESS_TIMELINE.md` (full technical timeline), `Viral_Velocity_App_Part2_Logs.docx` (assignment submission).*
