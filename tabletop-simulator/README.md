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
- configures Tabletop Simulator's built-in turn order for the countries in play;
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
2. Active delegations sit in the matching country colors shown on their mats. The docket reports how many active delegations are seated.
3. Each active delegation moves its own separate face-down mandate and red-line cards into its private hand. Its matching color-private Notebook tab is an accessibility copy; never inspect another delegation's tab. When an effect reveals a mandate, that card's owner moves only its own mandate out of its private hand and places it face up on the printed **MANDATE REVEAL** space of its country mat.
4. Enter a dispatch code in the floating panel.
5. Select **Open the conference**.
6. Reveal the top Crisis card and select **Begin Cabinet**.
7. During Crisis Council, spend resource cubes into your private hand. Reduce Military immediately and use brown proxy cubes. After everyone seals, reveal into the six labeled board lanes and resolve simultaneously.
8. During the Summit, post a one-for-one exchange in your labeled public proposal lane: the held offered cube goes on **GIVE**, and a supply proxy of the requested resource goes on **WANT**. Clear every unaccepted proposal in Aftermath.
9. Use the docket's phase-specific action, the physical console, or TTS **End Turn** after the active delegation completes its move.
10. Use **Undo clock** only to repair the clock. It does not undo pieces already moved.
11. When every active delegation has legally moved its signature seal and added the signing Peace, use the guarded **ALL SIGNED** action twice to close the conference immediately.

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

The live test loads the generated Global/controller scripts into an open table through TTS's local external editor API and exercises the clock, rosters, deals, controls, signed victory, and the Round-6 ending. Immediate-defeat endings are not yet exercised. The current harness does not perform a real Save & Load reload or restore an arbitrary pre-run physical session exactly. Until its disposable-save identity guard and failure-safe reload are verified, run it only against a dedicated throwaway readiness copy—never a valued play session.
