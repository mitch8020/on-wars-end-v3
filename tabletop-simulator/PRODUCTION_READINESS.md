# On War's End v3 — Tabletop Simulator Production Readiness

This document is the durable inventory, acceptance contract, fixture matrix, risk register, and clean-pass gate for the desktop Tabletop Simulator adaptation of **On War's End v3 — The Vellan Accord**.

It covers the generated TTS save and the sources under `tabletop-simulator/`. It does not claim that the browser game's Solo Envoy AI is available in TTS. The supported game is two to six human-controlled delegations. Multi-person local hotseat/pass-and-play may preserve delegation privacy by handing control to the matching seated player. One person may operate several countries only as an explicitly open-information rehearsal: one operator cannot honestly preserve secrets from themself.

## Product boundary

The mod deliberately combines a scripted conference clock with tactile board-game resolution.

| Automated by the mod | Intentionally tactile |
|---|---|
| Setup roster and dispatch input | Revealing and discarding Crisis cards |
| First-chair selection | Policy legality, costs, targets, and effects |
| Round, phase, chair, and active-delegation order | Resource, Population, Military, Peace, Unrest, and Refugee movement |
| TTS built-in turn order during action phases | Crisis commitments, totals, results, and contribution-based Trust |
| Active-country, phase, and Round markers | Summit offers, exchanges, backchannels, and mandate reveals |
| Starting counter reset and active policy-hand dealing | Red-line Pressure and signature eligibility |
| Docket, console, status, camera, chat, and hotkey bridges | Moving seals and reading physical/reference rules |
| Clock save/load state | Physical component save/load state, handled by TTS |

Tactile resolution is not permission for ambiguity. Every manual rule must be completely and consistently stated on the component, quick reference, or TTS-specific notebook rules, and the table must provide enough physical state to execute and audit it.

Primary implementation evidence:

- `tabletop-simulator/README.md`
- `tabletop-simulator/src/global.lua`
- `tabletop-simulator/build-mod.mjs`
- `RULES.md`

## Entry points and user-facing surfaces

The mod has no app-owned URL routes or browser navigation. Its entry points are the generated local save, TTS-native menus and controls, the floating XML docket, physical objects, Notebook tabs, Game Keys, and chat commands inventoried below.

### Build and operator entry points

| Entry point | Expected result | Acceptance criteria | Finite edge cases |
|---|---|---|---|
| `npm run tts:build` | Generate the save, preview, manifest, and local art | Completes from a clean checkout; emits valid UTF-8 JSON and all declared PNGs; no source placeholders remain | Workspace path contains spaces/apostrophes; missing Playwright browser; stale output; moved repository; interrupted render |
| `npm run tts:verify` | Static production validation | Rejects missing assets, duplicate GUIDs, invalid tags, unsafe serialized Turns, bad layout, missing UI handlers, or malformed content | Missing file; non-absolute path; `file:` URI; duplicate object; incomplete deck; wrong hand color |
| `npm run tts:test:live` | Exercise the generated scripts in an already-open disposable readiness table | Refuses to mutate before exact save/session identity and White-host preflight pass; fails on Lua/runtime assertion; always attempts exact cleanup in `finally`; distinguishes product, transport, and cleanup failures | TTS closed; wrong/user table open; multiple/no White host; external editor ports unavailable; stale scripts; timeout; socket reset; cleanup failure |
| Generated `TS_Save_1.json` and `.png` | Installable local save | Named correctly, loads without Lua errors, and uses the expected preview | JSON copied without preview; old preview; generated save and assets from different builds |

Scripts are declared at `package.json:15-17`. Build products are documented at `tabletop-simulator/README.md:39-52`.

### Player entry points

| Surface | User-facing content and actions | Acceptance criteria | Finite edge cases |
|---|---|---|---|
| TTS Save & Load | `Games → Save & Load → On War's End v3 — The Vellan Accord` | Save appears once with correct cover/name and loads without an error dialog | Duplicate save folders; autosave chosen instead of original; stale local asset paths |
| Physical table | Central board, six mats, decks, cards, cubes, counters, markers, seals, hands, console, and reference | All components render, are readable, are reachable, and do not overlap; intended movable pieces can be manipulated | Missing art; oversized collider; object under board; lost component; nonstandard camera |
| Floating Conference Clock | Setup, roster, round, phase rail, chair/acting delegation, instruction, primary action, tools, and finish guard | Correct content and control visibility for every state; no truncation at supported UI scales | 720p/small UI scale; ultrawide; two-line roster; dragged off-screen; collapsed state |
| Physical console | Dynamic status plus NEXT, BACK, STATUS | Labels match the floating docket; controls obey the same authorization and transitions | Console missing; stale object script; overlapping buttons; click by ordinary player |
| TTS turn UI | Current active seat and native End Turn | Enabled only in Cabinet, Crisis Council, and Peace Summit; exact active order; one End Turn produces one transition | Empty active seat; seat change; unexpected color; simultaneous clock click |
| Private hand zones | Policy hands, separate mandate/red-line cards, and sealed Crisis commitments | Exact seat colors and `HandEligible` contract; policy/secret cards remain country-restricted; own, gained, exchanged, and proxy commitment pieces enter the matching hand and remain hidden; inactive hands remain empty | Multi-person handoff; solo open-information rehearsal; spectator/host/Black GM view; card dropped outside hand; foreign-tagged exchanged cube; seat disconnect |
| Notebook | Grey public TTS Rules, six color-private dossiers, and White Host Guide | Exact visibility matrix below; formatted BBCode; public text contains no mandate title/body or red-line body; describes only supported TTS modes and exactly matches physical/manual behavior | Browser-only instructions; stale effects; raw Markdown; wrong color; empty/duplicate tab; Black GM visibility |
| Options → Game Keys | Bind Next, Back, Status | All three keys register once and mirror their corresponding controls | Unbound keys; duplicate registration after reload; unauthorized mutating hotkey |
| Chat | `!owe` command family | Recognized commands are suppressed from public chat; responses and authorization are correct | Case; leading/trailing spaces; unknown suffix; ordinary table talk |
| Native TTS save/load | Save or resume a physical session | Clock and physical table resume consistently at every supported state | Save during delayed deal; finish guard armed; corrupt script state; moved asset directory |

Install and local-use instructions are at `tabletop-simulator/README.md:54-99`. Floating UI source is `tabletop-simulator/src/global.xml:1-172`.

### Notebook visibility matrix

| Tab color/title | Intended readers | Required content and exclusion |
|---|---|---|
| Grey — `TTS Rules` | Every seated color, spectators, White host, Black GM | Complete public TTS cadence and tactile protocols; no mandate title/body, no red-line body, no Solo Envoy/web-app claim |
| Blue — `Aravell — Private` | Blue and Black GM only | Aravell brief, mandate title/body, and red line; no other delegation secret |
| Red — `Tomerin — Private` | Red and Black GM only | Tomerin brief, mandate title/body, and red line; no other delegation secret |
| Green — `Veyra — Private` | Green and Black GM only | Veyra brief, mandate title/body, and red line; no other delegation secret |
| Yellow — `Karsk — Private` | Yellow and Black GM only | Karsk brief, mandate title/body, and red line; no other delegation secret |
| Purple — `Belovar — Private` | Purple and Black GM only | Belovar brief, mandate title/body, and red line; no other delegation secret |
| Teal — `Namarra — Private` | Teal and Black GM only | Namarra brief, mandate title/body, and red line; no other delegation secret |
| White — `Host Guide` | White host and Black GM only | Local setup, recovery, and authority guidance; no country secret; no internal test-harness jargon |
| Black, Orange, Brown, Pink | No authored tab | Must be absent or empty; Black receives no duplicate content because TTS GM visibility already exposes all authored tabs |

Static acceptance strict-compares every generated Notebook body to its source generator, verifies balanced BBCode, and scans public/host content against every private title/body. Live acceptance observes the matrix from Grey, White, Black, all six delegation colors, and at least one unused color.

### Modal inventory

The mod has no custom modal dialog.

