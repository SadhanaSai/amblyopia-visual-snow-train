# Dichoptic Training + NOPT Trainer

A two-module, clinical-grade home vision training web app:

- **Phase 1 — Dichoptic training** for diagnosed amblyopia (lazy eye): red/cyan anaglyph exercises that rebalance input between the weak and strong eye to reduce suppression and improve binocular function.
- **Phase 2 — NOPT / VSS exercises** for Visual Snow Syndrome: noise adaptation, oculomotor (saccadic/vergence) training, and entoptic desensitization.

Built for personal use. Every exercise and assessment is grounded in peer-reviewed vision-science and neuro-optometry research published 2020–2025 — see the in-app Guide tab for citations, and the persistent clinical disclaimer for what this app is (and isn't) a substitute for.

## Stack

- React 18 + TypeScript (Vite)
- Tailwind CSS — utility classes only, no component libraries
- Canvas API for all stimulus rendering (no WebGL)
- `localStorage` for session, profile, and assessment persistence
- No charting library — all progress charts are canvas-rendered

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # typecheck + production build
npm run typecheck # tsc -b --noEmit
```

## What's in here

- **Onboarding** — a blocking 4-screen wizard (weak eye, diagnosis, contraindications, protocol overview) before any training content is reachable.
- **Screen calibration** — matches a physical reference object (banknote or paper) against an on-screen rectangle to derive pixels-per-mm, so every stimulus size is specified in real visual-angle units.
- **Assessments** — visual acuity (logMAR), contrast sensitivity (simplified QUEST+ over a log-parabola CSF model), stereoacuity (random-dot stereogram), and suppression depth, each with a weekly/biweekly reminder.
- **6 dichoptic exercises** — grating fusion, letter/optotype discrimination (3 paradigms), binocular rivalry probe, global motion coherence, dichoptic reading, and fixation stability training.
- **5 NOPT modules** — visual noise adaptation, saccadic training (3 sub-modes), vergence + accommodation training (3 sub-modes), entoptic desensitization (3 sub-modes), and an educational chromatic simulator.
- **Progress dashboard** — five canvas-rendered charts (VA, CSF, suppression, stereoacuity, compliance heatmap) with clinical reference lines and milestone markers.

Every exercise and assessment opens on a plain-language "what this does / how to use it" intro screen before handing off to the actual controls.

## Status

Functionally complete against the app's own spec, with a couple of deliberately scoped-down pieces flagged in the commit history (a 12-passage starter reading corpus instead of 30, and anaglyph as the only implemented display mode for now). See `git log` for the phase-by-phase build history.

## License

[MIT](./LICENSE). See also [DISCLAIMER.md](./DISCLAIMER.md) — this is not a medical device or a substitute for professional care.
