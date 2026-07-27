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
| TTS Save & Load | `Games → Save & Load → On War's End v3 — The Vellan Accord` | Save appears once with correct cover/name and loads without an error dialog. Invalid nonempty script state produces visible `LOAD BLOCKED`, preserves the rejected state, empties Turns, and exposes no setup/clock mutation over the physical table | Duplicate save folders; autosave chosen instead of original; stale local asset paths; corrupt JSON; `{}`; array; partial/unknown/future schema |
| Physical table | Central board, six mats, decks, cards, cubes, counters, markers, seals, hands, console, and reference | All components render, are readable, are reachable, and do not overlap; intended movable pieces can be manipulated | Missing art; oversized collider; object under board; lost component; nonstandard camera |
| Floating Conference Clock | Setup, roster, round, phase rail, chair/acting delegation, instruction, primary action, tools, and finish guard | Correct content and control visibility for every state; no truncation at supported UI scales; default placement leaves the native turn strip and upper-right player/Change Color menu unobstructed | 720p/small UI scale; ultrawide; two-line roster; player-menu overlap; dragged off-screen; collapsed state |
| Physical console | Dynamic status plus NEXT, BACK, STATUS | Console and docket share the same gate/status truth while candidly redirecting docket-only actions: Assign and Resume remain on the docket. After exact ended-state restoration settles, the actual BACK control becomes `UNDO / TO RESUME` while NEXT reads `CONFERENCE CLOSED`, with a tooltip that says the source state will reopen and docket Resume remains required. During refresh its shared status says `SEATING PAUSED`, never advertises Undo, NEXT candidly reads `SEATING SETTLING`, and BACK stays ordinary with its clock-only tooltip; invalid saved state shows `LOAD BLOCKED` and keeps NEXT/BACK inert while STATUS remains explanatory | Console missing; stale object script; overlapping buttons; click by ordinary player; ended-state label/wiring/tooltip mismatch; load quarantine |
| TTS turn UI | Current active seat and native End Turn | Enabled only in exact-seat Native Turns mode during Cabinet, Crisis Council, and Peace Summit after any required docket Resume; Manual Hotseat, seat refresh, seat assignment, resume-required state, and every seating pause keep it disabled and empty; one valid End Turn produces one transition | Empty active seat; seat change; assignment pending/timeout; inactive country occupied; delayed player-name/handoff callback; unauthorized/early Resume; unexpected/initial event; overlapping sync callbacks; simultaneous clock click |
| Private hand zones | Policy hands, separate mandate/red-line cards, and sealed Crisis commitments | Exact seat colors and `HandEligible` contract; policy/secret cards remain country-restricted; own, gained, exchanged, and proxy commitment pieces enter the matching hand and remain hidden; inactive hands remain empty | Multi-person handoff; solo open-information rehearsal; spectator/host/Black GM view; card dropped outside hand; foreign-tagged exchanged cube; seat disconnect |
| Notebook | Grey public TTS Rules, six color-private dossiers, and White Host Guide | Exact visibility matrix below; formatted BBCode; public text contains no mandate title/body or red-line body; describes only supported TTS modes and exactly matches physical/manual behavior | Browser-only instructions; stale effects; raw Markdown; wrong color; empty/duplicate tab; Black GM visibility |
| Options → Game Keys | Bind Next, Back, Status | All three keys register once and mirror their corresponding controls | Unbound keys; duplicate registration after reload; unauthorized mutating hotkey |
| Chat | `!owe` command family | Recognized commands are suppressed from public chat; responses and authorization are correct | Case; leading/trailing spaces; unknown suffix; ordinary table talk |
| Native TTS save/load | Save or resume a physical session | Valid clock and physical table resume consistently at every supported state. A running Native clock starts behind same-clock docket Resume. Invalid nonempty state is never normalized into operable Setup and is preserved unchanged while quarantined | Save during delayed deal; finish guard armed; empty original; complete legacy; corrupt/partial/array/unknown/future script state; moved asset directory |

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
- Native single-seat assignment is a separate inline two-step confirmation that names the sole Grey spectator, target country, and target color; it exists only when that spectator has a nonempty Steam account ID and a visible sanitized name, remains armed for five seconds, and never advances the clock.
- Every color/connect/disconnect event during a running Native conference synchronously empties Turns and conservatively requires `RESUME NATIVE TURNS`, because TTS can emit the event before its roster updates and does not expose the departed color. This includes a harmless extra Resume after neutral-only churn. Resume is a separate single-press docket handshake: it reauthorizes the operator, freshly audits exact seating, and clears the seating quarantine without moving the clock. `RESUMING NATIVE TURNS` then holds every mutation until TTS stays callback-free for one second; each suppressed handoff callback restarts that quiet period. Native End Turn repopulates only in action phases.
- Unauthorized and invalid clock operations use targeted chat messages.
- TTS may show its platform-owned player-name/hotseat-handoff dialog after a confirmed seat assignment. The docket remains non-advancing while TTS settles. Exact seating changes the action to `RESUME NATIVE TURNS`; a ten-second timeout performs another audit but never enables Turns by itself.
- TTS-native confirmation dialogs, Save & Load, and Workshop dialogs are platform surfaces, not mod-owned UI.

Acceptance requires both confirmation guards and the Resume handshake to be unmistakable, fail safely, and never hide a rule, identity ambiguity, or clock mutation behind a generic success message.

## Roles and permissions

