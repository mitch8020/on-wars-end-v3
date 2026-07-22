# On War’s End v3 — Rules of Play

## The promise

You are not generals. You are the people who must make peace politically survivable.

Each player owns one country. The table wins together only when every country signs the Vellan Accord before the sixth round ends. A country can sign only after it satisfies its national mandate, protects its red line, and trusts the conference enough to believe the treaty will hold.

## Players and roster

On War’s End supports two to six countries in a fixed introductory roster:

| Players | Countries |
|---:|---|
| 2 | Aravell, Tomerin |
| 3 | Aravell, Tomerin, Veyra |
| 4 | Aravell, Tomerin, Veyra, Karsk |
| 5 | Aravell, Tomerin, Veyra, Karsk, Belovar |
| 6 | Aravell, Tomerin, Veyra, Karsk, Belovar, Namarra |

In Solo Envoy mode, choose one of the countries in play. AI envoys own every other country. In Pass & Play, one local player owns each country.

## Shared tracks

### Peace Momentum

Peace begins at 1 and ranges from 0 to 10. Successful crises, de-escalation, exchanges, and diplomacy build it. Failed crises reduce it.

Peace must reach at least **6** before any country can sign.

### Global Unrest

Unrest begins at 3 and ranges from 0 to 10. Crises, painful domestic policies, and crossed red lines raise it. Reassurance and success lower it.

If Unrest reaches **10**, the table loses immediately.

### Refugee Pool

Refugees begin at **2 per country**. Crises add people to the pool; relief and some crisis successes resettle them.

If Refugees rise above **5 per country**, the table loses immediately.

## Country boards

Every country tracks four resources plus Civilian Population and Military:

- **Food** feeds people and supports relief.
- **Industry** rebuilds infrastructure and military capacity.
- **Fuel** powers transport, factories, and security.
- **Capital** funds production, diplomacy, and stabilization.
- **Civilian Population** is the country’s living social base.
- **Military** holds the ceasefire line and can be committed to demobilization crises.

Reaching 0 Population or 0 Military causes immediate defeat.

## National mandates and red lines

Mandates are private until revealed. Red lines are also private to their owner in Pass & Play. Crossing a red line does not instantly end the game. Instead:

1. That country becomes **Under Pressure**.
2. Global Unrest rises by 1 the first time the line is crossed.
3. The country cannot sign while the line remains unsafe.
4. If the condition is restored, the pressure marker clears.

| Country | National mandate | Red line |
|---|---|---|
| Aravell | Hold 3 Fuel and 3 Capital | Fuel cannot fall to 0 |
| Tomerin | Hold 3 Food while Unrest is 4 or lower | Unrest must remain below 7 |
| Veyra | Hold 3 Industry and 2 Fuel | Capital cannot fall to 0 |
| Karsk | Hold 6 Military and 3 Capital | Military must remain above 2 |
| Belovar | Hold 6 Capital and 6 Population | Population must remain above 3 |
| Namarra | Reach 10 Population with Refugees at 3 per country or fewer | Refugees cannot exceed 4 per country |

The web app shows the correct private information to the active owner and hides unrevealed foreign mandates.

## Trust

Trust is tracked separately between every pair of countries from 0 to 4.

- **0 — Broken:** cooperation has failed.
- **1 — Fragile:** the relationship begins here unless the countries are natural partners.
- **2 — Working:** credible enough to support a signature.
- **3 — Strong:** repeated cooperation.
- **4 — Bound:** the highest relationship level.

A country needs an **average Trust of at least 2.0** with all other countries in play before it can sign.

Trust changes when countries:

- both carry a fair share of a crisis: +1 with each other;
- complete a summit exchange: +1 with each other;
- use a diplomatic Cabinet policy: usually +1 or +2;
- open a summit backchannel: +2;
- contribute nothing while the other country carries a crisis: −1 with each other.

## Setup

1. Choose a player count and table mode.
2. Assign one owner to each country in the roster.
3. Enter or roll a dispatch code. The code deterministically sets crisis order and policy hands.
4. Set Peace to 1, Unrest to 3, and Refugees to 2 per country.
5. Read the first crisis briefing.
6. The chair opens Cabinet. With two countries, Aravell begins; with three to six, the dispatch code selects the first chair.

## A round

Every round follows the same three phases.

### I. Cabinet

Beginning with the chair and moving clockwise, each country takes exactly one Cabinet turn.

On your turn:

1. Inspect your hand of three policy cards.
2. Choose one legal policy and any required partner.
3. Pay its cost and apply its effect.

If none of the cards fit your plan, **Conserve Resources** instead to gain 1 Capital.

Policies can build resources, mobilize or demobilize, resettle Refugees, calm Unrest, reveal a mandate, or change Trust. A player may deliberately cross a red line, but the political pressure applies immediately.

### II. Crisis Council

The face-up crisis requests one or more contribution types. Requirements scale with the number of countries.

Beginning with the chair, each country seals one commitment:

1. Choose any whole number of each requested resource that the country holds.
2. Military commitments must leave at least 1 Military in the country.
3. Spend the committed pieces immediately.
4. A zero commitment is legal.

The web app shows the collective running total but does not identify individual commitments until they affect Trust.

After every country commits, compare totals with every requirement:

- If all requirements are met, apply the success result.
- If any requirement is short, apply the failure result.

Over-contributed resources are not returned. A crisis is a shared burden, not a marketplace.

### III. Peace Summit

Beginning with the chair, each country makes exactly one summit move:

#### Sign the Vellan Accord

Sign if all four locks are open:

1. Your national mandate is met.
2. Your red line is safe.
3. Peace Momentum is at least 6.
4. Your average Trust is at least 2.0.

A signature is permanent. After signing, the country continues playing and helping the remaining delegations.

#### Accept a proposal

Take another country’s posted one-for-one proposal. Exchange the two resources, build 1 Trust with the proposer, and gain 1 Peace.

#### Post a proposal

Offer 1 resource you hold in exchange for 1 different resource. The proposal remains open until another country accepts it or the round ends.

Posting consumes the current summit move. Resources are not spent unless the exchange is accepted.

#### Open a backchannel

Spend 1 Capital and choose another country. Build 2 Trust with it, reveal its mandate, and gain 1 Peace.

#### Pass

Close the summit window without an action.

## End of the round

After the final summit move:

1. Read the round communiqué.
2. Discard any unaccepted proposals.
3. Pass the chair clockwise.
4. Advance the Round marker.
5. Deal three new policies to every country.
6. Reveal the next crisis.

## Victory and defeat

The table wins immediately when every country has signed.

The table loses immediately if:

- Global Unrest reaches 10;
- Refugees rise above 5 per country;
- any country reaches 0 Civilian Population;
- any country reaches 0 Military; or
- Round 6 ends before every country has signed.

## Strategy without spoilers

- A crisis contribution buys more than survival. It also buys credibility.
- Mandates create surpluses and shortages that do not line up neatly. Exchange early.
- Peace can reach 6 before countries are personally ready. Trust and mandates still matter.
- Signing early is powerful: a signed country can spend later turns helping hold the coalition together.
- Red lines are recoverable. Sometimes accepting pressure now prevents a worse shared failure.
- With more countries, the crisis burden grows roughly with the table, but the Trust web grows faster. Large conferences demand deliberate diplomacy.
