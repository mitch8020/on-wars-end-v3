const heading = (value) => `[C59A4A][b]${value}[/b][-]`
const subheading = (value) => `[8FC0B6][b]${value}[/b][-]`

export const publicRules = `${heading("ON WAR'S END v3 — THE VELLAN ACCORD")}
[b]TABLETOP SIMULATOR EDITION • 2–6 COUNTRIES • 60–120 MINUTES[/b]

You are not generals. You are the people who must make peace politically survivable.

This edition is a tactile table for human delegations. The script runs setup, chair order, turn order, phases, and rounds. Players resolve policies, crises, Trust, exchanges, red lines, signatures, and every physical-table outcome with the supplied cards, counters, cubes, and table lanes. There are no AI envoys. Exact active seating uses native TTS turns. Missing active seats require an explicit Manual Hotseat confirmation and keep native End Turn disabled. After any Native seating interruption, exact seating must be explicitly resumed from the docket. A solo rehearsal is open information: one operator cannot preserve secrets from themself.

${subheading('SHARED OBJECTIVE')}
The table wins immediately when every active country signs the Vellan Accord before the end of Round 6.

The table loses immediately if:
• Global Unrest reaches 10.
• Refugees rise above 5 × the active-country count.
• Any active country reaches 0 Population.
• Any active country reaches 0 Military.
• Round 6 ends before every active country signs.

${subheading('FIXED ROSTER')}
2: Aravell, Tomerin
3: + Veyra
4: + Karsk
5: + Belovar
6: + Namarra

Seat colors are printed on the country mats. White is the recommended spectator/clock-operator seat.

${subheading('SETUP')}
1. Choose the 2–6 active-country count in the Conference Clock and confirm the fixed-prefix roster printed below.
2. Sit in the matching active colors. An occupied inactive country color blocks opening; neutral observer colors are allowed.
3. Each delegation moves its separate face-down Mandate and Red Line cards into its private hand. The matching private Notebook tab is an accessibility copy; do not inspect another delegation's tab.
4. Enter a positive whole-number dispatch code and record it with the session notes.
5. Select OPEN THE CONFERENCE. Exact active seating opens in Native Turns mode. If active seats are missing, the first press changes no game state and arms CONFIRM MANUAL HOTSEAT for five seconds; the unchanged second press opens a manual session. Distinct people may preserve private hands only by passing control before each viewing; one operator controlling multiple delegations is necessarily open information. Only after opening do Peace reset to 1, Unrest to 3, Refugees to 2 per active country, national counters reset, decks prepare, and the first chair become selected. With two countries, Aravell chairs first.
6. Reveal the top Regional Crisis, read it aloud, then begin Cabinet.

[i]Privacy note: the Black Game Master seat can see all hidden zones and private Notebook tabs. Use it only for a trusted facilitator; a normal host may remain White.[/i]

${subheading('PUBLIC TRACKS AND PRIVATE PRESSURE')}
Peace and Unrest range from 0–10. Refugees cannot fall below 0. Trust is bilateral and ranges from 0 Broken to 4 Bound.

Each delegation's mandate and red line start private. If an effect reveals a mandate, that card's owner moves only its own National Mandate card out of its private hand and places it face up on the printed MANDATE REVEAL space of its country mat. Its separate Red Line card and private dossier remain private. When a red line changes from safe to unsafe, place that country's Pressure marker and raise Unrest by 1. Staying unsafe does not raise it again. Clear Pressure when the condition becomes safe; a later recrossing is a new safe-to-unsafe crossing and raises Unrest again. A country under Pressure cannot sign.

[b]Stop and check every immediate-defeat condition after each policy, crisis result, exchange, signature, or other physical change to a public track, Population counter, or Military counter. Do not wait for Aftermath.[/b]

${subheading('1 • CABINET')}
Chair first, then clockwise, each country gets exactly one turn:
• Play one policy from the private three-card hand, pay every cost, choose any required active partner, and apply every printed effect; or
• Conserve Resources to gain 1 Capital.

The 16-card country decks are independent. When Cabinet opens in each round, old policy cards return and each active delegation receives a fresh hand. Signed countries keep taking turns.

${subheading('2 • CRISIS COUNCIL')}
Chair first, then clockwise, each country seals one whole-number commitment of only the resource types requested by the face-up crisis. Zero is legal. A country cannot commit more than it holds; a Military commitment must leave at least 1 Military.

[b]SEALED COMMITMENT PROTOCOL[/b]
1. Spend committed resource cubes from the mat into your private hand zone. Reduce Military immediately and take matching brown Military proxy cubes from the supply.
2. When every delegation says “sealed,” reveal simultaneously by moving the pieces to that country's printed commitment lane.
3. Total every requested type. All requirements must be met for success. Over-contributions are not returned.
4. Apply the crisis result, then return spent resource cubes and Military proxies to their supplies. Committed Military remains reduced.
5. Discard the resolved Crisis face up beside the deck.

[b]Crisis Trust[/b]
Responsible share = max(1, floor(0.6 × total required units ÷ active countries)).
• Two countries that each meet the responsible share gain 1 Trust with each other.
• If exactly one of a pair contributes zero while the other contributes at least one unit, that pair loses 1 Trust.

${subheading('3 • PEACE SUMMIT')}
Chair first, then clockwise, each country takes exactly one move:

[b]SIGN[/b] — Move your seal only when your mandate is met, your red line is safe, its Pressure marker is cleared, Peace is at least 6, and your average Trust with all other active countries is at least 2.0. Gain 1 Peace. A signature is permanent; signed countries continue helping.

[b]PUBLIC PROPOSAL PROTOCOL — POST[/b] — Offer one held resource for one different resource. Put the offered cube in your printed proposal lane and take a clearly separated requested-resource proxy from its infinite supply. Posting uses your move; the offered cube is reserved, not spent.

[b]ACCEPT[/b] — Choose another active country's valid proposal. Give the requested resource to the proposer, take its offered cube, return the request proxy to its supply, gain 1 Trust with the proposer, and gain 1 Peace.

[b]BACKCHANNEL[/b] — Spend 1 Capital, choose another active country, gain 2 Trust with it, and gain 1 Peace. The target delegation's owner then moves only its own National Mandate card out of its private hand to its printed MANDATE REVEAL space face up. Never reveal its separate Red Line card or private Notebook tab.

[b]PASS[/b] — Make no other Summit move.

${subheading('AFTERMATH')}
After the final Summit move:
1. Read the round status aloud.
2. Clear every unaccepted proposal: return the offered cube to its owner and the request proxy to supply.
3. Confirm Pressure and immediate-defeat checks already occurred after each physical effect; check them again now.
4. Advance the clock. The chair passes clockwise and the Round marker advances. Reveal the next Crisis during Briefing; fresh policy hands arrive when Cabinet opens.

${subheading('CLOCK CONTROLS')}
The large primary action advances one table step or delegation turn. TTS End Turn is supported during Cabinet, Crisis Council, and Peace Summit only in exact-seat Native Turns mode. Manual Hotseat keeps native End Turn off; use the docket, console, Game Keys, or chat clock controls and pass control before viewing a private hand. If a running Native conference loses a seat or gains an inactive-country occupant, native End Turn and every mutating clock control pause without moving the clock. Because TTS seat events can precede the roster update and do not identify the departed color, every Native color/connect/disconnect event conservatively empties Turns and requires a harmless same-clock docket Resume, even when the final audit shows only neutral-observer churn. With exactly one missing active seat, one Grey spectator with both a nonempty Steam account ID and a visible sanitized name, no occupied inactive seat, and an available target color, a host or promoted player may use the docket's two-press ASSIGN action. This grants that identified spectator the country's private-hand access; complete any TTS player-name/handoff dialog. Anonymous, format-only, or missing-account spectators must use TTS Change Color instead. Exact seating alone does not restore Native Turns. Close the dialog, then a host or promoted player selects RESUME NATIVE TURNS in the docket. It rechecks seating and does not advance the clock. RESUMING NATIVE TURNS then holds every mutation for one callback-free second; a late handoff callback restarts that quiet period. Console NEXT/BACK, Next/Back Game Keys, !owe next/back/finish, Finish, Back, and native End Turn remain blocked until settlement completes; STATUS and OVERVIEW remain available. The sole exception is an already ended Native conference after exact seating returns: docket UNDO CLOCK or the console's relabelled UNDO / TO RESUME Back button may reopen the recorded source state without clearing the Resume latch, after which docket RESUME NATIVE TURNS is still required. Ambiguous seating remains paused and must be repaired with TTS Change Color, followed by the same docket Resume. Loading a running Native save also empties native turn order and requires this docket Resume. A malformed, partial, unknown-field, or future-version saved script payload shows LOAD BLOCKED and disables every scripted mutation; reload a trusted untouched original instead of opening over a progressed physical table. UNDO CLOCK repairs only the clock; it never reverses cards, counters, cubes, seals, proposals, or other physical moves.

STATUS and OVERVIEW are safe read-only tools. ALL SIGNED requires two presses within five seconds; either press may come from any host or promoted player, and the second press is that authorized operator's attestation that every tactile signing requirement is legal. The host or a promoted player controls mutating clock actions.

Chat: !owe help • !owe status • !owe next • !owe back • !owe finish • !owe view
Game Keys: On War's End: next • back • status

Reload the original save to reset every physical component for a new conference. Reloading discards unsaved physical changes, so preserve any valued session separately first.`