| Role | Capabilities | Acceptance criteria | Finite edge cases |
|---|---|---|---|
| Host / White operator | Configure setup; open, advance, undo, and finish the clock; confirm an eligible single-Grey private-seat grant; resume Native Turns after exact restoration; use all read-only tools; manipulate physical table; read the White Host Guide | Every mutating scripted entry point authorizes the host; White cannot inspect color-private hands or tabs merely by being White; assignment requires the docket's fresh two-step confirmation and Resume requires a new exact audit without clock movement | Host seated in a country; White spectator host; host migration/reconnect; assignment actor moves color; Resume before/after platform dialog |
| Promoted player | Same scripted clock, eligible docket seat-assignment, and docket Resume authority as host | UI, console, chat, and hotkeys behave identically for normal clock actions; seat assignment and Native Resume intentionally exist only on the docket | Promotion during a turn; promotion removed between presses; two promoted users act together; different authorized confirmer |
| Active delegation | Own one active country, its private hand, mandate, resources, counters, seal, Pressure marker, and turn | Can complete every tactile action; native End Turn is available only while every active color is occupied and no restoration Resume is required; cannot use host-only scripted mutations unless promoted | Wrong seat; empty seat; signed country continues; local hotseat seat switching; delayed handoff callback |
| Inactive delegation seat | Physical country not in the selected prefix roster | Never enters turn order, receives no policy hand, and is visibly marked inactive; occupying its country color blocks opening or pauses every mutating clock surface | Player sits there; inactive component moved; inactive counter accidentally used |
| Spectator | Observe, request Status, frame Overview, and use ordinary chat; a sole Grey spectator with a nonempty Steam account ID and visible sanitized name may be the explicit target of an eligible host-confirmed country-seat grant | Cannot mutate the scripted clock unless host/promoted; assignment visibly discloses the account/name recipient and private-access target before changing color; anonymous, format-only, or missing-account recipients must use native Change Color | Zero/one/multiple Grey users; empty/missing/colliding identity fields; identity swap while armed; Grey/White color; spectator clicks shared Collapse; spectator reconnect |
| Black GM | Adjudicate/recover the table and use TTS GM visibility | Black can inspect all private tabs/hands for support but does not receive a country, policy hand, turn, or extra scripted authority unless host/promoted | Accidental public reveal; GM seated during privacy test; Black confused with ordinary spectator |
| Multi-person hotseat/pass-and-play group | Hands control to the matching delegation player | Concurrent exact active colors use Native Turns; after any interrupted Native seating, the group closes the platform handoff dialog and uses docket Resume; otherwise native End Turn remains disabled and Manual Hotseat uses clock controls; privacy remains protected only when control is passed before private-hand viewing | Seat switch during delayed deal; forgotten handoff/curtain; shared display; Resume before dialog closes |
| Solo rehearsal operator | Controls two or more active delegations as one person | Two-step Manual Hotseat opens without mutating on the warning press, keeps native End Turn disabled, and labels the session explicitly open-information | Mislabelled as competitive/privacy-safe; stale confirmation; one color left active; wrong/inactive seat during deal |

Clock authorization is implemented by `isHostOrPromoted`, `requireControl`, and the UI/console/hotkey/chat adapters in `tabletop-simulator/src/global.lua`.

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
| Roster dropdown `2–6` | Setup only; host/promoted; disabled during `LOAD BLOCKED` | Select exact fixed-prefix roster; update active names and seated count immediately | Minimum/maximum; wrong seat; change after opening; direct fractional/nonnumeric callback; corrupt saved fraction/noninteger; invalid-state quarantine |
| Dispatch input | Setup only; host/promoted; integer; 9-character UI limit; disabled during `LOAD BLOCKED` | Normalize to a positive whole number and display the effective value | Blank; zero; negative; maximum `999999999`; pasted invalid text; corrupt saved number; invalid-state quarantine |
| OPEN THE CONFERENCE | Setup only; host/promoted; replaced by disabled `LOAD BLOCKED` for invalid nonempty save state | Exact active seats and no inactive country seat open immediately in Native Turns mode. Missing active seats arm a five-second `CONFIRM MANUAL HOTSEAT` warning without changing clock/counters/decks; the unchanged second press opens Manual Hotseat with native End Turn disabled. Any occupied inactive country color hard-blocks. Any pending seat refresh visibly disables OPEN until its fresh audit. Only the successful commit initializes Round 1 and physical setup. Invalid saved state can never call the commit helper or mutate the physical table. | Zero/N−1/N active seats; inactive country occupied; neutral observers; timeout; roster/dispatch/connect/disconnect/color change during arm; stale exact/missing audit; one/two rapid presses; direct commit callback; already started; missing deck/counter; physical pieces moved before opening; malformed/partial/array/unknown/future saved state |
| Primary advance / seat assignment / Native Resume | Running non-ended state; host/promoted | Normally advance exactly one table step or delegation turn. During the sole eligible Native seat-recovery state, replace advancement with `ASSIGN country / color`, then `CONFIRM ASSIGN` for five seconds; require a nonempty Steam account ID plus visible sanitized name, bind the grant to a collision-safe length-prefixed raw ID/name tuple, and revalidate that identity, the clock signature, seat fingerprint, target availability, and actor authority before one color change. If the roster, target, or Grey identity changes between those presses, consume the stale confirmation; the replacement identity/target requires its own fresh review press and separate confirmation press. Anonymous, format-only, or missing-account Grey users never expose Assign and use native Change Color. Show non-interactable pending/settling states while TTS audits. Every Native color/connect/disconnect event synchronously empties Turns and latches docket-only `RESUME NATIVE TURNS`, even if coalesced stale audits remain exact. Resume reauthorizes, freshly rechecks exact seating, and enters a non-interactable one-second callback-free settlement without moving the clock. Suppressed callbacks or new seat events restart/cancel settlement. Action phases then repopulate the native order; Briefing/Aftermath remain table steps. Assignment and Resume never exist on console, hotkey, or chat. | Rapid/delayed second click; console/UI/native collision; stale/coalesced exact audit; neutral-only churn; eventless exact seating between ASSIGN presses; zero/multiple Grey; empty Steam ID; blank/default-ignorable/filler-only name; delimiter-shaped identity fields; two missing seats; inactive occupant; unavailable target; Unicode/markup/control name; spectator identity swap before or during pending; first/second actor differs; promotion revoked; TTS throws; Grey disappears before notification; silent late settlement; delayed platform callback; Resume actor unauthorized; callback/color/connect/disconnect during Resume; Briefing/Aftermath |
| UNDO CLOCK | Enabled after opening except during a Native seating pause; host/promoted | Restore exactly one clock state; clearly state that physical pieces are not undone. Missing/inactive seating, assignment pending, refresh, and a running Resume-required state block it without clearing transient safety state. Sole exception: after exact seating returns to an ended Native conference, Undo reopens the exact recorded phase/turn, consumes ending metadata, preserves the Resume latch, and keeps native order empty. | Setup; Round 1 Briefing; each phase boundary; round boundary; each ending; missing/inactive seat; assignment pending; fresh audit; running Resume required; exact ended-state Resume required |
| STATUS | Always available; any player | Privately report setup or current round, phase, chair, acting country/table step, and instruction; during load quarantine explain that a trusted untouched save is required | Setup, action turn, Aftermath, each ending, spectator, invalid saved state |
| OVERVIEW | Always available; any player | Frame the full public table for only the invoking player; no state mutation | White versus colored seat; unusual display; repeated invocation |
| ALL SIGNED / CONFIRM | Summit and Aftermath only; host/promoted | First activation arms for five seconds; a second activation by the same or a different authorized operator records that second operator's explicit attestation that every physical signing requirement is legal, then disables Turns; the clock must not claim it independently validated tactile state | Timeout; same/different confirmer; unauthorized click; advance/undo while armed; invalid seals/locks; simultaneous defeat |

