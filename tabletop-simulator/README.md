# On War's End v3 for Tabletop Simulator

This directory builds and documents the desktop Tabletop Simulator adaptation of **On War's End v3 — The Vellan Accord**.

## What is included

- One central conference board with Peace, Unrest, Refugee, Round, phase, signature, crisis, and Treaty Web areas.
- Six country mats for Aravell, Tomerin, Veyra, Karsk, Belovar, and Namarra.
- 61 individual starting resource cubes plus infinite Food, Industry, Fuel, and Capital supplies.
- Six independent 16-card Cabinet policy decks and six private mandate/red-line cards.
- One six-card regional crisis deck.
- Population and Military counters, all 15 bilateral Trust counters, six signature seals, and six Pressure markers.
- Six color-matched private hand zones and a quick-reference board.
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

Policy legality, resource movement, crisis totals/results, Trust changes, exchanges, red-line Pressure, and signature eligibility remain tactile. The physical pieces and card tooltips carry those rules. This keeps Tabletop Simulator useful as a real board-game table instead of turning it into a second browser UI.

## Build and verify

From `on-wars-end-v3`:

```powershell
npm run tts:build
npm run tts:verify
```

The build writes:

- `tabletop-simulator/dist/TS_Save_1.json`
- `tabletop-simulator/dist/TS_Save_1.png`
- generated local PNG assets under `tabletop-simulator/assets/`

## Install

Copy the two `TS_Save_1` files into a named folder under the local Tabletop Simulator save directory:

```text
Documents\My Games\Tabletop Simulator\Saves\On War's End v3 - The Vellan Accord\
```

Then open Tabletop Simulator and select:

```text
Games → Save & Load → On War's End v3 — The Vellan Accord
```

The asset references are native absolute Windows paths. They work for single-player and local hotseat on this computer. Before hosting online multiplayer or publishing to Workshop, use Tabletop Simulator's **Upload → Cloud Manager → Upload All**, then save the table so other players can download the art.

## At the table

1. Sit in the country color shown on each mat.
2. In the floating panel, choose 2–6 countries and enter a dispatch code.
3. Select **Start conference**.
4. Reveal the top Crisis card and select **Begin Cabinet**.
5. Use **NEXT** after the active delegation completes its move.
6. Use **BACK** only to repair the clock. It does not undo pieces already moved.
7. When every active delegation has moved its signature seal, use the guarded **ALL SIGNED** action twice to close the conference immediately.

The conference docket can be collapsed from its upper-right control. Its numbered rail shows the current table step without replacing the physical phase marker.

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
```

Reload the original save to reset every physical component for a new game.

## Live runtime verification

With the generated save open in Tabletop Simulator:

```powershell
npm run tts:test:live
```

The live test loads the generated Global/controller scripts into the open table through TTS's local external editor API, then verifies setup visibility, deterministic chair selection, counter reset, all six private deals, the full turn cadence, the guarded signed ending and undo, chair rotation, and panel collapse. It restores the open session to its setup state when complete.