- `ALL SIGNED` is an inline two-step confirmation that remains armed for five seconds.
- Unauthorized and invalid clock operations use targeted chat messages.
- TTS-native confirmation dialogs, Save & Load, and Workshop dialogs are platform surfaces, not mod-owned UI.

Acceptance requires the finish guard to be unmistakable, time out safely, and never hide a rule failure behind a generic success message.

## Roles and permissions

| Role | Capabilities | Acceptance criteria | Finite edge cases |
|---|---|---|---|
| Host / White operator | Configure setup; open, advance, undo, and finish the clock; use all read-only tools; manipulate physical table; read the White Host Guide | Every mutating scripted entry point authorizes the host; White cannot inspect color-private hands or tabs merely by being White | Host seated in a country; White spectator host; host migration/reconnect |
| Promoted player | Same scripted clock authority as host | UI, console, chat, and hotkeys behave identically for promotion | Promotion during a turn; promotion removed; two promoted users act together |
| Active delegation | Own one active country, its private hand, mandate, resources, counters, seal, Pressure marker, and turn | Can complete every tactile action and use native End Turn; cannot use host-only scripted mutations unless promoted | Wrong seat; empty seat; signed country continues; local hotseat seat switching |
| Inactive delegation seat | Physical country not in the selected prefix roster | Never enters turn order, receives no policy hand, and is visibly marked inactive | Player sits there; inactive component moved; inactive counter accidentally used |
| Spectator | Observe, request Status, frame Overview, and use ordinary chat | Cannot mutate the scripted clock unless host/promoted | Grey/White color; spectator clicks shared Collapse; spectator reconnect |
| Black GM | Adjudicate/recover the table and use TTS GM visibility | Black can inspect all private tabs/hands for support but does not receive a country, policy hand, turn, or extra scripted authority unless host/promoted | Accidental public reveal; GM seated during privacy test; Black confused with ordinary spectator |
| Multi-person hotseat/pass-and-play group | Hands control to the matching delegation player | Privacy remains protected between people; no incoming player sees the outgoing hand; turn order remains correct | Seat switch during delayed deal; forgotten handoff/curtain; shared display |
| Solo rehearsal operator | Controls two or more active delegations as one person | UI and turn order work, but the session is explicitly open-information and is never used as privacy evidence | Mislabelled as competitive/privacy-safe; one color left active; wrong seat during deal |

Clock authorization is implemented at `tabletop-simulator/src/global.lua:195-233` and `648-695`.

## Delegation and roster inventory

The roster is a fixed prefix, not an arbitrary subset.

| Players | Active delegations | Active seats | Refugees at setup | Active Trust edges | Active starting cubes |
|---:|---|---|---:|---:|---:|
| 2 | Aravell, Tomerin | Blue, Red | 4 | 1 | 21 |
| 3 | + Veyra | + Green | 6 | 3 | 31 |
| 4 | + Karsk | + Yellow | 8 | 6 | 41 |
| 5 | + Belovar | + Purple | 10 | 10 | 51 |
| 6 | + Namarra | + Teal | 12 | 15 | 61 |

| Country | Seat | FD/IN/FL/CP | Population | Military | National mandate | Red line |
|---|---|---|---:|---:|---|---|
| Aravell | Blue | 4/3/1/3 | 8 | 5 | Fuel ≥3 and Capital ≥3 | Fuel >0 |
| Tomerin | Red | 1/2/4/3 | 8 | 5 | Food ≥3 while Unrest ≤4 | Unrest <7 |
| Veyra | Green | 5/1/2/2 | 9 | 4 | Industry ≥3 and Fuel ≥2 | Capital >0 |
| Karsk | Yellow | 2/4/2/2 | 7 | 7 | Military ≥6 and Capital ≥3 | Military >2 |
| Belovar | Purple | 2/2/1/5 | 8 | 5 | Capital ≥6 and Population ≥6 | Population >3 |
| Namarra | Teal | 3/2/3/2 | 9 | 4 | Population ≥10 while Refugees ≤3 per active country | Refugees ≤4 per active country |

Natural partners begin at Trust 2: Aravell–Veyra, Tomerin–Namarra, and Karsk–Belovar. Every other active pair begins at Trust 1.

Sources: `tabletop-simulator/content.mjs`, `tabletop-simulator/src/global.lua`, `RULES.md`, and `tabletop-simulator/build-mod.mjs`.

## Control, input, command, and hotkey inventory

### Floating docket

| Control/input | Visibility and authority | Required behavior | Finite risk cases |
|---|---|---|---|
| Collapse `−/+` | Always visible; currently usable by any player | Toggle body and height 504/70 without changing clock state | Global versus per-player behavior; rapid repeat; dragged/collapsed panel |
| Roster dropdown `2–6` | Setup only; host/promoted | Select exact fixed-prefix roster; update active names and seated count immediately | Minimum/maximum; wrong seat; change after opening; direct fractional/nonnumeric callback; corrupt saved fraction/noninteger |
| Dispatch input | Setup only; host/promoted; integer; 9-character UI limit | Normalize to a positive whole number and display the effective value | Blank; zero; negative; maximum `999999999`; pasted invalid text; corrupt saved number |
| OPEN THE CONFERENCE | Setup only; host/promoted | Set Round 1 Briefing, reset scripted counters, deterministically plan and persist the Crisis order, chair, and Round 1 hands, update markers, and announce; physical hand delivery waits for Cabinet entry | Double click; already started; zero seated; missing deck/counter; physical pieces moved before opening |
| Primary advance | Running non-ended state; host/promoted | Advance exactly one table step or delegation turn; label matches state | Rapid click; console/UI collision; native End Turn collision; delayed deal |
| UNDO CLOCK | Enabled after opening; host/promoted | Restore exactly one clock state; clearly state that physical pieces are not undone | Setup; Round 1 Briefing; each phase boundary; round boundary; each ending |
| STATUS | Always available; any player | Privately report setup or current round, phase, chair, acting country/table step, and instruction | Setup, action turn, Aftermath, each ending, spectator |
| OVERVIEW | Always available; any player | Frame the full public table for only the invoking player; no state mutation | White versus colored seat; unusual display; repeated invocation |
| ALL SIGNED / CONFIRM | Summit and Aftermath only; host/promoted | First activation arms for five seconds; a second activation by the same or a different authorized operator records that second operator's explicit attestation that every physical signing requirement is legal, then disables Turns; the clock must not claim it independently validated tactile state | Timeout; same/different confirmer; unauthorized click; advance/undo while armed; invalid seals/locks; simultaneous defeat |

The XML definitions are at `tabletop-simulator/src/global.xml:19-168`; handlers are at `tabletop-simulator/src/global.lua:206-379`.

### Physical console and native turn control

| Control | Required behavior | Finite risk cases |
|---|---|---|
| Console NEXT | Same authorization, transition, status broadcast, marker update, and label as primary advance | Missing controller; stale GUID; ordinary user; simultaneous End Turn |
| Console BACK | Same as UNDO CLOCK | Boundary no-op; physical state already changed |
| Console STATUS | Read-only targeted status | Spectator color; controller label too long |
| TTS End Turn | Expected next active color advances once; final active color advances phase once | Wrong player; seat swap; empty seat; event arrives during `syncingTurns`; double input |

Console source: `tabletop-simulator/src/controller.lua:1-73`. Turn synchronization: `tabletop-simulator/src/global.lua:539-581`.

### Game Keys

Exact registered names:

- `On War's End: next`
- `On War's End: back`
- `On War's End: status`

Next and Back require host/promotion; Status is read-only. Registration is at `tabletop-simulator/src/global.lua:74-90`.

### Chat commands

| Command | Authority | Required behavior | Finite risk cases |
|---|---|---|---|
| `!owe help` | Any sender | Privately list commands and authority boundary | Mixed case; spectator |
| `!owe status` | Any sender | Private status with no state mutation | Setup and ended |
| `!owe next` | Host/promoted | One forward transition | Ordinary sender; double input |
| `!owe back` | Host/promoted | One reverse clock transition | Boundary; physical mismatch |
| `!owe finish` | Host/promoted | Same guarded finish workflow as docket | Wrong phase; timeout; false signature claim |
| `!owe view` | Any sender | Per-player Overview only | Spectator; repeated command |
| Unknown `!owe...` | Any sender | Suppress the command and privately report `Unknown command` | `!owe`, trailing spaces, concatenated suffix |
| Ordinary chat | Any sender | Pass through unchanged | Message happens to begin with `!owe` |