The XML definitions are in `tabletop-simulator/src/global.xml`; setup and clock handlers are `uiPlayerCount`, `uiDispatch`, `uiStartConference`, `uiAdvance`, `uiBack`, `uiFinishConference`, `uiStatus`, and `uiOverview` in `tabletop-simulator/src/global.lua`.

### Physical console and native turn control

| Control | Required behavior | Finite risk cases |
|---|---|---|
| Console NEXT | Same authorization, transition, status broadcast, marker update, and label as normal clock advancement when no seating gate is active; otherwise no mutation. It cannot assign a seat or perform Native Resume | Missing controller; stale GUID; ordinary user; simultaneous End Turn; missing/inactive seat; pending/refresh/Resume visible in docket |
| Console BACK | Same as UNDO CLOCK, including every Native seating-pause gate and exact-ended exception; relabel `UNDO / TO RESUME` only when that exception is actionable | Boundary no-op; physical state already changed; pending/refresh/running Resume required; ended missing seat; label and click-function disagreement |
| Console STATUS | Read-only targeted status | Spectator color; controller label too long |
| TTS End Turn | Native mode plus exact active seating and no Resume requirement or Resume settlement only; seat refresh, assignment pending, restoration quarantine, and the callback-free post-Resume second disable it synchronously; initial and already-current focus announcements never advance; delayed platform callbacks and duplicates remain no-ops before/during Resume and restart settlement; expected next active color advances once only after settlement; final active color advances phase once; an unexpected event gets one guarded resync and then safely disables native Turns without a message loop | Wrong previous/next player; current-seat handoff with non-null previous player; delayed duplicate; valid-looking callback after player-name dialog; callback at end of quiet period; seat swap; assignment callback; empty/inactive seat; stale sync generation; repeated unexpected event; simultaneous manual control |

Console source is `tabletop-simulator/src/controller.lua`. Native turn synchronization is centralized in `beginTurnsSync`, `finishTurnsSync`, `disableTurnsSafely`, `updateTurns`, `handleUnexpectedNativeTurn`, and `onPlayerTurn` in `tabletop-simulator/src/global.lua`.

TTS Hotseat may keep the raw `Turns.enable` flag true after a scripted shutdown. The production fail-closed invariant is therefore `Turns.order = {}`: no native country can advance, and repeated hotseat callbacks must not cause another mutation or message loop. Exact-seat Native mode requires both a populated exact-country order and the enabled flag.

### Game Keys

| Exact registered name | Authority | Required behavior | Finite risk cases |
|---|---|---|---|
| `On War's End: next` | Host/promoted | One normal forward transition only when no seating gate is active; never assign or Resume | Ordinary player; double input; missing/inactive seat; pending/refresh/Resume required |
| `On War's End: back` | Host/promoted | One reverse transition only when no seating gate is active | Boundary; physical mismatch; ended state; missing/inactive seat; pending/refresh/Resume required |
| `On War's End: status` | Any resolvable player | Read-only private Status remains available during every seating gate | Grey ambiguity; setup; ended; pending/refresh/Resume required |

Registration is in `onLoad` in `tabletop-simulator/src/global.lua`.

### Chat commands

| Command | Authority | Required behavior | Finite risk cases |
|---|---|---|---|
| `!owe help` | Any sender | Privately list commands and authority boundary | Mixed case; spectator |
| `!owe status` | Any sender | Private status with no state mutation | Setup and ended |
| `!owe next` | Host/promoted | One normal forward transition only when no seating gate is active; never assign or Resume | Ordinary sender; double input; missing/inactive seat; pending/refresh/Resume required |
| `!owe back` | Host/promoted | One reverse clock transition only when no seating gate is active | Boundary; physical mismatch; ended state; missing/inactive seat; pending/refresh/Resume required |
| `!owe finish` | Host/promoted | Same guarded finish workflow as docket when no seating gate is active; otherwise no arm or ending | Wrong phase; timeout; false signature claim; missing/inactive seat; pending/refresh/Resume required |
| `!owe view` | Any sender | Per-player Overview only | Spectator; repeated command |
| Unknown `!owe...` | Any sender | Suppress the command and privately report `Unknown command` | `!owe`, trailing spaces, concatenated suffix |
| Ordinary chat | Any sender | Pass through unchanged | Message happens to begin with `!owe` |

Chat is implemented by `onChat` in `tabletop-simulator/src/global.lua`.

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