export function privateDossier(country) {
  const starts = `Food ${country.start.food} • Industry ${country.start.industry} • Fuel ${country.start.fuel} • Capital ${country.start.capital}`
  return `${heading(`${country.name.toUpperCase()} — PRIVATE DOSSIER`)}
[b]${country.epithet}[/b]
${country.brief}

${subheading('YOUR MANDATE')}
[b]${country.mandateTitle}[/b]
${country.mandate}

${subheading('YOUR RED LINE')}
${country.redLine}

If the red line changes from safe to unsafe, place your Pressure marker and raise Global Unrest by 1. Staying unsafe does not repeat the penalty. Clear Pressure when safe; a later recrossing raises Unrest again. You cannot sign while under Pressure.

${subheading('STARTING POSITION')}
${starts}
Population ${country.population} • Military ${country.military}

Keep this tab and both matching physical cards private. If an effect reveals your mandate, move only the National Mandate card out of your hand to the printed MANDATE REVEAL space face up; your separate Red Line card and this tab remain private.`
}

export const hostGuide = `${heading('CLOCK OPERATOR — HOST GUIDE')}
Use White as the spectator host when possible. The Black Game Master seat can see all private hands, hidden zones, and private Notebook tabs.

Before opening:
• Confirm the active-country count and fixed-prefix roster. Exact active seats open Native Turns immediately; missing active seats require the visible two-press Manual Hotseat warning; any occupied inactive country color blocks.
• Confirm each active delegation has taken both separate face-down private cards into its hand.
• Enter the agreed dispatch code.
• In Manual Hotseat, native End Turn stays off. Pass control before each private hand; one operator controlling multiple countries is an open-information rehearsal.

During play:
• Advance only after the acting delegation completes every physical move.
• At Crisis, wait for every sealed commitment to be revealed and fully resolved before opening Summit.
• Stop and check defeat thresholds after every physical counter/track change, then check again in Aftermath before advancing.
• If Native seating breaks, native End Turn and every mutating clock control pause. The docket offers ASSIGN only for one Grey spectator with a nonempty Steam account ID, a visible sanitized name, and one available missing active color. Verify the displayed account/name and country, press twice within five seconds, then complete any TTS player-name/handoff dialog. This is a private-seat grant, not person recovery. Anonymous, format-only, missing-account, zero/multiple-Grey, or otherwise ambiguous states stay paused; use Change Color.
• After the dialog closes and exact seating appears, select RESUME NATIVE TURNS in the docket. It rechecks seating and does not move the clock. Wait through the one-second RESUMING NATIVE TURNS quiet period; a late handoff callback restarts it. Console NEXT/BACK, Next/Back Game Keys, !owe next/back/finish, Finish, Back, and native End Turn cannot perform this step. STATUS and OVERVIEW remain available.
• Use UNDO CLOCK only for a clock mistake. Repair physical state manually. It is unavailable during a running Native seating pause; after an ended Native conference regains exact seating, docket UNDO CLOCK or console UNDO / TO RESUME may reopen the recorded source state while retaining the required docket Resume.
• If a required component is missing, stop. Reloading the original save discards unsaved physical changes, so preserve any valued session separately first.

Local art paths support single-player and hotseat on this computer. Do not host remotely until an approved Cloud Manager upload has replaced every local asset path.`