Chat implementation is `tabletop-simulator/src/global.lua:676-695`.

### Physical inputs

Every physical input requires a documented place, result, and recovery path:

- Sit/change to the matching active seat color.
- Pick up, inspect, flip, deal, play, and return cards.
- Move resource cubes between country mats, six printed commitment lanes, six printed proposal lanes, exchanges, and four resource supplies.
- Take Military commitment proxies from the fifth infinite supply only after reducing the matching national Military counter; always leave at least 1 Military.
- Increment/decrement global, national, and bilateral Trust counters.
- Reveal one Crisis and resolve/discard it.
- Place or clear a Pressure marker.
- Reveal only the separate mandate card when a rule requires it; the separate red-line card remains private.
- Post, identify, accept, return the request proxy, remove, and clear an exchange proposal in the printed country lane.
- Move a signature seal only when all four locks are open.
- Use Alt-hover/tooltips and the quick reference.
- Save, resume, reload the original table, or frame the camera.

After **every** physical change to Peace, Unrest, Refugees, an active Population counter, or an active Military counter, play pauses and the table checks all four immediate-defeat families before another piece moves or victory is confirmed. An apparent simultaneous victory cannot bypass defeat.

Red-line Pressure uses one precise crossing rule: each transition from safe to unsafe adds exactly 1 Unrest and places Pressure; remaining unsafe causes no repeated Unrest; returning safe clears Pressure; a later safe-to-unsafe recross adds 1 Unrest again. Each red-line evaluation is followed by the same immediate-defeat check.

Acceptance requires counters to remain within their rules ranges, private information to remain private where the play mode can support it, and lost/misplaced components to produce an actionable recovery path.

## Physical component inventory and acceptance

| Component | Count | Acceptance criteria | Finite edge cases |
|---|---:|---|---|
| Conference board | 1 | Low-profile, readable, no oversized collider, correct tracks/areas | Missing art; object moved/unlocked; camera crop |
| Country mats | 6 | Correct country, seat, starts, and readable bays; inactive state obvious | 2-player through 6-player layouts; overlap; wrong rotation |
| Policy decks | 6 × 16 | Complete, country-tagged, private deal of 3 to active seats | Deleted card; card in another container; mixed deck; insufficient quantity |
| Mandate cards | 6 | One separate country card each; correct face/back/tooltip; when revealed, leaves the private hand and returns face up to the printed MANDATE REVEAL space without exposing its red line | Public peek; wrong hand; flipped inside a still-private hand; reveal then persist face-up |
| Red-line cards | 6 | One separate country card each; correct face/back/tooltip; stays private throughout normal play | Public peek; wrong hand; accidental flip; mandate reveal |
| Crisis deck | 6 | One copy of each Crisis; one reveal per round | Wrong/multiple card; deleted card; deck exhausted early |
| Starting cubes | 61 | Exact country/resource starts | Cube lost, duplicated, mixed with inactive country |
| Resource supplies | 4 | Food, Industry, Fuel, Capital; inexhaustible and readable; templates are `HandEligible` | Empty/broken bag; wrong template/tag; gained cube cannot enter a hand |
| Military proxy supply | 1 | Inexhaustible, plainly labelled as a commitment proxy, `HandEligible`, and never mistaken for actual Military gain | Empty/broken bag; proxy not paired with counter reduction; proxy treated as resource |
| Printed commitment lanes | 6 | One country-labelled lane each; fit the maximum practical sealed/revealed pieces without marker collision | Wrong-country reveal; overflow; premature reveal; incomplete cleanup |
| Printed proposal lanes | 6 | One country-labelled GIVE/WANT lane each; six simultaneous proposals remain attributable and readable | Stale offer; missing WANT proxy; accepted/cleared offer; phase-marker collision |
| Population counters | 6 | Correct starts and immediate-loss boundary | Negative/out-of-range; inactive counter used |
| Military counters | 6 | Correct starts; commitment always leaves at least 1 | Zero/negative; policy and Crisis collision |
| Global counters | 4 | Peace 1, Unrest 3, Refugees `2N`, Round 1 | Values outside rules bounds; wrong roster scaling |
| Trust counters | 15 | Every unique pair, start 1/2, range 0–4 | Duplicate/missing pair; inactive edge; value outside range |
| Signature seals | 6 | Country-identifiable and movable to Accord | Invalid early signature; inactive seal; false all-signed state |
| Pressure markers | 6 | Country-identifiable; safe→unsafe adds Unrest +1 and places it; sustained unsafe adds 0; safe restoration clears it; later recross adds +1 again | Stale marker; skipped crossing; repeated evaluation without crossing |
| Hand zones | 6 | Exact transparent TTS seat color; each trigger has `HandZone`, country, and `HandEligible` tags; cards/pieces accepted by the documented tag contract | Wrong FogColor; overlap; inactive deal; generic supply cube; exchanged foreign-country cube; Military proxy |
| Turn marker | 1 | Moves to acting country and is unambiguous | Missing GUID; stale position in ended state |
| Phase marker | 1 | Moves across five phases and ended position | Missing GUID; marker disagrees with docket |
| Console | 1 | Readable dynamic status and three working buttons | Missing script; label overflow |
| Quick reference | 1 | Complete current cadence, locks, and defeat rules | Stale or omitted canonical effect |

Static inventory, hand-eligibility, private-card, board-integrity, Notebook, and artifact-digest assertions are in `tabletop-simulator/verify-mod.mjs`.

### Object interaction metadata

Every player-facing object nickname, description, Alt-hover tooltip, face/back, tag, locked/interactable state, and context-menu hand toggle is part of the UI contract. Static acceptance exhaustively checks all 16 policies in all six decks and targeted safety-critical metadata families: secret cards, supplies, Military proxies, commitment-capable pieces, hand zones, counters, seals, Pressure markers, boards, and generated asset pairings. The full 252-object metadata inventory remains a live/manual clean-pass obligation; no targeted static assertion is presented as exhaustive coverage of every field. Live acceptance verifies text is legible in normal hover/zoom use and that country/resource identity is available through words or symbols rather than color alone.

## Policy inventory and tactile acceptance

Each active policy deck must contain one copy of every policy. A policy may be played only in the acting country's Cabinet turn, from its hand, with payable costs and any valid active foreign target.

| Policy | Complete tactile effect |
|---|---|
| Emergency Harvest | Gain 3 Food |
| Factory Conversion | Spend 1 Capital; gain 3 Industry |
| Emergency Refining | Spend 1 Industry; gain 3 Fuel |
| Reconstruction Bonds | Gain 3 Capital; Unrest +1 |
| Demobilize a Brigade | Military −1; Population +1; Peace +1 |
| Strategic Levy | Spend 1 Industry and 1 Fuel; Military +3; Unrest +1 |
| Relief Corridor | Spend 1 Food and 1 Capital; move up to 2 Refugees into the acting country's Population; Peace +1 |
| Public Reassurance | Spend 1 Capital; Unrest −2 |
| State Visit | Spend 1 Capital; choose another active country; Trust +2; reveal its mandate; Peace +1 |
| Medical Mission | Spend 1 Food; another active country's Population +1; bilateral Trust +2; Peace +1 |
| Mutual Stand-down | Acting and target Military −1; bilateral Trust +2; Peace +2 |
| Open the Archives | Reveal another active mandate; bilateral Trust +1; Peace +1 |
| Quiet Procurement | Spend 1 Capital; gain 1 Industry and 1 Fuel |
| National Reserves | Gain 1 Food and 1 Fuel |
| Civilian Conversion | Military −1; gain 1 Industry and 1 Capital; Peace +1 |
| Ceasefire Line | Choose another active country; bilateral Trust +1; Unrest −1 |