The currently supported clock subset is emitted as schema version 1 and validated before use. The larger deterministic-deal schema below remains a required future contract; it is not considered implemented merely because the clock subset is versioned.

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
- `turnMode` (`native` or `manual`)
- `dealtRound`
- `dealGeneration`
- `outcome`
- `endFromPhase`
- `endFromTurn`

### Transient presentation/control state

- `panelCollapsed`
- `finishArmed`
- `finishArmGeneration`
- `manualOpenArmed`
- `manualOpenSignature`
- `manualOpenGeneration`
- `seatRecoveryArmedSignature`
- `seatRecoveryGeneration`
- `seatRecoveryPending`
- `seatRecoveryPendingGeneration`
- `seatRefreshPending`
- `seatRefreshGeneration`
- `nativeSeatResumeRequired`
- `nativeResumeSettling`
- `nativeResumeGeneration`
- `nativeResumeClockSignature`
- `nativeResumeTargetColor`
- `syncingTurns`
- `turnSyncGeneration`
- `nativeTurnResyncSignature`
- `nativeTurnFaultSignature`
- `loadFault`
- `loadFaultSavedData`
- `dealBusy`

State acceptance requires:

- `schemaVersion` selects a known validator/migration. A complete legacy clock payload with no version may normalize without inventing a successful outcome. Empty original script state begins pristine Setup. Every other malformed, partial, array, unknown-field, or future payload enters visible, non-operable `LOAD BLOCKED` quarantine backed by safe in-memory Setup; the rejected raw payload is preserved by `onSave`, serialized native Turns are emptied synchronously, and no scripted mutation may run over the physical table.
- `rngState` is an unsigned nonzero 32-bit integer and resumes the canonical xorshift32 stream exactly.
- `crisisOrder` is a six-ID permutation and `crisisCursor` identifies the current/next card without relying on uncontrolled physical deck order.
- `dealtRound` changes only after all active countries hold the exact three intended cards; same-round Undo/re-forward is idempotent.
- `dealGeneration` invalidates every stale asynchronous callback. A callback may mutate only when its captured generation still equals the active generation.
- `dealBusy` blocks or safely rejects advance, back, start, finish, End Turn, and a second deal while the 0.8-second physical operation is incomplete; Status reports the busy stage.
- Saving during `dealBusy` never serializes an unrecoverable half-deal. Reload begins with `dealBusy=false` and either proves the completed hand identity or safely completes/rolls back the interrupted generation exactly once.
- `turnMode` persists as `native` or `manual`. Legacy/missing values normalize to native, but runtime Turns remain disabled until exact active seating is freshly proven and any restoration/load handshake is complete. Every load of a started Native conference synchronously clears serialized Turns and conservatively reconstructs docket Resume before delayed initialization; Manual and untouched Setup do not acquire that gate. Manual mode never silently upgrades when seats appear.
- The Manual Hotseat confirmation is transient, expires after five seconds, and is invalidated by roster, dispatch, connect, disconnect, or color changes. Only its seat fingerprint—not an operator identity—is compared, so either authorized operator may make the second press without storing personal data.
- Native seat recovery is transient and docket-only. It exists only for exactly one missing active seat, no occupied inactive country, one Grey spectator with a nonempty Steam account ID and visible sanitized name, and an available target color. The first authorized press arms a collision-safe length-prefixed raw account/name tuple for five seconds; the second revalidates every condition before one `changeColor`. Anonymous, format-only, and missing-account spectators fail closed to native Change Color. TTS returns fresh non-equal Player wrappers across repeated spectator reads, so the implementation does not claim object-reference identity. The recipient name/Steam ID, confirmation, pending state, and `nativeSeatResumeRequired` are never serialized. The operation explicitly grants the displayed account/name access to the target private hand; it does not claim person restoration. Native Turns and every clock mutation stay blocked during inexact seating, refresh, pending assignment, restored-seat quarantine, and post-Resume settlement. A changed pending identity or target eligibility cancels promptly. A ten-second no-settlement timeout performs a fresh audit; exact seating exposes docket Resume and missing seating permits a deliberate retry, but neither path advances the clock automatically.
- `turnSyncGeneration` prevents an older two-frame callback from clearing a newer synchronization window. A hotseat focus handoff that announces the already-current color is idempotent even when TTS supplies a non-null previous virtual player, and the same rule safely absorbs a delayed duplicate after a completed turn. Because TTS reports the same current/previous colors for a post-dialog handoff and a genuine End Turn—and can expose stale exact audits during coalesced seat events—every running-Native color/connect/disconnect event synchronously latches docket-only Resume before its audit. Delayed valid-looking callbacks remain inert through a new authorized Resume and restart its one-second callback-free settlement; another seat event cancels settlement back to quarantine. Only then can exact action-phase Native Turns return. An unexpected native event may resync once per exact clock signature; a repeat disables native Turns without re-enabling in a loop.

Other transient presentation state intentionally resets on script reload unless a future acceptance decision says otherwise.

### State machine

