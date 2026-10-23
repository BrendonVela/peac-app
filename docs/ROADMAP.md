# PEAC Roadmap — features competitors have (Bridge Athletic, TrainHeroic, TeamBuildr)

Already in PEAC: Excel import, video exercise library, per-set targets, % of max weights, warm-ups,
step-by-step workouts + supersets, rest timer, "last time", PRs + charts, daily check-ins, performance tests,
calendar, messaging + announcements, push notifications, sign-up codes, admin tools.

## High value (done Oct 2026)
- [x] Teams / groups — put athletes in groups, assign/compare by group
- [x] Leaderboards — rank athletes on lifts, jumps, sprints; team records
- [x] RPE + training load — session RPE x minutes, weekly load
- [x] Compliance & attendance report — who is / isn't doing workouts, export
- [x] Exercise swaps — coach-set alternatives athletes can swap to
- [x] Athlete video uploads — film a set, send to coach for form check
- [x] Weight-room screen (kiosk) — tablet on the wall, tap name, log

## Medium value (done Oct 2026)
- [x] Program builder in the app (add days, copy weeks, drag exercises)
- [x] Import from PDF / whiteboard photo (AI)
- [x] Readiness-based adjustments (low check-in -> lighter weights)
- [x] Linked maxes (front squat = % of back squat)
- [x] Custom forms / questionnaires
- [x] Interval timers (EMOM, Tabata, sprints)
- [x] Works offline
- [x] Assistant coaches / staff roles

## Business & bigger projects
- Sell programs / marketplace + payments
- Nutrition (meal plans, food log, macros)
- Education content
- Device connections (VALD, GymAware, wearables)
- Custom branding per coach
- Templates library

Sources: bridgeathletic.com/strength-coach, trainheroic.com/strength-coach-platform,
us.fitgap.com/products/trainheroic, scienceforsport.com (TeamBuildr)

## To do — set up later
- [ ] Turn on PDF / photo import (button already in Programs; shows "not set up" until a key is added)
  - Option A (paid): Anthropic key — console.anthropic.com -> Billing (add credit) -> API Keys -> Create Key,
    then Vercel -> Settings -> Environments -> Production -> Add variable (Secret) ANTHROPIC_API_KEY, then redeploy.
  - Option B (free tier, limits): switch importer to Google Gemini (aistudio.google.com key). Free-tier data may be
    used by Google to improve products; check current limits first. Ask Claude to add this.
  - Free workaround now: Excel 365 Data -> Get Data -> From PDF, save as .xlsx, use Excel import; or build with Edit program.
- [ ] Apple Developer account ($99/yr) + Mac/cloud Mac for App Store (see docs/APP_STORE.md)
- [ ] Native iPhone push (APNs) once wrapped for the App Store