Shared finite policy cases:

- Exact cost versus one resource short.
- Target required, omitted, self, inactive, or valid.
- Acting/target Military at 1 or 2 before a reducing effect.
- Relief Corridor with 0, 1, or at least 2 Refugees.
- Track delta at 0 and 10.
- Effect crosses, remains across, or restores a red line.
- Signed country plays and continues helping.
- Played card, held card, and dropped card all recover for the next hand.
- Undo and re-forward at the Briefing/Cabinet boundary preserve the accepted hand contract.

Canonical data and effects are at `src/game/catalog/policies.ts:3-147` and `src/game/state.ts:53-78`. TTS card content is at `tabletop-simulator/content.mjs:112-209`.

## Crisis inventory and tactile acceptance

Let `N` be the active roster size.

| Crisis | Requirement | Success | Failure |
|---|---|---|---|
| Winter Famine | Food ≥ `ceil(1.5N)` | Peace +2; Unrest −1; Refugees −1 | Peace −1; Unrest +2; Refugees +N |
| Continental Blackout | Fuel ≥ `ceil(1.25N)` | Peace +2; Unrest −1 | Peace −1; Unrest +2; Refugees +`ceil(N/2)` |
| Broken Rail | Industry ≥N and Capital ≥`ceil(N/2)` | Peace +2; Unrest −1; Refugees −1 | Peace −1; Unrest +1; Refugees +N |
| Camp Fever | Food ≥N and Capital ≥N | Peace +2; Unrest −1; Refugees −2 | Peace −1; Unrest +2; every active Population −1 |
| Guns at Dawn | Military ≥N | Peace +3; Unrest −1 | Peace −2; Unrest +2; Refugees +`ceil(N/2)`; every active Military −1 |
| Currency Panic | Capital ≥`ceil(1.5N)` | Peace +2; Unrest −1 | Peace −1; Unrest +2 |

For every Crisis and every N from 2 through 6, acceptance requires:

- Only requested resource types are committed.
- Commitments are whole and non-negative; zero is legal.
- A country cannot commit more than it owns.
- A Military commitment leaves at least 1 Military.
- Each country privately stages eligible own, gained, exchanged, or proxy pieces in its matching hidden hand; a sealed commitment is not placed publicly early.
- After the final seal, every country reveals into its own printed commitment lane so ownership and contribution units remain attributable.
- Resource cubes are spent to their matching supplies. Military proxies return to the proxy supply while the already-reduced national counter stays reduced. Over-contribution is not returned.
- The table can audit collective totals and each country's nonzero/zero contribution until Trust resolves.
- Every requirement must be met for success.
- Result tracks clamp correctly and immediate defeat takes precedence.
- Contribution-based Trust exactly matches the canonical rule: `fair share = max(1, floor((total required ÷ N) × 0.6))`; a pair whose two countries each meet fair share gains 1 Trust; a pair with exactly one zero contributor loses 1 Trust; all other pairs are unchanged.
- Resolve Trust, return spent pieces/proxies, clear all six lanes, discard the resolved Crisis, then expose the next top Crisis only at the next Briefing.

Finite cases per Crisis/N: zero total, one contributor, exact threshold, threshold minus one, over threshold, mixed requirement with one side short, and result at every immediate-loss boundary.

TTS Crisis content is at `tabletop-simulator/content.mjs:211-272`; canonical resolution is at `src/game/transitions/crisis.ts:8-105`.

## Summit action inventory and tactile acceptance

Each active country takes exactly one Summit action, chair first.

| Action | Acceptance criteria | Finite edge cases |
|---|---|---|
| Sign | Mandate met; red line safe; no stale Pressure; Peace ≥6; average Trust ≥2.0; move the correct seal; signature remains permanent; canonical Peace +1 is applied | Already signed; Peace 5/6; Trust 1.9/2.0; inactive Trust excluded; final signature; simultaneous defeat |
| Accept proposal | Foreign open offer in its printed lane; proposer still has offered cube; actor has wanted cube; exchange one each; Trust +1; Peace +1; return the WANT proxy and clear the lane | Own offer; stale offer; missing resource; multiple offers |
| Post proposal | Actor places its offered cube under GIVE and a type-identifying request proxy under WANT in its printed country lane; offered and wanted types differ; proposal remains identifiable and open until accepted or round end | Same resource; offered cube later spent; second offer by same country; six simultaneous offers; inactive proposer |
| Open backchannel | Spend 1 Capital; target another active country; Trust +2; reveal target mandate; Peace +1 | No Capital; self/inactive target; Trust already 4; already revealed |
| Pass | Complete the Summit turn with no other effect | Accidental double action; signed country passes |

Canonical behavior: `RULES.md:143-174` and `src/game/transitions/summit.ts:8-135`.

## Scripted state and transition inventory

### Versioned persistent clock state

The production schema is explicit and versioned. It is not considered implemented merely because a subset of these fields currently serializes.

- `schemaVersion`
- `started`
- `playerCount`
- `dispatchCode`
- `rngState`
- `crisisOrder`
- `crisisCursor`
- `round`
- `phase`
- `chairIndex`
- `turnIndex`
- `dealtRound`
- `dealGeneration`
- `outcome`
- `endFromPhase`
- `endFromTurn`

### Transient presentation/control state

- `panelCollapsed`
- `finishArmed`
- `finishArmGeneration`
- `syncingTurns`
- `dealBusy`

State acceptance requires:

- `schemaVersion` selects a known normalizer/migration; missing/older versions migrate without inventing a successful outcome; unknown future versions fail visibly to safe Setup.
- `rngState` is an unsigned nonzero 32-bit integer and resumes the canonical xorshift32 stream exactly.
- `crisisOrder` is a six-ID permutation and `crisisCursor` identifies the current/next card without relying on uncontrolled physical deck order.
- `dealtRound` changes only after all active countries hold the exact three intended cards; same-round Undo/re-forward is idempotent.
- `dealGeneration` invalidates every stale asynchronous callback. A callback may mutate only when its captured generation still equals the active generation.
- `dealBusy` blocks or safely rejects advance, back, start, finish, End Turn, and a second deal while the 0.8-second physical operation is incomplete; Status reports the busy stage.
- Saving during `dealBusy` never serializes an unrecoverable half-deal. Reload begins with `dealBusy=false` and either proves the completed hand identity or safely completes/rolls back the interrupted generation exactly once.

Other transient presentation state intentionally resets on script reload unless a future acceptance decision says otherwise.

### State machine

| State | Automated behavior | Tactile handoff | Acceptance and finite boundaries |
|---|---|---|---|
| Setup | Roster/dispatch editable; `OPEN THE CONFERENCE` visible; Turns disabled; setup camera/status | Seat the active roster and take only its private cards | 2/6 bounds; 0/N seats; malformed input; activate `OPEN THE CONFERENCE` twice |
| Briefing | Round/chair/table-step; phase marker; Begin Cabinet | Reveal/read exactly one Crisis | Round 1/6; undo from Round 2–6; absent/multiple Crisis |
| Cabinet turn 1…N | Active marker and TTS turn color; deterministic, guarded, once-per-round deal on entry | Play one legal policy or conserve; resolve pieces/counters | First/middle/last; empty seat; native/manual race; Undo boundary; Begin/Back/Begin; double advance; save/reload during deal |
| Crisis turn 1…N | Active order and Seal Commitment label | Commit requested pieces and retain an auditable total | Zero/exact/short/over; Military boundary; last-country result |
| Summit turn 1…N | Active order; guarded finish visible | Sign, accept, post, backchannel, or pass | Every action; first/middle/last; all signed |
| Aftermath | Turns disabled; table step; Next Round | Read communiqué and clear proposals | Signed finish; cleanup complete/incomplete; Round 1–6 |
| Ended — signed | Turns disabled; signed outcome/status | Read victory communiqué | Finish guard, false claim, Undo |
| Ended — round limit | Turns disabled; six-round outcome/status | Read defeat communiqué | Round 6 exact boundary, Undo |
| Ended — immediate defeat | Required production state; Turns disabled; exact reason/status | Read matching defeat communiqué | Unrest 10; Refugees `>5N`; active Population 0; active Military 0; precedence |