| State | Automated behavior | Tactile handoff | Acceptance and finite boundaries |
|---|---|---|---|
| Setup | Roster/dispatch editable; seat readiness and exact blocked/missing state visible; Turns disabled; exact seats open Native mode; missing seats require a no-mutation two-press Manual Hotseat confirmation; inactive country seating blocks | Seat the active roster and take only its private cards | 2/6 bounds; 0/N−1/N seats; inactive/neutral seat; timeout; seat/roster/dispatch change during confirmation; malformed input; double press |
| Briefing | Round/chair/table-step; phase marker; Begin Cabinet; any Native seat restoration requires same-clock docket Resume before Begin | Reveal/read exactly one Crisis | Round 1/6; undo from Round 2–6; absent/multiple Crisis; seat loss/restore/platform callback |
| Cabinet turn 1…N | Active marker and TTS turn color; deterministic, guarded, once-per-round deal on entry; broken Native seating disables Turns and either offers the sole eligible docket assignment or stays fail-closed; exact restoration requires docket Resume | Play one legal policy or conserve; resolve pieces/counters | First/middle/last; empty seat; sole/ambiguous Grey; assignment pending/timeout; delayed handoff callback; Resume authority; native/manual race; Undo boundary; Begin/Back/Begin; double advance; save/reload during deal |
| Crisis turn 1…N | Active order and Seal Commitment label; same Native seating pause/assignment/Resume contract | Commit requested pieces and retain an auditable total | Zero/exact/short/over; Military boundary; last-country result; seat loss/recovery/Resume |
| Summit turn 1…N | Active order; guarded finish visible; same Native seating pause/assignment/Resume contract | Sign, accept, post, backchannel, or pass | Every action; first/middle/last; all signed; seat loss/recovery/Resume; finish while quarantined |
| Aftermath | Turns disabled; table step; Next Round; same Native seat-restoration Resume contract before advancing | Read communiqué and clear proposals | Signed finish; cleanup complete/incomplete; Round 1–6; seat loss/recovery/Resume |
| Ended — signed | Turns disabled; signed outcome/status | Read victory communiqué | Finish guard, false claim, Undo |
| Ended — round limit | Turns disabled; six-round outcome/status | Read defeat communiqué | Round 6 exact boundary, Undo |
| Ended — immediate defeat | Required production state; Turns disabled; exact reason/status | Read matching defeat communiqué | Unrest 10; Refugees `>5N`; active Population 0; active Military 0; precedence |

Forward transitions are centralized in `advanceClock`; reverse transitions are in `stepBack`; rendering and native turn synchronization are in `updateAll`, `updateUI`, `updateMarkers`, `updateTurns`, and `updateController` in `tabletop-simulator/src/global.lua`.

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
- A corrupt, partial, unknown-field, array, or future clock payload enters visible `LOAD BLOCKED` quarantine, preserves the rejected payload, empties Turns, and leaves every setup/clock mutation disabled until a trusted save is reloaded.

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

- Setup with 0, N−1, and N exact active seats; one occupied inactive country color; and neutral observers.
- Prove the first missing-seat OPEN press changes no clock, counter, deck, or hand state; timeout and every seat/roster/dispatch change invalidate it; the unchanged second press selects persisted Manual Hotseat.
- Prove Native Turns disables and every mutating clock surface pauses immediately on active-seat loss or inactive-country occupancy while Status/Overview remain read-only. After exact seating returns, prove Turns remain empty and delayed platform callbacks remain inert until a host/promoted docket Resume freshly rechecks seating without moving the clock; only the next genuine End Turn advances. Manual Hotseat permits missing active seats but never enables native Turns.
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
| Complete legacy clock object with no `schemaVersion` and optional missing `turnMode` | Accept only the exact legacy base-clock keys and valid values, normalize missing `turnMode` to Native, and emit schema version 1 on next save |
| Invalid JSON; JSON scalar/array; empty/partial object | Preserve the raw payload and enter visible, non-operable `LOAD BLOCKED` quarantine |
| Unknown key or unknown future `schemaVersion` | Preserve the raw payload and enter `LOAD BLOCKED`; never reinterpret it as Setup, a running clock, or an ending |
| `playerCount`, round, chair, turn, or `endFromTurn` outside range or noninteger | Reject the complete payload into `LOAD BLOCKED`; never clamp an untrusted persisted index |
| Dispatch missing, nonnumeric, zero, negative, fractional, or outside the supported persisted range | Reject the complete payload into `LOAD BLOCKED`; setup-input normalization is a separate user-input contract |
| Invalid phase, turn mode, outcome, ending origin, or nonboolean `started` | Reject the complete payload into `LOAD BLOCKED` |
| Setup payload containing running/ending state | Reject into `LOAD BLOCKED`; Setup must be Round 1 Briefing, chair/turn 1, Native, and have no ending |
| Ended payload without a valid outcome and origin, signed outside Summit/Aftermath, or round-limit defeat outside Round 6 Aftermath | Reject into `LOAD BLOCKED` rather than inventing a communiqué |
| Future deterministic fields such as `rngState`, `crisisOrder`, `dealtRound`, `dealGeneration`, or `dealBusy` before their schema is implemented | Treat as unknown keys and enter `LOAD BLOCKED`; the later deterministic schema must add exact validators and migrations before accepting them |

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
| TTS-001 | High | Environment incident resolved; harness resilience consolidated into TTS-008 | The prior desktop TTS main-thread hang was cleared by the approved restart; repeated current-process live suites and native UI checks now complete without `ECONNRESET`. |
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
| TTS-020 | High | Resolved in seat-safety tranche — genuine replacement path, full v28 installed suite, and final autoreview pass | Exact-seat Native Turns, two-step Manual Hotseat, inactive-seat blocking, fail-closed seat-loss handling, and idempotent hotseat focus callbacks replace the seat-blind opening/resync loop; restored seating now requires an explicit same-clock docket Resume before a genuine End Turn can advance. |
| TTS-021 | High | Approval-gated limitation | Local absolute art paths cannot support remote clients or Workshop distribution without an approved upload. |
| TTS-022 | High | Open — persisted corruption now quarantines; runtime input normalization remains | The schema validator now rejects fractional/out-of-range persisted indexes and over-limit dispatches, but malformed direct roster/dispatch callbacks and `normalizeState` can still create runtime values that are fractional or exceed the UI contract; `onSave` may then emit a payload the next load correctly rejects. |
| TTS-023 | High | Resolved in seat-safety tranche — focused genuine-player path, full v28 installed suite, and final autoreview pass | A successful Grey-to-country assignment could raise a post-change `BroadcastToColor` error because the confirming Grey target no longer existed. The notice now targets the new country color and safely falls back to a public notice if TTS has not registered that seat yet. |
| TTS-024 | Critical | Resolved in seat-safety tranche — genuine replacement/Resume/End Turn path, full v28 installed suite, and final autoreview pass | After Blue was restored through TTS Change Color and its player-name dialog, a delayed valid-looking Red-from-Blue `onPlayerTurn` callback arrived after both two-frame guards cleared and advanced Cabinet from Aravell to Tomerin without End Turn. Every inexact-to-exact Native restoration now latches a docket-only Resume gate before native callbacks or clock controls can mutate. |
| TTS-025 | Critical | Resolved in seat-safety tranche — full v28 installed quarantine matrix and final autoreview pass | Any decoded table, including `{}`, arrays, partial state, unknown fields, and future versions, was normalized into operable Setup. Loading that script state over a physically progressed table let authorized OPEN reset/shuffle/deal selected components without restoring the rest. Nonempty invalid payloads now enter visible, non-mutating `LOAD BLOCKED` quarantine and are preserved unchanged on save. |
| TTS-026 | Medium | Resolved in seat-safety tranche — exact installed-runtime synthetic pass; genuine non-BMP player-name coverage not claimed | The spectator-label helper treated TTS MoonSharp strings as UTF-8 bytes. In the installed UTF-16 interpreter `string.byte` returns `?` for every unit above 255, making its surrogate branch unreachable and allowing scalar-splitting and hidden-format ambiguity. Labels now use `string.unicode`, preserve valid pairs, replace isolated surrogates, and collapse markup/control/bidi/zero-width/default-ignorable/display-filler separators before truncation. |
| TTS-027 | High | Resolved in seat-safety tranche — v25/v28 installed suites and final status/autoreview pass | Exact ended-state restoration relabelled the physical console's NEXT button `UNDO CLOCK TO RESUME`, but that button remained wired to advance and did nothing while the actual BACK button still said `BACK`. The ended-state action now stays on BACK, which is relabelled `UNDO / TO RESUME`; NEXT remains candid: `SEATING SETTLING` during refresh and `CONFERENCE CLOSED` after settlement. |
| TTS-028 | Critical | Resolved in seat-safety tranche — genuine identity-primitive probe, full v28 installed regression, and final autoreview pass | Blank Steam ID/name fields collapsed every anonymous Grey recipient to the same `|` signature, so an eventless anonymous A-to-B replacement could inherit A's armed private-seat grant. Automatic Assign now requires a nonempty Steam account ID and visible sanitized name and binds a collision-safe length-prefixed raw tuple; anonymous, format-only, or missing-account recipients fail closed to native Change Color. Aggregate review also found the raw tuple/name in diagnostic snapshots; diagnostics now export only a safe armed marker and non-identifying pending target fields. |
| TTS-029 | Medium | Resolved in seat-safety tranche — v28 length regressions, visible installed-client evidence, and final autoreview pass | The 232-character exact-seat Resume instruction exceeded the 64 px instruction box and visibly truncated after “clock; native” in evidence `54`, hiding the last safety rule. Resume copy is now 134 characters, and ineligible seat-recovery guidance is 172 characters with an explicit Steam-account/name requirement plus native Change Color next step; both render fully in evidence `60`–`61`. |

