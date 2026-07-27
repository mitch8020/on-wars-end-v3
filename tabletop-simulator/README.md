# On War's End v3 for Tabletop Simulator

This directory builds and documents the desktop Tabletop Simulator adaptation of **On War's End v3 — The Vellan Accord**.

## What is included

- One central conference board with Peace, Unrest, Refugee, Round, phase, signature, crisis, and Treaty Web areas.
- Six country mats for Aravell, Tomerin, Veyra, Karsk, Belovar, and Namarra.
- 61 individual starting resource cubes, infinite Food, Industry, Fuel, and Capital supplies, and a separate infinite supply of brown Military commitment proxies.
- Six independent 16-card Cabinet policy decks plus six private mandate cards and six separate private red-line cards.
- One six-card regional crisis deck.
- Population and Military counters, all 15 bilateral Trust counters, six signature seals, and six Pressure markers.
- Six color-matched private hand zones, color-private Notebook dossiers, TTS-specific public rules, a host guide, and a quick-reference board.
- A scripted conference clock in both a floating UI panel and a physical table console.

## What the script automates

The clock preserves the v3 cadence:

1. Briefing (table step)
2. Cabinet turns, chair first and clockwise
3. Crisis Council turns, chair first and clockwise
4. Peace Summit turns, chair first and clockwise
5. Aftermath (table step)
6. Pass the chair clockwise and begin the next round

It also:

- chooses the first chair from the dispatch code using the same xorshift sequence as the browser engine;
- configures Tabletop Simulator's built-in turn order only when every active country color is simultaneously seated;
- moves the active-country and phase markers;
- advances and persists Round 1–6;
- sets starting public and national counters;
- deals three Cabinet cards to each active seat when Cabinet opens;
- supports the physical console, floating panel, hotkeys, and `!owe` chat commands.

Policy legality, resource movement, crisis totals/results, Trust changes, exchanges, red-line Pressure, and signature eligibility remain tactile. The physical pieces, printed lanes, card tooltips, quick reference, and TTS-specific Notebook rules carry those rules. This keeps Tabletop Simulator useful as a real board-game table instead of turning it into a second browser UI.

## Build and verify

From `on-wars-end-v3`:

```powershell
npm run tts:build
npm run tts:verify
```

The build writes:

- `tabletop-simulator/dist/TS_Save_1.json`
- `tabletop-simulator/dist/TS_Save_1.png`
- `tabletop-simulator/dist/manifest.json`
- generated local PNG assets under `tabletop-simulator/assets/`

The manifest records the exact top-level/recursive object totals and standard byte-level SHA-256 digests for every generated PNG. An artifact fingerprint over the ordered hash map and object totals is embedded in both the manifest and generated conference board metadata. These checks prove that the local files belong to one internally consistent build; they are not a signed publisher-authenticity or hostile-tamper guarantee.

## Install

Copy the two `TS_Save_1` files into a named folder under the local Tabletop Simulator save directory:

```text
Documents\My Games\Tabletop Simulator\Saves\On War's End v3 - The Vellan Accord\
```

Then open Tabletop Simulator and select:

```text
Games → Save & Load → On War's End v3 — The Vellan Accord
```

The asset references are native absolute Windows paths. They work for single-player and local hotseat on this computer. Remote multiplayer or Workshop publication requires an explicitly approved **Upload → Cloud Manager → Upload All** pass, followed by a new save so other players can download the art.

## At the table

1. In the floating panel, choose the 2–6 active-country count and confirm the displayed fixed-prefix roster.
2. Active delegations sit in the matching country colors shown on their mats. The docket reports exact active-seat readiness and blocks any occupied inactive country color. Neutral observer colors are allowed.
3. Each active delegation moves its own separate face-down mandate and red-line cards into its private hand. Its matching color-private Notebook tab is an accessibility copy; never inspect another delegation's tab. When an effect reveals a mandate, that card's owner moves only its own mandate out of its private hand and places it face up on the printed **MANDATE REVEAL** space of its country mat.
4. Enter a dispatch code in the floating panel.
5. Select **Open the conference**. Exact active seating opens in **Native Turns** mode. If active seats are missing, the first press makes no game-state changes and arms **Confirm Manual Hotseat** for five seconds; the unchanged second press opens a manual session with native End Turn disabled. Distinct people may preserve private hands only by passing control before each viewing; one operator controlling multiple delegations is necessarily open information.
6. Reveal the top Crisis card and select **Begin Cabinet**.
7. During Crisis Council, spend resource cubes into your private hand. Reduce Military immediately and use brown proxy cubes. After everyone seals, reveal into the six labeled board lanes and resolve simultaneously.
8. During the Summit, post a one-for-one exchange in your labeled public proposal lane: the held offered cube goes on **GIVE**, and a supply proxy of the requested resource goes on **WANT**. Clear every unaccepted proposal in Aftermath.
9. Use the docket's phase-specific action or the physical console after the active delegation completes its move. TTS **End Turn** is available only in exact-seat Native Turns mode after any required **Resume Native Turns** handshake. Manual Hotseat uses the docket, console, Game Keys, or chat clock controls.
10. Use **Undo clock** only to repair the clock. It does not undo pieces already moved, and every mutating clock control is temporarily unavailable during a Native seating pause.
11. When every active delegation has legally moved its signature seal and added the signing Peace, use the guarded **ALL SIGNED** action twice to close the conference immediately.