Forward transitions are at `tabletop-simulator/src/global.lua:382-421`; reverse transitions are at `423-455`; rendering and Turns are at `457-581`.

### Undo contract

Undo repairs only the scripted clock. It does not move cards, cubes, counters, proposals, Pressure markers, mandates, Crisis cards, or seals.

It must be tested at:

- Setup and Round 1 Briefing no-op.
- First, middle, and last turn of every action phase.
- Cabinet → Briefing.
- Crisis → final Cabinet turn.
- Summit → final Crisis turn.
- Aftermath → final Summit turn.
- Round N Briefing → prior Aftermath with chair reversal.
- Signed ending → exact originating Summit/Aftermath turn.
- Round-limit ending → Round 6 Aftermath.
- Unrest-10 immediate ending → exact originating clock state; because Undo is clock-only, re-checking while Unrest remains 10 must end again until the physical track is repaired.
- Refugees-above-`5N` immediate ending → exact originating clock state; re-checking must end again until the physical track is repaired.
- Active-Population-0 immediate ending → exact originating clock state and affected country; re-checking must end again until its physical counter is repaired.
- Active-Military-0 immediate ending → exact originating clock state and affected country; re-checking must end again until its physical counter is repaired.
- Armed finish → safely disarmed.

Re-forwarding after an Undo must not replace a previously dealt hand or duplicate an already-resolved physical action. Rapid Begin/Back/Begin, double advance, native End Turn during a deal, and save/reload during the delayed callback must all preserve exact card identity, one clock transition, and one completed deal generation.

## Setup, save, resume, reset, and end workflows

### New local table

1. Load the named original save.
2. Confirm all art and the expanded setup docket render.
3. Select N from 2 through 6 and confirm the displayed fixed-prefix roster.
4. Seat active delegations in the roster's matching colors.
5. Each active delegation privately takes its own separate mandate and red-line cards and checks its matching Notebook dossier; inactive secrets remain untouched.
6. Enter a bounded sanitized dispatch code.
7. Open the conference.
8. Confirm starts, Trust, exact deterministic chair/Crisis order, markers, inactive state, and disabled Turns.
9. Reveal one Crisis.
10. Begin Cabinet and confirm exact private active-only deals.

Acceptance: no manual repair is required before the first Cabinet decision.

### Save and resume

For each persistent state, save through native TTS, reload, and confirm:

- Clock state is exact.
- Runtime Turns safely reconstruct from disabled serialized defaults.
- Physical pieces and Lua state agree.
- Private hands remain private in multi-person play; a solo rehearsal is recorded as open-information and is not privacy evidence.
- Controller, markers, docket, labels, and status agree.
- No duplicate hotkeys or startup messages appear.
- A corrupt clock payload falls back safely and visibly.

Required resume points: Setup, Briefing, first/middle/last turn of every action phase, Aftermath, signed ending, round-limit ending, and each immediate-defeat ending.

Persistence code is in `tabletop-simulator/src/global.lua` (`onSave`, `onLoad`, and normalization). Serialized Turns safety is generated in `tabletop-simulator/build-mod.mjs` under the save's `Turns` block.

### Reset

Reloading the untouched original save is the authoritative full physical reset. Warn first that reload discards unsaved physical changes. A reset acceptance pass confirms all 145 top-level and 252 recursive generated objects return to their generated state and all 17 save-referenced asset URLs still match the 18-PNG generated manifest.

Opening a conference is not a substitute for a full physical reset unless every movable component is explicitly restored.

### End conditions

The table wins immediately when every active delegation has validly signed.

The table loses immediately when:

- Unrest reaches 10.
- Refugees exceed `5N`.
- Any active Population reaches 0.
- Any active Military reaches 0.
- Round 6 ends before every active delegation signs.

Immediate defeat takes precedence over a simultaneous apparent victory. The table performs this check immediately after every affected physical change, not only in Aftermath. Every ending must disable Turns and present a result, exact reason, and readable final communiqué.

## Sanitized production-scale fixture matrix

All fixtures use fictional game data already present in the repository. No production account, personal data, credential, network secret, or external user save is required.

### Roster matrix

Run every workflow for N = 2, 3, 4, 5, and 6, not only setup:

- Setup with 0, N−1, N, and one wrong/inactive seat occupied.
- Open conference and verify all counter/Trust/resource starts.
- Deal exactly `3N` policy cards; all inactive hands receive 0.
- Complete every phase using docket, console, and native End Turn entry points.
- Cross every phase boundary and Undo it.
- Rotate chair through six rounds, including wraparound.
- Save/reload at the required resume points.
- Exercise signed, round-limit, and immediate-defeat endings.

### Deterministic dispatch fixtures

The dispatch UI is bounded to positive whole numbers with at most nine characters.

The Crisis orders and chairs below are exact goldens, not repeatability-only assertions. Crisis order is top-to-bottom. Chairs are listed for N=2/3/4/5/6.

| Dispatch | Exact Crisis order | Exact first chairs for N=2/3/4/5/6 |
|---:|---|---|
| `1` | `camp-fever`, `continental-blackout`, `guns-at-dawn`, `broken-rail`, `currency-panic`, `winter-famine` | Aravell / Aravell / Aravell / Aravell / Tomerin |
| `42` | `guns-at-dawn`, `continental-blackout`, `broken-rail`, `currency-panic`, `camp-fever`, `winter-famine` | Aravell / Tomerin / Tomerin / Tomerin / Veyra |
| `148802` | `camp-fever`, `guns-at-dawn`, `currency-panic`, `continental-blackout`, `winter-famine`, `broken-rail` | Aravell / Aravell / Tomerin / Tomerin / Tomerin |
| `999999999` | `guns-at-dawn`, `currency-panic`, `broken-rail`, `camp-fever`, `winter-famine`, `continental-blackout` | Aravell / Tomerin / Veyra / Karsk / Karsk |

Two-player deliberately starts with Aravell without consuming the extra chair RNG value. The displayed policy vectors below are independently checked spot oracles, not the complete required matrix. Before TTS-003 can close, a committed machine-readable fixture must cover all four dispatches, N=2…6, Rounds 1–6, every exact three-card hand, and resulting `rngState`; checking only counts or “same twice” can preserve a wrong algorithm.

#### Dispatch `148802` policy-hand goldens

These oracles were generated from and checked against the browser engine's canonical xorshift32/Fisher–Yates implementation in `src/game/random.ts`, setup consumption order in `src/game/setup.ts`, and country-by-country deal order in `src/game/state.ts`. The N=2 Round 2 vector was independently generated from the same canonical stream to complete this contract.

**N=2**

| Round | Country | Exact policy IDs in hand |
|---:|---|---|
| 1 | Aravell | `open-archives`, `factory-conversion`, `relief-corridor` |
| 1 | Tomerin | `relief-corridor`, `mutual-stand-down`, `demobilize-brigade` |
| 2 | Aravell | `civilian-conversion`, `factory-conversion`, `emergency-refining` |
| 2 | Tomerin | `strategic-levy`, `medical-mission`, `demobilize-brigade` |

Expected `rngState`: Round 1 complete `3207053324`; Round 2 complete `1588369397`.

**N=6**

| Round | Country | Exact policy IDs in hand |
|---:|---|---|
| 1 | Aravell | `factory-conversion`, `quiet-procurement`, `national-reserves` |
| 1 | Tomerin | `reconstruction-bonds`, `open-archives`, `public-reassurance` |
| 1 | Veyra | `state-visit`, `ceasefire-line`, `factory-conversion` |
| 1 | Karsk | `public-reassurance`, `reconstruction-bonds`, `relief-corridor` |
| 1 | Belovar | `quiet-procurement`, `open-archives`, `national-reserves` |
| 1 | Namarra | `emergency-harvest`, `factory-conversion`, `public-reassurance` |
| 2 | Aravell | `civilian-conversion`, `relief-corridor`, `medical-mission` |
| 2 | Tomerin | `emergency-refining`, `mutual-stand-down`, `ceasefire-line` |
| 2 | Veyra | `emergency-harvest`, `emergency-refining`, `national-reserves` |
| 2 | Karsk | `ceasefire-line`, `public-reassurance`, `emergency-refining` |
| 2 | Belovar | `quiet-procurement`, `factory-conversion`, `open-archives` |
| 2 | Namarra | `state-visit`, `ceasefire-line`, `medical-mission` |

