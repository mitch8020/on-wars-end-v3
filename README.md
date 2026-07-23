# On War’s End v3 — The Vellan Accord

A complete browser adaptation of a cooperative negotiation board game for **2–6 countries**. Every player owns one country with an asymmetric economy, private national mandate, and dangerous red line.

The table has six rounds to survive regional crises, build credible relationships, and collect every signature on the Vellan Accord.

## Play

```bash
npm install
npm run dev        # http://localhost:4174
npm test           # deterministic engine and balance simulations
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

See [RULES.md](./RULES.md) for the complete rules.

## Verification

`src/game/engine.test.ts` covers deterministic setup, 2–6 player rosters, phase cadence, contribution spending, exchanges, Trust, signature readiness, invariants, and complete AI playthroughs. The balance simulation requires both victories and defeats at **every** supported player count.

`e2e/walk-v3.mjs` walks a real Chromium browser through setup, briefing, Cabinet, crisis, summit, hotseat privacy, and mobile rendering while failing on browser errors.

```bash
# With the dev server running on port 4174
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
    state.ts         shared state operations
    invariants.ts    saved-state and transition integrity checks
    random.ts        seeded random sequence utilities
    ai.ts            deterministic policy, commitment, and summit choices
    engine.test.ts   rules and complete-game simulation coverage
  components/
    TreatyWeb.tsx    central relationship board
    ActionDock.tsx   current-phase coordinator
    actions/         isolated controls for each round phase
    ...              setup, tracks, dossiers, overlays, and table shell
  session/
    useGameSession.ts  browser game lifecycle, AI turns, and hotseat privacy
    gameStorage.ts     validated local save adapter
```

The UI does not duplicate rule logic. It asks the same engine that powers tests and AI whether actions and signatures are legal.