During a running Native Turns conference, losing an active seat or occupying an inactive country seat pauses Native End Turn and every mutating clock control without moving the conference clock. TTS color/connect/disconnect events can arrive before the seat roster updates and do not identify the departed color, so any such event during Native play conservatively empties Turns and requires a harmless same-clock docket Resume—even if the final audit shows only neutral-observer churn. When exactly one active seat is missing, no inactive country is occupied, the target color is available, and exactly one Grey spectator has both a nonempty Steam account ID and a visible sanitized name, the docket offers **Assign country / color**. A host or promoted player must press it twice within five seconds. This deliberately grants that identified spectator access to the country's private hand; it does not claim to restore a prior person. Complete any TTS player-name/handoff dialog. Anonymous, format-only, or missing-account spectators never expose Assign; restore them with TTS **Change Color** instead. Once exact seating is restored, Native Turns remain off and the docket shows **Resume Native Turns**. A host or promoted player must select it there; the action rechecks exact seating and does not move the clock. The docket then shows **Resuming Native Turns** for one callback-free second before controls return; a handoff callback restarts that quiet period. Console NEXT/BACK, Next/Back Game Keys, `!owe next/back/finish`, Finish, Back, and native End Turn cannot resume a running conference; Status and Overview remain available. The sole exception is an already ended Native conference after exact seating returns: docket **Undo Clock** or the console's relabelled **Undo / To Resume** Back button may reopen the recorded ending source state, while the Resume latch and empty native order remain intact. Then use docket **Resume Native Turns**. Zero or multiple Grey spectators and every other ambiguous state remain fail-closed; restore exact seating with TTS **Change Color**, then use the same docket Resume. Loading any running Native save also starts behind this Resume gate and synchronously empties stale native turn order.

If a nonempty saved script payload is malformed, partial, contains unknown fields, or declares an unsupported future schema, the docket enters visible **Load blocked** quarantine. It preserves the rejected payload on subsequent saves, empties native Turns, disables setup and every clock mutation, and never treats a physically progressed table as fresh Setup. Reload a trusted untouched original or a separately preserved trusted session; do not use **Open the conference** as a physical reset.

The conference docket can be collapsed from its upper-right control. Its numbered rail shows the current table step without replacing the physical phase marker. A spectator host is framed automatically after setup finishes loading; use **OVERVIEW** (or `!owe view`) to restore the same tested full-table framing later.

Hotkeys are available from **Options → Game Keys**:

- `On War's End: next`
- `On War's End: back`
- `On War's End: status`

Chat commands:

```text
!owe help
!owe status
!owe next
!owe back
!owe finish
!owe view
```

Reload the original save to reset every physical component for a new game. Reloading discards unsaved physical changes, so preserve any valued session separately first.

## Live runtime verification

With the generated save open in Tabletop Simulator:

```powershell
npm run tts:test:live
```

The live test loads the generated Global/controller scripts into an open table through TTS's local external editor API and exercises seat classification, malformed-save quarantine, stale setup audits, Manual Hotseat, the guarded single-Grey seat-assignment workflow, anonymous-recipient rejection, Unicode-scalar-safe spectator labels, explicit Native resume, delayed platform-like callbacks, synthetic native-turn races, every clock adapter, the clock, rosters, deals, controls, signed victory, and the Round-6 ending. TTS Hotseat can keep its raw `Turns.enable` flag true even after shutdown; the effective fail-closed contract is an empty `Turns.order`, which exposes no native progression. Fresh release evidence exercises genuine exact-seat Native Turns, real Change Color seat loss, a replacement-name handoff, delayed-callback restart, same-clock docket Resume, and the first genuine native End Turn advancing exactly once. The surrogate-pair regression runs inside the installed MoonSharp interpreter because the external-editor/JSON bridge corrupts raw non-BMP test strings; it does not claim a genuine emoji Steam/hotseat name. Immediate-defeat endings are not yet exercised. The current harness does not perform a real Save & Load reload or restore an arbitrary pre-run physical session exactly. Until its disposable-save identity guard and failure-safe reload are verified, run it only against a dedicated throwaway readiness copy—never a valued play session.