Expected `rngState`: Round 1 complete `2666324742`; Round 2 complete `2756634770`.

Normalization fixtures:

- Blank/non-number input → documented default `148802`.
- `0` → `1`.
- `-42` → `42`.
- `41.6` → `42` using canonical nearest-integer normalization.
- Values above the nine-digit UI maximum → `999999999`.
- Re-enter each valid dispatch twice in fresh original saves → the exact golden chair and complete Crisis order above; once the required machine-readable fixture is committed, also match every policy identity and RNG state in that full fixture.

### Corrupt saved-state fixtures

Use synthetic script payloads only:

| Fixture | Expected recovery |
|---|---|
| Empty saved data | Clean default Setup |
| Invalid JSON | Clean default Setup plus actionable warning |
| JSON scalar/array | Clean default Setup plus warning |
| Empty object | All missing fields normalized |
| Missing/legacy `schemaVersion` | Run the explicit migration, report it, and emit the current schema on next save |
| Unknown future `schemaVersion` | Refuse the payload visibly and enter safe Setup; never reinterpret it as an ending |
| `playerCount` below 2 / above 6 | Clamp to 2 / 6 |
| Fractional/noninteger `playerCount` | Round to the nearest integer, clamp to 2…6, and visibly report corrupt-state normalization |
| Dispatch missing/nonnumeric, 0, negative, fractional, or above maximum | `148802`, `1`, absolute rounded value, nearest integer, or `999999999`, respectively |
| `rngState` zero/noninteger/outside uint32 | Safe Setup plus actionable deterministic-state warning |
| `crisisOrder` missing, duplicated, unknown, or not six IDs | Safe Setup plus actionable deterministic-state warning |
| `crisisCursor` outside the six-card order | Safe Setup plus actionable deterministic-state warning |
| Round below 1 / above 6 | Clamp to 1 / 6 |
| Fractional/noninteger round | Round to the nearest integer, clamp to 1…6, and visibly report corrupt-state normalization |
| Invalid phase | Briefing |
| Chair/turn below 1 / above N | Clamp to valid active index |
| Fractional/noninteger chair or turn | Round to the nearest integer, clamp to the active roster, and visibly report corrupt-state normalization |
| `dealtRound` outside 0–6 or ahead of `round` | Safe Setup plus actionable deal-state warning |
| Missing/negative/noninteger `dealGeneration` | Normalize to 0 without accepting any stale callback |
| Saved `dealBusy=true`, complete exact hands | Load with `dealBusy=false`, prove identities, and mark the round dealt exactly once |
| Saved `dealBusy=true`, partial/wrong hands | Load with `dealBusy=false`, refuse advancement, and direct the host to reload the untouched original |
| Invalid outcome | Clear outcome |
| Invalid `endFromPhase` | Safe Aftermath fallback |
| `endFromTurn` below/above range, fractional, or noninteger | Round to the nearest integer, clamp to the saved active roster, and visibly report corrupt-state normalization |
| Nonboolean `started` | Setup |
| Ended without a valid outcome/reason | Safe, explicit recovery rather than misleading “six rounds complete” |

### Round/phase matrix

For each N and each dispatch fixture:

- Briefing table step.
- Cabinet turns 1 and N, plus a middle turn when N ≥3.
- Crisis turns 1 and N, plus a middle turn when N ≥3.
- Summit turns 1 and N, plus a middle turn when N ≥3.
- Aftermath.
- Next-round Briefing and chair rotation.
- Round 6 Aftermath to round-limit ending.
- Undo across every boundary.

One no-victory round requires `3N + 2` forward clock operations after opening: one Briefing advance, N Cabinet turns, N Crisis turns, N Summit turns, and one Aftermath advance.

### Tactile rule fixtures

- All 16 policies, including every cost/target/boundary case.
- All 6 Crises at N=2…6 with zero, exact, one-short, and over-contribution results.
- Every Summit action and invalid variant.
- Trust at 0, 1, 2, 3, and 4; for each roster, test the greatest attainable average below 2.0 and exactly 2.0.
- Peace and Unrest at 0, 5, 6, 9, 10.
- Refugees at 0, `3N`, `4N`, `5N`, and `5N+1`.
- Population and Military at 0, 1, mandate/red-line boundaries, and normal values.
- Pressure safe→unsafe crossing adds Unrest +1; sustained unsafe adds 0; unsafe→safe clears Pressure; the next safe→unsafe recross adds Unrest +1 again.
- Card lost, misplaced, mixed, held, played, and recovered.
- Commitment conceal/reveal with an own starting cube, gained generic-supply cube, exchanged foreign-tagged cube, and Military proxy; none visible to the other delegation before reveal.
- Maximum practical pieces in all six commitment lanes at once, with no overlap or marker collision.
- Proposal valid, stale, accepted, and cleared; six simultaneous proposal lanes remain attributable; acceptance returns the WANT proxy.
- Separate mandate starts private, moves outside the hand to the printed mat space when revealed, and persists face-up while its paired red-line card/dossier remain hidden.
- Each individual Peace, Unrest, Refugee, Population, and Military change triggers the immediate-defeat check before any further physical action.

### Production-like runtime settings

- Generated save version `v13.3`.
- Full 145-top-level/252-recursive object table enforced against the manifest, 17 unique save-referenced asset URLs, and 18 generated PNG artifacts with standard byte-level SHA-256 digests.
- One artifact fingerprint binds the ordered asset-hash map and exact object totals in both the manifest and conference-board metadata. This detects stale/mixed local artifacts; without a publisher signature, it is an internal-consistency check rather than cryptographic source provenance or hostile-tamper resistance.
- All six mats and all physical inventories present even when N<6.
- Production lighting, compact layout, grid disabled, hands enabled.
- Native TTS local desktop runtime with the generated Global/controller scripts.
- A second local user perspective or multi-client test for privacy before any online release.

## Bug ledger

IDs intentionally match `C:\tmp\product-on-wars-end-tts.md`. `Implemented — awaiting live` means the privacy/tactile source and static oracle exist; it is **not closed** and does not claim a runtime pass. Every item remains release-open until focused regression, full inventory rerun, autoreview, and a cohesive commit are recorded.