### Reproduction and closure evidence

| ID | Reproduction | Expected | Observed / evidence | Required regression |
|---|---|---|---|---|
| TTS-001 | Run the captured live verifier twice against the same open generated table after cleanup. | Each run completes or reports an actionable stage error without duplicating mutation. | Baseline second runs failed `read ECONNRESET` while the editor worker waited on a hung main thread. After the user-approved restart, PID 56044 completed repeated full live suites, visible native-player transitions, and a clean fixture reload; the latest engine-log segment contains no matching failure. | Environment incident closed. Exact disposable identity, mutation-outcome journaling, bounded read-only retry, three isolated sessions, and failure-safe cleanup are retained under TTS-008. |
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
| TTS-020 | Select N with zero, N−1, exact, inactive-country, and neutral-observer seats; then OPEN and exercise every mutating clock surface plus Status/Overview. During every running Native phase, remove and restore one active seat; repeat with zero/one/multiple Grey spectators. | Exact seats open Native Turns. Missing setup seats require an unchanged second press for Manual Hotseat; first press mutates no game state. Inactive country seating blocks. Native seat loss pauses without advancing. Only one eligible Grey spectator with a nonempty Steam account ID and visible sanitized name exposes a separate two-step docket assignment; ambiguous or anonymous states stay fail-closed. Restored exact seating exposes docket Resume, not native advancement; Status/Overview stay available. | Baseline six-country/Red-only Cabinet flooded repeated “Tomerin Tester's turn.” Evidence `24`–`31` covers exact opening, focus handoff, native advances, and seat-loss pause. Evidence `44`–`47` covers the original identified assignment/dialog path. Fresh genuine-client evidence `51`–`56` closes native Change Color seat loss, replacement-name handoff, delayed-callback quiet-window restart, same-clock Resume, and the first genuine End Turn advancing exactly once; the post-flow `Player.log` scan found zero Lua/script/runtime/load errors. | `live-test.mjs` must lock stale setup audits, no-mutation Manual confirmation, inactive/neutral seating, every Next/Back/Finish/native surface, read-only Status/Overview, delayed valid-looking callbacks after old guards expire, explicit Resume authorization/no-mutation, first genuine End Turn, zero/one/multiple-Grey recovery, anonymous and format-only recipients, identity/authority changes, thrown/silent/late assignment, notification fallback, timeout re-audit, no identity/latch persistence, all running phases, and exact native order. Native/manual Save & Load persistence remains part of guarded-harness gate TTS-008. |
| TTS-021 | Connect a remote client to the generated local-path save. | No remote-readiness claim without approved Cloud/Workshop assets. | Local absolute Windows asset paths are host-only by design; `README.md` documents the limitation. | Remains approval-gated; if approved later, verify asset ownership, Cloud IDs, fresh remote client, and publication scope. |
| TTS-022 | Load synthetic saves with `playerCount`, round, chair, turn, or `endFromTurn` set to `2.5`, `NaN`-like strings, or out-of-range fractions; invoke roster/dispatch callbacks directly with the same malformed values during Setup. | Persisted invalid values enter `LOAD BLOCKED`. Every live input becomes a bounded whole-number value before roster/state access, and every user-generated `onSave()` payload passes `validateSavedState`. | The current validator/live quarantine rejects persisted fractions and out-of-range dispatches. `normalizeState`, `uiPlayerCount`, and `uiDispatch` still clamp/floor inconsistently, so malformed live callbacks can create fractional/out-of-contract runtime state that the next load refuses. | Cross product of direct roster/dispatch callbacks with `-0.5`, `1.5`, in-range `.5`, above-range `.5`, numeric strings, and nonnumeric strings; assert bounded displayed values, safe setup/status/advance, and `validateSavedState(JSON.decode(onSave()))` after every case. |
| TTS-023 | In a running Native action phase, make Blue the sole missing active seat and one account-identified, visibly named Grey spectator, then confirm `ASSIGN ARAVELL / BLUE` twice. | `changeColor("Blue")` executes once, any TTS handoff dialog remains usable, the conference clock stays unchanged, and post-action notification cannot raise even if Grey disappears immediately. | Pre-fix real-client evidence showed the seat change and native name dialog followed by a red `BroadcastToColor` error because the stale Grey recipient no longer existed. After the fix, `46-seat-recovery-platform-dialog-final.jpg` shows the platform dialog with no Lua error and the post-fix `Player.log` contains zero Lua/runtime errors. Evidence `47` is not used as safe-resumption proof after TTS-024. | Synthetic `changeColor` removes Grey and makes the old targeted broadcaster throw; `restoreNativeSeat` must not escape, must notify the new country color or fall back exactly once, and must preserve the clock. Repeat through the visible TTS dialog; safe resumption is separately governed by TTS-024. |
| TTS-024 | In Round 1 Cabinet/Aravell Native play, remove Blue, restore Blue with TTS Change Color, complete the player-name dialog, and wait without using End Turn. Repeat through the docket Assign path, a running Native Save & Load, and Briefing, Cabinet, Crisis, Summit, Aftermath, plus an ended-state Undo. | Clock stays on the exact pre-loss state; `Turns.order` stays empty; docket shows `RESUME NATIVE TURNS`; console NEXT/BACK, Next/Back Game Keys, `!owe next/back/finish`, Finish, Back, and valid-looking native callbacks cannot resume or advance a running conference, while Status/Overview remain available. Exact ended-state restoration is the sole Undo exception: docket Undo or the console BACK control relabelled `UNDO / TO RESUME` reopens the exact recorded source state but preserves the latch and empty order. Only a current host/promoted docket Resume after a fresh exact audit starts a no-clock-change `RESUMING NATIVE TURNS` state. Every mutation remains blocked until one callback-free second elapses, and each suppressed handoff callback restarts it. In action phases the next genuine End Turn then advances once; Briefing/Aftermath remain table steps. | `49-final-fixture-seat-recovery-ready.jpg` shows Round 1/Cabinet/Aravell paused after Blue left. `50-final-fixture-manual-restoration-advanced-bug.jpg` captures the pre-fix unsolicited advance after the player-name dialog. Fresh closure evidence `51` shows genuine seat loss paused at Cabinet/Aravell; `52` records the replacement-name handoff; `53`–`54` show exact seating and a delayed callback restarting the fresh quiet window; `55` shows same-clock Native Resume; and `56` shows one genuine TTS End Turn advancing exactly once to Tomerin. The post-flow `Player.log` scan found zero Lua/script/runtime/load errors. | Synthetic Manual Change Color and Assign paths; exact audits isolated under pending/refresh/Resume/settling; every Next/Back/Finish/native adapter; read-only Status/Overview; delayed and duplicate callbacks after both old frame guards and during Resume; delayed second click; unauthorized/revoked Resume actor; eventless exact seating between ASSIGN presses; pending identity change; timeout/late exact settlement; Unicode, emoji, markup, and control-name sanitization; every running phase; ended-state missing/refresh/restore/Undo; synchronous load quarantine; first legitimate action-phase End Turn after settlement; fresh genuine-client screenshots and clean `Player.log`. The guarded-harness Native/manual Save & Load rerun remains tracked under TTS-008. |
| TTS-025 | Load a physically progressed disposable table whose nonempty `LuaScriptState` is `{}`, an array, partial state, an unknown-field object, corrupt JSON, or a future schema; attempt setup, docket, console, Game Key, chat, finish, and direct commit-helper mutations. | The UI and physical console say `LOAD BLOCKED`; setup inputs and every mutation are disabled; native order is empty; clock/table state does not change; `onSave` returns the rejected payload byte-for-byte; only reloading a trusted save exits quarantine. | Pre-fix code accepted every decoded table and `normalizeState()` invented an operable Setup. The injected live regression seeds a moved physical counter, exercises each invalid class and mutation surface, and proves identical hands, decks, counters, and markers while quarantined. | Exact allowed-key/schema/type/range/outcome validation; corrupt/partial/array/unknown/future cases; raw-payload preservation; all mutation adapters; read-only messaging; valid version-1 and complete legacy clocks; empty original; running Native exact/missing/inactive reloads. |
| TTS-026 | Pass CJK, a valid emoji surrogate pair, isolated high/low surrogates, XML/BBCode delimiters, line separators, bidi controls, zero-width format characters, variation selectors, and display fillers through the sole-Grey spectator label. | The docket names the same scalar-safe person without XML/BBCode injection, broken surrogate output, hidden direction/line changes, or splitting at truncation. Invalid units become `?`; filtered separators collapse to one space; a label composed only of invisible/default-ignorable/filler scalars becomes `Grey spectator`. | Exact probe of the installed `MoonSharp.Interpreter.dll` showed UTF-16 length/substrings, `string.byte=63` for non-ASCII units, and correct units only through `string.unicode`. The external editor corrupts raw non-BMP strings, so the authoritative surrogate assertion is performed inside MoonSharp and only a boolean crosses the bridge. | CJK truncation, internal numeric high/low-unit assertion, isolated-surrogate replacement, markup/control/bidi/zero-width/default-ignorable/filler collapse, identity revalidation, and explicit documentation that a genuine emoji Steam/hotseat name remains unproven. |
| TTS-027 | Restore exact seating to running and ended Native conferences and use the physical console. Observe each state while the seat refresh is pending and after it settles. | During either refresh, shared Status and the controller header say `SEATING PAUSED`; NEXT reads `SEATING SETTLING`, BACK stays ordinary, and no Resume/Undo claim appears. After a running refresh settles, both statuses say `RESUME REQUIRED` and console NEXT redirects `RESUME IN DOCKET`. After an ended refresh settles, both statuses advertise Undo, NEXT returns to `CONFERENCE CLOSED`, and the actual BACK control becomes `UNDO / TO RESUME`, with a tooltip saying that it reopens the recorded state and docket Resume remains required. Clicking it reopens the exact recorded phase and turn, clears ending metadata, preserves `nativeSeatResumeRequired`, and keeps native order empty; its label and tooltip then reset to ordinary `BACK`. | Pre-fix autoreview traced `UNDO CLOCK TO RESUME` onto index-1 NEXT, whose `controllerAdvance` route immediately returned in ended state. The actual index-2 BACK route was never relabelled, and the live test called internal `stepBack`, masking the UX failure. A first fix also advertised Undo during the synchronous refresh where Back was still blocked; a later shared-status false pass left the same claim in STATUS and the controller header even after the BACK label was gated. Aggregate review then found the same priority drift for a running exact-seat refresh, where Status claimed `RESUME REQUIRED` while every action still said `SEATING SETTLING`. | Assert running and ended refresh/settled shared/controller status text plus console labels/tooltips, execute `controllerBack` through an authorized color, restore non-fallback Summit turn 2, assert consumed ending metadata and retained Resume latch/order, assert ordinary label/tooltip restoration, and statically lock shared status plus index-2 `data.back` wiring and gate priority. |
| TTS-028 | In Native play with exactly one missing active seat, expose a sole Grey spectator whose Steam ID and name are blank; arm Assign, replace anonymous spectator A with anonymous spectator B without a seat event, and confirm. Repeat with format-only names, a visible name but missing account ID, and delimiter-shaped identity values. | Assign is unavailable unless both the raw Steam account ID is nonempty and the sanitized display name is visible. Eligible recipients bind to a collision-safe length-prefixed raw ID/name tuple; any anonymous, format-only, missing-account, changed, or ambiguous recipient fails closed to native TTS Change Color. No recipient identity token persists into `onSave`; diagnostic snapshots redact the raw tuple and expose only safe armed/pending flags plus user-visible UI copy. | Autoreview found every blank account/name pair collapsing to the same `|` token. A boolean-only genuine TTS probe in evidence `57-player-identity-boolean-probe.jpg` showed repeated spectator Player userdata wrappers compare unequal while the exposed ID/name tuple remained stable, so wrapper identity cannot safely bind confirmation. The implementation now rejects incomplete identity primitives and length-prefixes both raw fields. Aggregate review then found `snapshotScript` exporting the full armed signature and pending recipient; it now emits only `"armed"`/`nil` plus pending country/color. | Lock blank ID/name, hidden-only name, visible name without ID, collision-shaped tuples, recipient tuple changes, disappearance, zero/multiple spectators, redacted diagnostics, and no production-save identity persistence. Assert two confirm presses never call `changeColor` or move the clock for every ineligible recipient; then rerun the account-identified positive path in the guarded live fixture. |
| TTS-029 | At 1600×1000 and the supported low-resolution/UI-scale check, restore exact Native seating so Resume is required; separately leave one seat missing with an anonymous, format-only, missing-account, zero-, or multiple-Grey state. | The 64 px instruction area renders every safety-critical word without truncation. Exact seating says to finish the TTS handoff, press Resume, and that the clock/native End Turn stay paused. Ineligible Assign states explain the named Steam-account requirement and direct the host to TTS Change Color, then Resume. | Evidence `54-delayed-callback-requires-fresh-resume.jpg` visibly truncates the former 232-character Resume copy after “clock; native”. The raw-value live test passed and therefore falsely blessed a clipped product. The copy is now 134 characters; the longest ineligible guidance is capped at 180 characters. Evidence `60-resume-guidance-no-truncation.jpg` and `61-change-color-guidance-no-truncation.jpg` show both installed-client messages in full at 1600×1000; evidence `18-720p-layout-pass.png` proves the same unchanged 64 px instruction box stays readable and on-screen at the supported 1280×720-equivalent layout. | Assert exact text, action words, and maximum 140/180-character budgets in the installed interpreter; keep XML at 64 px; visually inspect both messages at supported scales after any copy, font, width, or height change. |

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
- Exercise visible docket controls, console buttons, Game Keys, chat, native End Turn, platform player-name/handoff dialogs, and docket-only Native Resume as real users.
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
- A country-seat assignment is an explicit, account-identified and visibly named private-access grant: it requires one Grey recipient, one available missing active color, a fresh host/promoted two-step docket confirmation, and no persisted spectator identity. Anonymous, format-only, missing-account, or otherwise ambiguous recipients never expose Assign.
- Native Resume is a separate docket-only host/promoted action after inexact-to-exact restoration; it persists no identity, rechecks exact seating, exposes no private-seat grant, and cannot move the conference clock.
- Unauthorized UI, console, hotkey, and chat mutations are rejected privately.
- Simultaneous authorized/native actions and delayed post-dialog callbacks cannot double-advance.

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
