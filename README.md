# Frog Zap Words Learning Game

Frog Zap Words is a browser-based word typing game for K-8 learners. Kids type highlighted words to help a frog zap word-carrying flies before they reach the lily pad line.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://127.0.0.1:5173/`.

## Production Build

```bash
npm run build
```

The built static site is emitted to `dist/`.

## Firebase Multiplayer

The app uses the Firebase Web SDK and Firestore project `flies-eb316` for a single permanent session at `sessions/permanent`. Player presence and scores live under `sessions/permanent/players`, with throttled score writes to keep costs low.

Deploy the included Firestore rules before sharing the game publicly:

```bash
firebase deploy --only firestore:rules
```

The rules and client both stop writes once the session is 14 days old.

## Render Deployment

This repo includes `render.yaml` for Render Blueprint deployment as a static site:

- Build command: `npm install && npm run build`
- Publish directory: `./dist`

In Render, create a new Blueprint or Static Site from this GitHub repo. Render's static site docs describe connecting a Git repo and deploying on every push, and the Blueprint spec uses `runtime: static`, `buildCommand`, and `staticPublishPath`.

---

# Original Build Package

This package originally defined a browser-based infinite arcade typing shooter and now implements the frog pond learning retheme.

The project is intentionally split into:

- `html/` — concrete HTML UI references for screens, components, layout, HUD, overlays, and visual styling.
- `specs/` — Markdown build specifications from multiple perspectives so Codex has explicit direction.
- `architecture/` — technical architecture, game loop, state model, systems, and data contracts.
- `implementation/` — build checklist, file structure, engineering notes, testing prompts, and Codex handoff instructions.
- `qa/` — acceptance criteria, manual test scripts, and bug-prevention checklist.

## Core concept

The player controls a tiny stick-figure wizard at the bottom of the screen. Enemies descend from the top with letters or words attached. Pressing a key fires that exact letter upward. Matching projectiles destroy matching enemies. The game can continue forever through procedural spawning, increasing difficulty, score progression, and randomized enemy patterns.

## Non-negotiables

- No backend.
- Browser playable.
- Keyboard-first.
- Infinite/random arcade loop.
- Simple old-school UI.
- All UI must be implemented from the HTML reference files.
- All gameplay rules must follow the Markdown specs.
- Codex should not invent missing systems. If something is unclear, choose the simpler option and document it.