| ID | Severity | Status | Finding |
|---|---|---|---|
| TTS-001 | High | Environment blocked; Open | Repeated live verification reaches `ECONNRESET` after the desktop TTS main thread hangs. |
| TTS-002 | Critical | Implemented — awaiting live | Baseline public Grey Notebook leaked all six mandate/red-line secrets and browser-only behavior. |
| TTS-003 | Critical | Open | Dispatch selected a chair but physical Crisis order/policy hands used uncontrolled TTS shuffles, and input normalization floors fractions instead of matching the accepted rounded/bounded browser contract. |
| TTS-004 | Critical | Open | Immediate defeat and complete outcome-specific communiqués are absent from the clock. |
| TTS-005 | High | Open | Undoing Cabinet to Briefing and re-forwarding can silently replace policy hands. |
| TTS-006 | High | Implemented — awaiting live | Player-facing policy/signing text omitted canonical Peace and resettlement effects. |
| TTS-007 | High | Implemented — awaiting live | Commitments and public proposals lacked executable, attributable physical workflows. |
| TTS-008 | Critical | Open | Live harness can mutate an unidentified/non-disposable user table and cleans up only after success. |
| TTS-009 | Medium | Open | Inactive delegations look playable in 2–5-country rosters. |
| TTS-010 | Critical | Implemented — awaiting live | One combined mandate/red-line card made selective mandate reveal disclose the red line. |
| TTS-011 | Critical | Implemented — awaiting live | Resource/proxy objects had `Hands=false` and no shared hand-zone tag, making sealed hand commitments impossible. |
| TTS-012 | High | Open | Uncancelled delayed deals allow Begin/Back/Begin, double advance, or save/reload races. |
| TTS-013 | High | Implemented — awaiting live | Embedded rules advertised unsupported Solo Envoy/web privacy instead of the exact TTS play boundary. |
| TTS-014 | Medium | Open | Any participant can collapse the globally shared docket. |
| TTS-015 | Medium | Open | Missing runtime objects generally fail silently. |
| TTS-016 | Medium | Open | Physical counter bounds and `ALL SIGNED` legality have no reliable validation aid. |
| TTS-017 | Medium | Open | Round-plan finalization and physical policy-card delivery are not separated/persisted, leaving timing and Undo semantics ambiguous. |
| TTS-018 | Medium | Open | Opening a conference does not restore all moved physical components. |
| TTS-019 | Medium | Open | Script-injected live checks do not prove visible clicks, tactile play, reload, privacy, or visual quality. |
| TTS-020 | Medium | Open — product decision | Conference can open with missing/wrong seats and then include empty active colors. |
| TTS-021 | High | Approval-gated limitation | Local absolute art paths cannot support remote clients or Workshop distribution without an approved upload. |
| TTS-022 | High | Open | Fractional/noninteger saved player-count, round, chair, turn, and `endFromTurn` indexes plus malformed direct roster callbacks survive current normalization and can produce invalid roster/state access. |

### Reproduction and closure evidence

| ID | Reproduction | Expected | Observed / evidence | Required regression |
|---|---|---|---|---|
| TTS-001 | Run the captured live verifier twice against the same open generated table after cleanup. | Each run completes or reports an actionable stage error without duplicating mutation. | Second isolated runs fail `read ECONNRESET`; `C:\tmp\owe-tts-live-baseline.out.log`, `C:\tmp\owe-tts-live-repro.out.log`, and TTS `Player.log` show the editor worker waiting on a hung main thread after Direct3D failures. | After approved restart, run at least three isolated disposable sessions; transport retry may repeat only proven read-only/idempotent stages. |
| TTS-002 | At baseline `48fa1d8`, open Notebook → Grey `Rules`. | Public TTS rules contain no private title/body; each delegation sees only its dossier. | Baseline builder embedded complete `RULES.md`, including every mandate/red line; six private tabs were empty. Evidence: `48fa1d8:tabletop-simulator/build-mod.mjs` and progress log TTS-002. | Static secret scan and strict body equality, then live Grey/White/Black/six-color/unused-color visibility matrix. |
| TTS-003 | Open fresh dispatch `148802` tables and record Crisis order, chair, and every hand; also enter blank, zero, negative, fractional, and over-nine-digit values. | Exact committed golden vectors on every fresh run/reload; effective input matches positive nearest-integer normalization bounded to `1…999999999`. | Chair repeated, but Aravell hands differed; `global.lua` used TTS `shuffle()`, floors fractions, does not explicitly clamp the saved value to the UI maximum, and `Player.log` recorded different triples. | Seeds `1`, `42`, `148802`, `999999999`, N=2…6, complete Crisis order, exact chair/hands/RNG from the required machine-readable fixture; normalization boundary matrix; displayed 148802 N=2/N=6 Rounds 1–2 spot checks. |
| TTS-004 | Move each loss track/counter to its boundary, or finish Round 6 unsigned. | Stop after each change; defeat overrides apparent victory; exact canonical title/reason/epilogue appears and Turns disable. | `src/global.lua` can end only through signed confirmation or Round 6 and provides no complete communiqué. | All four immediate families, simultaneous defeat/signature precedence, Round 6, save/reload, and clock-only Undo from each ending. |
| TTS-005 | Enter Cabinet, record three cards, Back to Briefing, then Begin Cabinet again. | Same-round clock repair leaves exact physical hands unchanged. | Baseline `global.lua` reclaimed, shuffled, and redealt on each Briefing→Cabinet transition. | Exact hand GUID/ID preservation for first/middle/last active countries and every roster; repeated Back/Begin. |
| TTS-006 | Read baseline State Visit, Medical Mission, Relief Corridor, and signing guidance. | Every card, tooltip, reference, and Notebook entry states the full canonical effect. | Peace +1 was missing from two policies/signing; Relief Corridor did not state acting Population destination. | Static exact-text oracle plus visible card sheet, tooltip, quick-reference, and Notebook inspection; execute boundary effects live. |
| TTS-007 | Attempt six sealed commitments and six simultaneous Summit proposals on the baseline board. | New players can conceal, reveal, attribute, total, resolve, accept, and clear using supplied lanes/components/instructions. | Baseline had no country-labelled commitment/proposal lanes, Military proxy, contributor trail, or cleanup convention. | Fill all six enlarged lanes; zero/exact/over Crisis cases; six proposals, accept one, clear five, no marker/seal collision. |
| TTS-008 | Start the harness while any table answering port 39999 is open; force failure after mutation. | Refuse before mutation unless exact disposable identity and one White host match; cleanup runs in `finally` and restores exact seats/deck order. | `live-test.mjs` injects before identity proof, reseats/mutates, and has success-only cleanup; current “persistence” only decodes `onSave`. | Wrong-table/no-host/multi-host preflight, injected failure at every stage, exact reload/deck/seat restoration, real native save/reload. |
| TTS-009 | Start N=2…5 and inspect excluded countries. | Excluded countries are unmistakably inactive and never dealt/turned without destroying reusable components. | All six physical stations look live regardless of roster. | Visual and interaction pass for every N, including a user seated in an inactive color. |
| TTS-010 | At baseline, reveal a mandate for State Visit/Open Archives. | Mandate leaves its private hand and becomes public face-up on the printed country-mat space while that country's red line and dossier stay private. | Both secrets occupied one card face/description, so selective reveal was impossible. | Move each of six separate mandate cards out of its hand to the printed reveal space and inspect from every viewer; paired red-line card stays concealed and persists after save/reload. |
| TTS-011 | At baseline, move an own cube, gained supply cube, exchanged foreign-tagged cube, and Military proxy into Blue's hand. | All enter Blue's hand and are hidden from Red until reveal. | Baseline block objects serialized `Hands:false`; tagged hand zones had no shared eligibility tag. | Assert `Hands=true`/`HandEligible`, then perform the four-object Blue-vs-Red live privacy test and inactive-zone negative test. |
| TTS-012 | Trigger Begin/Back/Begin, double advance, native End Turn, or save/reload during the 0.8-second deal. | One generation completes exactly once; busy operations are rejected; stale callbacks cannot mutate. | Baseline scheduled uncancelled callbacks with no busy, generation, dealt-round, or identity guard. | Inject each race at every callback boundary; assert exact `3N` identities, `dealtRound`, `dealGeneration`, `rngState`, phase, and no orphan card. |
| TTS-013 | Read baseline Grey rules as a TTS player. | Rules distinguish multi-person private play from solo open-information rehearsal and promise no AI. | Raw browser rules advertised Solo Envoy and web privacy not implemented in TTS. | Static banned-claim scan and first-time host walkthrough of all supported-mode wording. |
| TTS-014 | Ordinary unpromoted player toggles Collapse. | Product decision is explicit; per-player presentation or authorized global mutation cannot disrupt others. | Current handler changes the shared global XML state for everyone. | Two-viewer click test for the chosen behavior, including rapid repeat and reload. |
| TTS-015 | Remove/rename each marker, counter, deck, or console GUID and invoke its workflow. | Stop safely and report the exact missing component/recovery action. | Several `getObjectFromGUID` paths silently skip absent objects. | One missing-component fixture per runtime dependency; no misleading successful state. |
| TTS-016 | Set counters outside rules or move seals early, then invoke `ALL SIGNED`. | The second press is explicitly an authorized operator's attestation, never a claim that the script validated tactile locks; either the same or a different authorized operator may confirm, and defeat precedence still applies. | Current confirmation trusts the operator and does not inspect four locks/counter legality. | Every valid/invalid lock boundary, simultaneous defeat, unauthorized/same/different confirmer, and exact attestation wording. |
| TTS-017 | Compare dispatch/Briefing rules with actual first deal. | Exact identities are planned and persisted once at OPEN/Aftermath before Briefing; physical cards are delivered exactly once on Cabinet entry; same-round Undo never changes either plan or delivered hand. | Browser computes hands at round start while baseline TTS ties uncontrolled dealing directly to Briefing→Cabinet. | New setup, same-round Undo, next round, reload, and exact golden-hand checks all follow the plan-versus-delivery contract. |
| TTS-018 | Move cards/cubes/counters, then use OPEN THE CONFERENCE as if it were Reset. | UI says only reloading the untouched original is authoritative unless every object is restored. | Start resets selected counters/deals but leaves many physical mutations intact. | Visible destructive-reload warning and full 145/252-object plus 17-reference/18-PNG comparison; no overwrite of unrelated saves. |
| TTS-019 | Pass the injected Lua harness while skipping visible interaction/privacy. | Release evidence includes real controls, physical workflow, multiple viewers, save/reload, and screenshots. | Current harness can pass important structural paths without proving real-user UX. | Complete every live/visual/privacy gate below with artifact paths and per-fixture results. |
| TTS-020 | Select N with zero, N−1, wrong, and extra/inactive seats, then OPEN. | Chosen warning/blocking behavior is explicit and identical across UI/console/chat/hotkey. | Current clock can proceed with empty active colors. | Product decision recorded; all roster seating fixtures pass without dead turn or private deal to an unintended viewer. |
| TTS-021 | Connect a remote client to the generated local-path save. | No remote-readiness claim without approved Cloud/Workshop assets. | Local absolute Windows asset paths are host-only by design; `README.md` documents the limitation. | Remains approval-gated; if approved later, verify asset ownership, Cloud IDs, fresh remote client, and publication scope. |
| TTS-022 | Load synthetic saves with `playerCount`, round, chair, turn, or `endFromTurn` set to `2.5`, `NaN`-like strings, or out-of-range fractions; invoke `uiPlayerCount` directly with the same malformed values during Setup. | Every value becomes a reported, bounded whole-number index before any roster/state access; no fractional table or nil country lookup survives, and the live roster callback uses the same normalization contract. | Current `normalizeState` and `uiPlayerCount` clamp several numeric values without integer normalization, so fractions can survive into roster loops, ending Undo, and state indexes. | Cross product of each persisted field and the direct roster callback with `-0.5`, `1.5`, in-range `.5`, above-range `.5`, numeric strings, and nonnumeric strings; save/reload and all setup/status/advance/undo paths remain safe. |

