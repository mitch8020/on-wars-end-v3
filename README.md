# On War’s End v3 — The Vellan Accord

A complete browser adaptation of a cooperative negotiation board game for **2–6 countries**. Every player owns one country with an asymmetric economy, private national mandate, and dangerous red line.

The table has six rounds to survive regional crises, build credible relationships, and collect every signature on the Vellan Accord.

## Play

```bash
npm install
npm run dev        # http://localhost:30073
npm test           # unit, session, and component tests
npm run test:coverage
npm run lint
npm run build
```

The game is client-only and saves automatically in `localStorage`.

## Table modes

- **Solo envoy:** lead one country while deterministic AI envoys own the remaining countries.
- **Pass & play:** one local player owns each country. A private handoff curtain protects policy hands and national mandates.

## What changed from v2

v2 is a faithful two-country implementation of the original rules. v3 is a gameplay-first redesign that implements the expanded one-country-per-player roster and shortens the game’s decision cadence.

| v2 | v3 |
|---|---|
| Two implemented countries | Two to six implemented countries |
| Five sequential Maintenance turns each round | One consequential Cabinet policy each round |
| Need / Offer / Claim pool | Persistent one-for-one summit proposals |
| Binary Treaty Token reveal | Four-part signature readiness: mandate, red line, Peace, Trust |
| Hidden conditions can cause sudden group defeat | Red lines create recoverable political pressure |
| Director or two-player hotseat | Solo AI or 2–6 player pass-and-play |

## Gameplay systems

- Six asymmetric countries: Aravell, Tomerin, Veyra, Karsk, Belovar, and Namarra.
- Six shuffled regional crises with player-count scaling.
- Three-card Cabinet hands drawn deterministically from 16 policies.
- Resource, Population, Military, Peace, Unrest, and Refugee economies.
- Pairwise Trust relationships shown directly on the Treaty Web.
- Public summit proposals, bilateral backchannels, permanent signatures, and hidden mandate discovery.
- Deterministic seeds, replayable setups, automatic local saves, and an in-game rules guide.
- Pure state transitions with invariant checks after every action.
- A state-driven Three.js peace table with physical delegation mats, resource pieces, crisis and policy decks,
  signature seals, and illuminated Trust cords.
- Tactile policy hands with sequenced dealing, card backs, keyboard navigation, reduced-motion behavior, and
  hotseat-safe reveals.
- Guided table cameras, responsive folio drawers, a non-WebGL fallback, optional procedural table sounds, and
  staged AI turns that can be skipped without changing their deterministic decisions.

See [RULES.md](./RULES.md) for the complete rules.

## Verification

The Vitest suite covers the game engine, deterministic setup, 2–6 player rosters, phase cadence, contribution spending, exchanges, Trust, signature readiness, invariants, complete AI playthroughs, browser session lifecycle, and React interactions. `npm run test:coverage` enforces 100% statements, branches, functions, and lines.

`e2e/walk-v3.mjs` walks a real Chromium browser through corrupt-save recovery, setup, briefing, Cabinet, crisis, summit, saved resume, new-table confirmation, a complete hotseat exchange, privacy handoffs, and mobile rendering while failing on browser errors or incorrect resource/Trust transfers.
It uses a fixed dispatch code for repeatable runs. Set `SHOTS_DIR` to write its screenshots outside the checked-in `shots/` folder.

```bash
# With the dev server running on port 30073
node e2e/walk-v3.mjs
```

## Architecture

```text
src/
  game/
    data.ts          stable public content API
    catalog/         countries, policies, crises, resources, and tracks
    engine.ts        stable public game API
    setup.ts         deterministic game creation
    rules.ts         read-only legality and readiness rules
    reducer.ts       action-driven state transitions
    transitions/     phase actions, crisis resolution, and round lifecycle
    state.ts         shared state operations
    invariants.ts    saved-state and transition integrity checks
    random.ts        seeded random sequence utilities
    ai.ts            stable public AI API
    ai/              phase strategies, scoring, reserves, and turn execution
    engine.test.ts   rules and complete-game simulation coverage
  components/
    tabletop/        lazy Three.js table, accessible fallback, and guided scene shell
    TreatyWeb.tsx    accessible two-dimensional relationship fallback
    ActionDock.tsx   current-phase coordinator
    actions/         isolated controls for each round phase
    actions/summit/  Accord, Exchange, and Backchannel workspaces
    Overlays.tsx     stable public overlay API
    overlays/        reference drawer, pass curtain, and final communiqué
    ...              setup, tracks, dossiers, overlays, and table shell
  presentation/
    tableViewModel.ts  pure mapping from GameState to seats, Trust cords, proposals, and pieces
    useTableAudio.ts   muted-by-default procedural table cues
    webgl.ts           capability check for the accessible fallback
  session/
    useGameSession.ts  browser lifecycle, staged AI turns, and hotseat privacy
    gameStorage.ts     validated local save adapter
```

The UI does not duplicate rule logic. It asks the same engine that powers tests and AI whether actions and signatures are legal.