## Clean-pass gates

A production-ready clean pass requires every gate below.

### Inventory and data gate

- Every surface, role, control, command, state, workflow, physical component, policy, Crisis, Summit action, ending, and recovery path in this document has a recorded result.
- TTS-facing rules, cards, tooltips, quick reference, Lua instructions, and canonical game effects agree.
- No browser-only Solo Envoy claim remains in the TTS notebook.
- All fixtures are fictional and contain no sensitive information.

### Static build gate

- `npm run tts:build`
- `npm run tts:verify`
- Parse generated Global and controller Lua with `luaparse`.
- Validate JSON, all 145 top-level/252 recursive objects, all 17 save-referenced URLs, all 18 generated PNG digests, preview equality with `cover.png`, unique GUIDs/tags, exact deck/card counts, six separate mandates plus six separate red lines, four resource plus one Military supply, hand colors/concealment, `Hands=true`/`HandEligible`, serialized Turns, workflow labels/lane sizing, Notebook bodies/privacy/BBCode nesting, the committed full deterministic fixture once implemented, and `git diff --check`.
- Rebuild from a path containing spaces and an apostrophe.

### Live runtime gate

- Load a separately named disposable readiness copy of the generated original through visible TTS Save & Load; preflight its exact identity and one White host before script injection or mutation.
- Exercise visible docket controls, console buttons, Game Keys, chat, and native End Turn as real users.
- Complete the roster, dispatch, state, tactile rule, save/resume, and ending matrices.
- Force failures at each mutating stage and confirm `finally` cleanup restores exact seats, canonical deck order, all 145/252 objects, and the 17-reference/18-PNG artifact contract; never use an unrelated user save.
- Fail on any Lua error, missing art, stale label, double transition, physical/Lua mismatch, or privacy leak.

### Visual and UX gate

- Inspect setup, every phase, expanded/collapsed docket, each ending, all mats, every card sheet, quick reference, hands, and console.
- Verify readability at common 720p, 1080p, 1440p, ultrawide, and supported UI-scale settings.
- Verify color is never the only country/resource signal.
- Verify camera Overview, object reachability, six filled commitment lanes, six simultaneous proposal lanes, no overlap/marker collision, no oversized colliders, and no panel truncation.
- Verify instructions remain actionable for a first-time host and delegation.

### Privacy and authority gate

- White host, promoted, ordinary delegation, inactive seat, Grey spectator, Black GM, multi-person pass-and-play, and solo open-information rehearsal boundaries all pass.
- The exact Grey/White/Black/six-color/unused-color Notebook matrix passes.
- Separate mandates, separate red lines, policy hands, and sealed commitments remain private until their explicitly permitted reveal; revealing a mandate never reveals its red line.
- Own, gained, exchanged foreign-tagged, and Military proxy commitment pieces all obey the `HandEligible` conceal/reveal contract.
- Unauthorized UI, console, hotkey, and chat mutations are rejected privately.
- Simultaneous authorized/native actions cannot double-advance.

### Regression and review gate

- Every bug has reproduction evidence before its fix and a focused regression afterward.
- Shared causes are fixed coherently rather than patched per symptom.
- After each significant tranche: build/static verification, live test, autoreview, progress-log update, and one cohesive local commit.
- Rerun the complete inventory after the final fix.
- `PRODUCTION_READINESS.md` and the bug ledger match the final implementation.

### Exit gate

A clean pass means:

- No Critical or High bug remains open.
- Every Medium item is fixed or has an explicit accepted disposition.
- All acceptance criteria and finite fixture cases pass.
- The worktree contains only intentional, reviewed changes.
- No production upload, public Workshop publication, sensitive data use, or destructive reset occurred without approval.

If any gate cannot pass, stop with a blocked handoff containing the exact failed fixture, reproduction evidence, attempted fixes, remaining dependency, and safest next action.

## Out of scope and approval-gated work

The following are not authorized by a local production-readiness run:

- TTS Cloud Manager upload.
- Steam Workshop creation, update, or publication.
- Hosting an internet multiplayer session.
- Replacing local asset URLs with public/network URLs.
- Uploading repository or user-owned art to a third party.
- Reading, copying, deleting, or overwriting unrelated TTS saves.
- Using real player identities, account data, credentials, or sensitive content.
- Adding browser Solo Envoy AI to the TTS adaptation.
- Changing the canonical game design without an explicit product decision.

Cloud Manager/Workshop work is approval-gated because it changes external state and publishes or transfers assets. Local build, local generated-save verification, and local TTS runtime testing remain in scope.

## Evidence map

- Product/install instructions: `tabletop-simulator/README.md`
- TTS content catalog: `tabletop-simulator/content.mjs`
- Asset/save generation: `tabletop-simulator/build-mod.mjs`
- Floating UI: `tabletop-simulator/src/global.xml`
- Clock/runtime logic: `tabletop-simulator/src/global.lua`
- Physical console: `tabletop-simulator/src/controller.lua`
- Static verifier: `tabletop-simulator/verify-mod.mjs`
- Live script verifier: `tabletop-simulator/live-test.mjs`
- Canonical rules: `RULES.md`
- Canonical policy effects: `src/game/catalog/policies.ts`, `src/game/state.ts`
- Canonical Crisis resolution: `src/game/transitions/crisis.ts`
- Canonical Summit/endings: `src/game/transitions/summit.ts`, `aftermath.ts`, `lifecycle.ts`
