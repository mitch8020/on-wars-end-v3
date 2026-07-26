import { chromium } from 'playwright'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countries, crises, phases, policies, resources } from './content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.dirname(here)
const assetDir = path.join(here, 'assets')
const distDir = path.join(here, 'dist')
const sourceDir = path.join(here, 'src')
const ttsSeatColors = {
  Blue: { r: 0.117999978, g: 0.53, b: 1, a: 0 },
  Red: { r: 0.856, g: 0.09999997, b: 0.09399996, a: 0 },
  Green: { r: 0.191999972, g: 0.701, b: 0.167999953, a: 0 },
  Yellow: { r: 0.905, g: 0.898, b: 0.171999961, a: 0 },
  Purple: { r: 0.627, g: 0.124999978, b: 0.941, a: 0 },
  Teal: { r: 0.128999949, g: 0.694, b: 0.606999934, a: 0 },
}

await mkdir(assetDir, { recursive: true })
await mkdir(distDir, { recursive: true })

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const commonCss = `
  * { box-sizing: border-box; }
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
  body {
    color: #211d17;
    font-family: "Segoe UI", Arial, sans-serif;
    background: #efe4ca;
  }
  .serif { font-family: Georgia, "Times New Roman", serif; }
  .eyebrow {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: .18em;
    text-transform: uppercase;
  }
  .rule { height: 2px; background: currentColor; opacity: .28; }
`

function documentFor(body, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${commonCss}${extraCss}</style></head><body>${body}</body></html>`
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })

async function renderAsset(filename, width, height, body, extraCss = '') {
  await page.setViewportSize({ width, height })
  await page.setContent(documentFor(body, extraCss), { waitUntil: 'load' })
  const destination = path.join(assetDir, filename)
  await page.screenshot({ path: destination, type: 'png' })
  return destination
}

function track(label, color, note) {
  const cells = Array.from(
    { length: 11 },
    (_, index) => `<div class="track-cell"><b>${index}</b></div>`,
  ).join('')
  return `
    <section class="track" style="--track:${color}">
      <div class="track-copy"><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></div>
      <div class="track-cells">${cells}</div>
    </section>`
}

const trustPairs = []
for (let first = 0; first < countries.length; first += 1) {
  for (let second = first + 1; second < countries.length; second += 1) {
    trustPairs.push([countries[first], countries[second]])
  }
}

const boardBody = `
  <main class="board">
    <header>
      <div>
        <div class="eyebrow">The Vellan Conference · Six rounds</div>
        <h1 class="serif">ON WAR'S END</h1>
      </div>
      <div class="dispatch">
        <b>THE VELLAN ACCORD</b>
        <span>Mandate · Red line · Peace 6+ · Average Trust 2.0+</span>
      </div>
    </header>
    <div class="board-grid">
      <section class="public-tracks">
        <h2>Public situation</h2>
        ${track('Peace momentum', '#567f77', 'Start 1 · Sign at 6')}
        ${track('Global unrest', '#a85043', 'Start 3 · Lose at 10')}
        <div class="counter-ledger">
          <div><b>REFUGEES</b><span>Start 2 per country · Lose above 5 per country</span></div>
          <div><b>ROUND</b><span>Six rounds to secure every signature</span></div>
        </div>
        <div class="crisis-council">
          <div class="eyebrow">Crisis council</div>
          <h3 class="serif">Seal one commitment</h3>
          <p>Chair first, then clockwise. Spend requested resources immediately. Zero is legal. Military must leave at least 1 behind.</p>
          <div class="commitment-row">
            ${resources.map((resource) => `<span style="--piece:${resource.color}">${resource.short}</span>`).join('')}
            <span style="--piece:#7d554a">MIL</span>
          </div>
        </div>
      </section>
      <section class="accord">
        <div class="seal">
          <div class="seal-inner">
            <span>THE</span>
            <strong class="serif">VELLAN</strong>
            <strong class="serif">ACCORD</strong>
            <small>Peace must be politically survivable.</small>
          </div>
        </div>
        <div class="signature-ring">
          ${countries
            .map(
              (country, index) =>
                `<div class="signature signature-${index}" style="--country:${country.color}">${country.monogram}</div>`,
            )
            .join('')}
        </div>
        <div class="summit-note">
          <b>SUMMIT MOVES</b>
          <span>Sign · Accept · Post · Backchannel · Pass</span>
        </div>
      </section>
      <section class="trust-ledger">
        <h2>Treaty web · bilateral Trust 0–4</h2>
        <p>0 Broken · 1 Fragile · 2 Working · 3 Strong · 4 Bound</p>
        <div class="trust-grid">
          ${trustPairs
            .map(
              ([first, second]) => `
                <div class="trust-pair">
                  <span style="--first:${first.color};--second:${second.color}">
                    ${first.monogram} · ${second.monogram}
                  </span>
                  <i>TRUST</i>
                </div>`,
            )
            .join('')}
        </div>
      </section>
    </div>
    <footer class="phase-strip">
      ${phases
        .slice(0, 5)
        .map(
          (phase, index) => `
            <div>
              <b>${index + 1}</b>
              <span>${escapeHtml(phase.label)}</span>
            </div>`,
        )
        .join('')}
    </footer>
  </main>
`

await renderAsset(
  'conference-board.png',
  4096,
  2304,
  boardBody,
  `
    body {
      padding: 72px;
      background:
        radial-gradient(circle at 50% 45%, rgba(255,255,255,.9), transparent 34%),
        linear-gradient(135deg, #ede2c8, #d8c59f);
    }
    .board {
      height: 100%;
      border: 12px double #4a3a2a;
      padding: 52px 60px 44px;
      background:
        linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,.22)),
        repeating-linear-gradient(0deg, transparent 0 28px, rgba(77,58,38,.025) 29px 30px);
      box-shadow: inset 0 0 90px rgba(58,40,23,.22);
      position: relative;
    }
    header { display: flex; justify-content: space-between; align-items: end; height: 250px; }
    h1 { margin: 10px 0 0; font-size: 112px; letter-spacing: .03em; line-height: .9; }
    .dispatch {
      width: 1230px;
      padding: 28px 36px;
      border: 3px solid #5d4b35;
      text-align: right;
      display: grid;
      gap: 12px;
    }
    .dispatch b { font-size: 32px; letter-spacing: .14em; }
    .dispatch span { font-size: 25px; }
    .board-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr 1.2fr;
      gap: 56px;
      height: 1600px;
      padding-top: 48px;
    }
    h2 { margin: 0 0 22px; font-size: 32px; text-transform: uppercase; letter-spacing: .12em; }
    .track { margin-bottom: 32px; }
    .track-copy { display: flex; justify-content: space-between; align-items: end; margin-bottom: 9px; }
    .track-copy span { font-size: 27px; font-weight: 800; text-transform: uppercase; }
    .track-copy small { font-size: 20px; }
    .track-cells { display: grid; grid-template-columns: repeat(11, 1fr); gap: 6px; }
    .track-cell {
      height: 68px; border: 3px solid var(--track); background: color-mix(in srgb, var(--track) 18%, white);
      display: grid; place-items: center; font-size: 24px;
    }
    .counter-ledger { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 38px 0; }
    .counter-ledger div { min-height: 156px; border: 3px solid #66543c; padding: 24px; display: grid; gap: 14px; }
    .counter-ledger b { font-size: 27px; letter-spacing: .12em; }
    .counter-ledger span { font-size: 20px; line-height: 1.35; }
    .crisis-council { border: 4px solid #755247; padding: 34px; background: rgba(117,82,71,.09); }
    .crisis-council h3 { margin: 12px 0; font-size: 49px; }
    .crisis-council p { font-size: 24px; line-height: 1.42; }
    .commitment-row { display: flex; gap: 14px; margin-top: 28px; }
    .commitment-row span {
      width: 82px; height: 82px; display: grid; place-items: center; border-radius: 12px;
      background: var(--piece); color: white; font-size: 23px; font-weight: 900; box-shadow: inset 0 0 0 4px rgba(0,0,0,.18);
    }
    .accord { position: relative; display: grid; place-items: center; }
    .seal {
      width: 820px; height: 820px; border-radius: 50%;
      border: 10px double #6f5a39; display: grid; place-items: center;
      background: radial-gradient(circle, #f8efd8 0 53%, #d3bd89 54% 55%, #efe1bf 56%);
      box-shadow: 0 22px 60px rgba(43,31,18,.18);
    }
    .seal-inner { text-align: center; width: 570px; display: grid; }
    .seal-inner span { font-size: 26px; letter-spacing: .5em; margin-left: .5em; }
    .seal-inner strong { font-size: 83px; line-height: .95; color: #3d3427; }
    .seal-inner small { margin-top: 30px; font-size: 22px; line-height: 1.35; }
    .signature-ring { position: absolute; inset: 0; }
    .signature {
      position: absolute; width: 108px; height: 108px; border-radius: 50%;
      display: grid; place-items: center; font-size: 27px; font-weight: 900;
      border: 6px solid var(--country); background: #f4ead0; color: #342b20;
    }
    .signature-0 { left: 12%; top: 23%; } .signature-1 { left: 43%; top: 5%; }
    .signature-2 { right: 12%; top: 23%; } .signature-3 { right: 12%; bottom: 25%; }
    .signature-4 { left: 43%; bottom: 7%; } .signature-5 { left: 12%; bottom: 25%; }
    .summit-note { position: absolute; bottom: 70px; text-align: center; display: grid; gap: 8px; }
    .summit-note b { font-size: 27px; letter-spacing: .15em; }
    .summit-note span { font-size: 22px; }
    .trust-ledger p { font-size: 21px; margin: -8px 0 22px; }
    .trust-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px 12px; }
    .trust-pair { height: 195px; border: 3px solid #746249; padding: 18px 10px; display: grid; align-content: space-between; text-align: center; background: rgba(255,255,255,.22); }
    .trust-pair span { font-size: 23px; font-weight: 900; padding-bottom: 12px; border-bottom: 9px solid; border-image: linear-gradient(90deg,var(--first),var(--second)) 1; }
    .trust-pair i { font-style: normal; font-size: 18px; letter-spacing: .12em; opacity: .65; }
    .phase-strip { height: 190px; display: grid; grid-template-columns: repeat(5,1fr); gap: 18px; align-items: end; }
    .phase-strip div { height: 124px; border-top: 5px solid #4b3d2d; display: flex; align-items: center; gap: 22px; padding: 0 24px; background: rgba(74,58,42,.07); }
    .phase-strip b { width: 58px; height: 58px; border-radius: 50%; background: #4b3d2d; color: #f3e7cb; display: grid; place-items: center; font-size: 27px; }
    .phase-strip span { font-size: 27px; font-weight: 800; text-transform: uppercase; }
  `,
)

for (const country of countries) {
  const resourceColumns = resources
    .map(
      (resource) => `
        <div class="resource-bay" style="--resource:${resource.color}">
          <b>${resource.short}</b>
          <span>${resource.label}</span>
          <small>Start ${country.start[resource.id]}</small>
        </div>`,
    )
    .join('')
  await renderAsset(
    `mat-${country.id}.png`,
    1920,
    1080,
    `
      <main class="mat" style="--country:${country.color}">
        <header>
          <div class="monogram">${country.monogram}</div>
          <div>
            <div class="eyebrow">${escapeHtml(country.epithet)}</div>
            <h1 class="serif">${country.name}</h1>
          </div>
          <div class="seat">${country.seatColor} seat</div>
        </header>
        <p class="brief">${escapeHtml(country.brief)}</p>
        <section class="resources">${resourceColumns}</section>
        <section class="lower">
          <div class="policy">
            <div><b>CABINET DECK</b><span>Draw 3 each round</span></div>
            <div><b>PRIVATE MANDATE</b><span>Keep face-down or in hand</span></div>
          </div>
          <div class="national">
            <div><b>POPULATION</b><strong>${country.population}</strong></div>
            <div><b>MILITARY</b><strong>${country.military}</strong></div>
            <div><b>PRESSURE</b><span>${escapeHtml(country.pressure)}</span></div>
          </div>
        </section>
      </main>`,
    `
      body { padding: 34px; background: #d7c6a4; }
      .mat { height: 100%; border: 12px solid var(--country); padding: 38px 46px; background: linear-gradient(135deg,#f0e4c9,#d9c49d); box-shadow: inset 0 0 70px rgba(47,37,26,.18); }
      header { display: grid; grid-template-columns: 150px 1fr auto; gap: 28px; align-items: center; }
      .monogram { width: 128px; height: 128px; border-radius: 50%; display: grid; place-items: center; background: var(--country); color: #1c1a16; font-size: 39px; font-weight: 900; border: 6px solid rgba(33,29,23,.7); }
      h1 { margin: 5px 0 0; font-size: 76px; line-height: .9; }
      .seat { font-size: 23px; text-transform: uppercase; letter-spacing: .15em; font-weight: 800; border: 3px solid #5b4a35; padding: 16px 22px; }
      .brief { font-size: 25px; margin: 28px 0 30px; }
      .resources { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; }
      .resource-bay { height: 260px; border: 4px solid var(--resource); background: rgba(255,255,255,.22); display: grid; place-items: center; align-content: center; gap: 7px; }
      .resource-bay b { width: 86px; height: 86px; border-radius: 15px; background: var(--resource); color: #fff; display: grid; place-items: center; font-size: 27px; text-shadow: 0 2px 4px rgba(0,0,0,.4); }
      .resource-bay span { font-size: 25px; font-weight: 800; text-transform: uppercase; }
      .resource-bay small { font-size: 21px; }
      .lower { display: grid; grid-template-columns: 1.05fr 1fr; gap: 26px; margin-top: 28px; }
      .policy { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      .policy div, .national div { border-top: 4px solid #68563e; padding: 18px; display: grid; gap: 9px; }
      .policy b, .national b { font-size: 22px; letter-spacing: .1em; }
      .policy span, .national span { font-size: 20px; }
      .national { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 12px; }
      .national strong { font-size: 44px; }
    `,
  )
}

function policyCard(policy, index) {
  const accent = ['#7c8b5c', '#78628b', '#4e7976', '#955f4d'][index % 4]
  return `
    <article class="card policy-card" style="--accent:${accent}">
      <div class="card-top"><span>${escapeHtml(policy.kicker)}</span><b>${String(index + 1).padStart(2, '0')}</b></div>
      <div class="policy-mark">CABINET</div>
      <h2 class="serif">${escapeHtml(policy.title)}</h2>
      <div class="card-rule"></div>
      <p>${escapeHtml(policy.description)}</p>
      <footer><span>ONE POLICY THIS TURN</span><b>OWE · V3</b></footer>
    </article>`
}

await renderAsset(
  'policy-sheet.png',
  4096,
  4096,
  `<main class="sheet policy-sheet">${policies.map(policyCard).join('')}</main>`,
  `
    .sheet { width:100%; height:100%; display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(4,1fr); }
    .card { position:relative; overflow:hidden; padding:58px; border:16px solid #efe3c8; box-shadow:inset 0 0 0 7px #393126; background:linear-gradient(145deg,#f6ebd1,#ddc9a1); }
    .card:before { content:""; position:absolute; inset:0 0 auto; height:24px; background:var(--accent); }
    .card-top { display:flex; justify-content:space-between; font-size:25px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:var(--accent); }
    .policy-mark { margin-top:78px; font-size:23px; letter-spacing:.28em; font-weight:900; opacity:.55; }
    h2 { font-size:64px; line-height:1.02; margin:20px 0 26px; }
    .card-rule { width:110px; height:8px; background:var(--accent); }
    p { margin:34px 0 0; font-size:34px; line-height:1.36; }
    footer { position:absolute; left:58px; right:58px; bottom:55px; border-top:3px solid #75634c; padding-top:20px; display:flex; justify-content:space-between; font-size:19px; letter-spacing:.12em; }
  `,
)

function crisisCard(crisis, index) {
  return `
    <article class="card crisis-card">
      <div class="card-top"><span>CRISIS ${index + 1}</span><b>${escapeHtml(crisis.location)}</b></div>
      <h2 class="serif">${escapeHtml(crisis.title)}</h2>
      <p class="briefing">${escapeHtml(crisis.briefing)}</p>
      <section><b>REQUIREMENT</b><span>${escapeHtml(crisis.requirement)}</span></section>
      <div class="outcomes">
        <section class="success"><b>SUCCESS</b><span>${escapeHtml(crisis.success)}</span></section>
        <section class="failure"><b>FAILURE</b><span>${escapeHtml(crisis.failure)}</span></section>
      </div>
      <footer>Resolve after every country seals a commitment.</footer>
    </article>`
}

await renderAsset(
  'crisis-sheet.png',
  3072,
  2048,
  `<main class="sheet crisis-sheet">${crises.map(crisisCard).join('')}</main>`,
  `
    .sheet { width:100%; height:100%; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(2,1fr); }
    .card { position:relative; overflow:hidden; padding:50px; border:15px solid #eadfc5; box-shadow:inset 0 0 0 8px #5d4038; background:linear-gradient(145deg,#f1e4ca,#d2b992); }
    .card:before { content:""; position:absolute; left:0; top:0; bottom:0; width:24px; background:#8b4f43; }
    .card-top { display:flex; justify-content:space-between; gap:20px; font-size:21px; font-weight:900; text-transform:uppercase; letter-spacing:.1em; color:#79443a; }
    .card-top b { text-align:right; }
    h2 { font-size:56px; line-height:1; margin:34px 0 24px; }
    .briefing { font-size:27px; line-height:1.35; min-height:178px; }
    section { display:grid; gap:10px; border-top:3px solid #6b5841; padding-top:20px; }
    section b { font-size:19px; letter-spacing:.14em; }
    section span { font-size:25px; line-height:1.25; }
    .outcomes { display:grid; grid-template-columns:1fr 1fr; gap:25px; margin-top:28px; }
    .success { color:#35665e; } .failure { color:#8a443c; }
    footer { position:absolute; left:50px; right:50px; bottom:42px; font-size:18px; letter-spacing:.08em; text-transform:uppercase; }
  `,
)

function mandateCard(country) {
  return `
    <article class="card mandate-card" style="--country:${country.color}">
      <div class="country-head">
        <div>${country.monogram}</div>
        <span><b>${country.name}</b><small>${escapeHtml(country.epithet)}</small></span>
      </div>
      <div class="private">PRIVATE NATIONAL BRIEF</div>
      <h2 class="serif">${escapeHtml(country.mandateTitle)}</h2>
      <section>
        <b>MANDATE</b>
        <p>${escapeHtml(country.mandate)}</p>
      </section>
      <section class="redline">
        <b>RED LINE</b>
        <p>${escapeHtml(country.redLine)}</p>
      </section>
      <footer>Crossing the line creates Pressure and +1 Global Unrest the first time.</footer>
    </article>`
}

await renderAsset(
  'mandate-sheet.png',
  3072,
  2048,
  `<main class="sheet mandate-sheet">${countries.map(mandateCard).join('')}</main>`,
  `
    .sheet { width:100%; height:100%; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(2,1fr); }
    .card { position:relative; overflow:hidden; padding:48px; border:15px solid #eadfc5; box-shadow:inset 0 0 0 8px #41382c; background:linear-gradient(145deg,#f3e8ce,#d8c29a); }
    .card:before { content:""; position:absolute; inset:0 0 auto; height:25px; background:var(--country); }
    .country-head { display:flex; align-items:center; gap:23px; }
    .country-head > div { width:92px; height:92px; display:grid; place-items:center; border-radius:50%; background:var(--country); font-size:27px; font-weight:900; border:5px solid #41382c; }
    .country-head span { display:grid; gap:4px; }
    .country-head b { font-size:35px; }
    .country-head small { font-size:20px; text-transform:uppercase; letter-spacing:.1em; }
    .private { margin-top:32px; color:#8b4b42; font-size:20px; font-weight:900; letter-spacing:.2em; }
    h2 { font-size:54px; line-height:1; margin:18px 0 34px; }
    section { border-top:3px solid #61503a; padding-top:22px; margin-top:24px; }
    section b { font-size:21px; letter-spacing:.15em; }
    section p { font-size:30px; line-height:1.3; margin:12px 0 0; }
    .redline { color:#8a3f38; }
    footer { position:absolute; left:48px; right:48px; bottom:42px; font-size:18px; line-height:1.3; }
  `,
)

async function renderBack(filename, eyebrow, title, subtitle, accent) {
  await renderAsset(
    filename,
    1024,
    1024,
    `
      <main class="back" style="--accent:${accent}">
        <div class="back-frame">
          <span>${escapeHtml(eyebrow)}</span>
          <div class="crest">V</div>
          <h1 class="serif">${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
          <b>ON WAR'S END · V3</b>
        </div>
      </main>`,
    `
      body { padding:24px; background:#191713; }
      .back { height:100%; padding:34px; background:repeating-linear-gradient(45deg,#28251f 0 22px,#211f1a 22px 44px); border:12px solid var(--accent); }
      .back-frame { height:100%; border:5px double var(--accent); display:grid; place-items:center; align-content:center; text-align:center; gap:30px; color:#eee0c2; }
      .back-frame > span { font-size:23px; letter-spacing:.24em; font-weight:900; }
      .crest { width:190px; height:190px; border-radius:50%; border:10px double var(--accent); display:grid; place-items:center; font:130px Georgia; color:var(--accent); }
      h1 { margin:0; font-size:70px; line-height:.95; max-width:720px; }
      p { margin:0; font-size:27px; max-width:680px; line-height:1.35; }
      b { font-size:20px; letter-spacing:.18em; color:var(--accent); }
    `,
  )
}

await renderBack('policy-back.png', 'Cabinet dispatch', 'State Policy', 'One consequential decision before the crisis council.', '#b68751')
await renderBack('crisis-back.png', 'Regional emergency', 'Crisis Briefing', 'The table survives together—or not at all.', '#a45e4f')
await renderBack('mandate-back.png', 'Eyes only', 'National Mandate', 'Private political terms for a survivable peace.', '#6f948c')

await renderAsset(
  'quick-reference.png',
  1800,
  1200,
  `
    <main class="reference">
      <div>
        <div class="eyebrow">On War's End · quick reference</div>
        <h1 class="serif">A round at the Vellan table</h1>
      </div>
      <section class="steps">
        <article><b>1 · CABINET</b><p>Each country plays one legal policy or Conserves Resources for +1 Capital.</p></article>
        <article><b>2 · CRISIS</b><p>Chair first. Spend a sealed whole-number commitment. Resolve after everyone commits.</p></article>
        <article><b>3 · SUMMIT</b><p>Sign, accept/post a one-for-one exchange, spend 1 Capital on a backchannel, or pass.</p></article>
      </section>
      <section class="locks">
        <h2>Four locks before a signature</h2>
        <div><span>MANDATE</span><span>RED LINE SAFE</span><span>PEACE 6+</span><span>AVG TRUST 2.0+</span></div>
      </section>
      <section class="loss">
        <b>IMMEDIATE DEFEAT</b>
        <p>Unrest 10 · Refugees above 5 per country · Any Population 0 · Any Military 0 · Round 6 ends unsigned</p>
      </section>
      <footer>Alt-hover a component for its full name and rules text. The scripted clock handles order; players move pieces and resolve effects.</footer>
    </main>`,
  `
    body { padding:34px; background:#1f1b16; }
    .reference { height:100%; padding:48px 58px; border:10px double #6b563b; background:linear-gradient(135deg,#f2e7cd,#dac49c); display:grid; grid-template-rows:auto 1fr auto auto auto; gap:28px; }
    h1 { font-size:64px; margin:10px 0 0; }
    .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
    article { border-top:8px solid #6a5540; padding:25px; background:rgba(255,255,255,.2); }
    article b { font-size:25px; letter-spacing:.1em; }
    article p { font-size:25px; line-height:1.4; }
    .locks { border:4px solid #55766f; padding:25px; }
    .locks h2 { margin:0 0 20px; font-size:30px; }
    .locks div { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
    .locks span { padding:18px; background:#55766f; color:white; text-align:center; font-size:20px; font-weight:900; }
    .loss { display:flex; gap:28px; align-items:center; color:#8a433b; border-top:4px solid currentColor; padding-top:20px; }
    .loss b { font-size:25px; white-space:nowrap; } .loss p { font-size:22px; margin:0; }
    footer { font-size:18px; opacity:.72; }
  `,
)

await renderAsset(
  'controller.png',
  1600,
  500,
  `
    <main class="controller">
      <div>
        <span>THE VELLAN CONFERENCE</span>
        <h1 class="serif">CONFERENCE CLOCK</h1>
      </div>
      <p>Use the floating panel or the scripted buttons above this console.</p>
    </main>`,
  `
    body { padding:18px; background:transparent; }
    .controller { height:100%; padding:48px 60px; border:10px double #b68751; background:linear-gradient(135deg,#23211c,#161512); color:#eee1c4; display:flex; align-items:center; justify-content:space-between; }
    span { font-size:20px; letter-spacing:.24em; font-weight:900; color:#b68751; }
    h1 { font-size:54px; margin:10px 0 0; }
    p { width:470px; font-size:23px; line-height:1.4; text-align:right; opacity:.75; }
  `,
)

await renderAsset(
  'cover.png',
  1024,
  576,
  `
    <main class="cover">
      <div class="eyebrow">A cooperative negotiation game for 2–6 countries</div>
      <h1 class="serif">ON WAR'S END</h1>
      <div class="accord">THE VELLAN ACCORD</div>
      <p>Six rounds. One shared peace. Six different prices for signing it.</p>
    </main>`,
  `
    body { background:radial-gradient(circle at 65% 40%,#455f59,#191815 65%); color:#f1e3c5; padding:55px; }
    .cover { height:100%; border:7px double #b68751; padding:55px; display:grid; align-content:center; gap:18px; background:linear-gradient(90deg,rgba(0,0,0,.42),transparent); }
    h1 { font-size:94px; margin:0; line-height:.95; letter-spacing:.02em; }
    .accord { font-size:27px; letter-spacing:.3em; color:#d3ae6e; font-weight:900; }
    p { font-size:27px; max-width:720px; margin:14px 0 0; }
  `,
)

await browser.close()

let guidCounter = 0xa10000
function guid() {
  const next = guidCounter.toString(16).padStart(6, '0')
  guidCounter += 1
  return next
}

function colorFromHex(hex, alpha = 1) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
    a: alpha,
  }
}

function transform(position, rotation = {}, scale = {}) {
  return {
    posX: position.x ?? 0,
    posY: position.y ?? 1.2,
    posZ: position.z ?? 0,
    rotX: rotation.x ?? 0,
    rotY: rotation.y ?? 0,
    rotZ: rotation.z ?? 0,
    scaleX: scale.x ?? 1,
    scaleY: scale.y ?? 1,
    scaleZ: scale.z ?? 1,
  }
}

function baseObject({
  id = guid(),
  name,
  nickname = '',
  description = '',
  notes = '',
  position = {},
  rotation = {},
  scale = {},
  color = '#b6b6b6',
  locked = false,
  hands = false,
  value = 0,
  tags = [],
  lua = '',
  xml = '',
}) {
  return {
    GUID: id,
    Name: name,
    Transform: transform(position, rotation, scale),
    Nickname: nickname,
    Description: description,
    GMNotes: notes,
    AltLookAngle: { x: 0, y: 0, z: 0 },
    ColorDiffuse: colorFromHex(color),
    Tags: tags,
    LayoutGroupSortIndex: 0,
    Value: value,
    Locked: locked,
    Grid: true,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: hands,
    Hands: hands,
    LuaScript: lua,
    LuaScriptState: '',
    XmlUI: xml,
  }
}

function localToWorld(country, localX, localZ, y = 1.45) {
  const radians = (country.position.rotation * Math.PI) / 180
  return {
    x: country.position.x + localX * Math.cos(radians) + localZ * Math.sin(radians),
    y,
    z: country.position.z - localX * Math.sin(radians) + localZ * Math.cos(radians),
  }
}

function customTile(filename, options, tile = {}) {
  const object = baseObject({ ...options, name: 'Custom_Tile' })
  object.CustomImage = {
    ImageURL: path.join(assetDir, filename),
    ImageSecondaryURL: '',
    ImageScalar: 1,
    WidthScale: 1,
    CustomTile: {
      Type: tile.type ?? 0,
      Thickness: tile.thickness ?? 0.12,
      Stackable: tile.stackable ?? false,
      Stretch: tile.stretch ?? true,
    },
  }
  return object
}

function counter(options, start) {
  const object = baseObject({ ...options, name: 'Counter', value: start })
  object.Counter = { value: start }
  return object
}

function block(options) {
  return baseObject({ ...options, name: 'BlockSquare' })
}

function checker(options, red = false) {
  return baseObject({ ...options, name: red ? 'Checker_red' : 'Checker_white' })
}

function infiniteBag(options, template) {
  const object = baseObject({ ...options, name: 'Infinite_Bag' })
  object.MaterialIndex = -1
  object.MeshIndex = -1
  object.ContainedObjects = [template]
  return object
}

function deck({
  nickname,
  description,
  position,
  rotation,
  scale,
  face,
  back,
  deckKey,
  cards,
  tags = [],
}) {
  const deckId = guid()
  const customDeck = {
    [String(deckKey)]: {
      FaceURL: path.join(assetDir, face),
      BackURL: path.join(assetDir, back),
      NumWidth: cards.width,
      NumHeight: cards.height,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0,
    },
  }
  const contained = cards.items.map((card, index) => {
    const item = baseObject({
      name: 'Card',
      nickname: card.title,
      description: card.description,
      notes: JSON.stringify(card.notes ?? {}),
      position,
      rotation,
      hands: true,
      tags: [...tags, ...(card.tags ?? [])],
    })
    item.CardID = deckKey * 100 + index
    item.SidewaysCard = false
    item.ContainedObjects = []
    return item
  })
  const object = baseObject({
    id: deckId,
    name: 'DeckCustom',
    nickname,
    description,
    position,
    rotation,
    scale,
    hands: true,
    tags,
  })
  object.SidewaysCard = false
  object.DeckIDs = cards.items.map((_, index) => deckKey * 100 + index)
  object.CustomDeck = customDeck
  object.ContainedObjects = contained
  return object
}

function customCard({
  nickname,
  description,
  position,
  rotation,
  scale,
  face,
  back,
  deckKey,
  cardIndex,
  width,
  height,
  tags = [],
  notes = {},
}) {
  const object = baseObject({
    name: 'CardCustom',
    nickname,
    description,
    notes: JSON.stringify(notes),
    position,
    rotation,
    scale,
    hands: true,
    tags,
  })
  object.CardID = deckKey * 100 + cardIndex
  object.SidewaysCard = false
  object.CustomDeck = {
    [String(deckKey)]: {
      FaceURL: path.join(assetDir, face),
      BackURL: path.join(assetDir, back),
      NumWidth: width,
      NumHeight: height,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0,
    },
  }
  return object
}

const objectStates = []
const guids = {}
const policyDecks = {}
const counterStarts = {}

objectStates.push(
  customTile(
    'conference-board.png',
    {
      nickname: "The Vellan Accord — Conference Board",
      description: 'Public Peace, Unrest, Refugee, Round, Trust, crisis, phase, and signature areas.',
      position: { x: 0, y: 1.05, z: 0 },
      scale: { x: 11.25, y: 1, z: 11.25 },
      locked: true,
      tags: ['ConferenceBoard'],
    },
    { type: 0, thickness: 0.08, stackable: false, stretch: true },
  ),
)

for (const country of countries) {
  objectStates.push(
    customTile(
      `mat-${country.id}.png`,
      {
        nickname: `${country.name} Delegation Mat`,
        description: `${country.epithet}. ${country.brief}`,
        notes: JSON.stringify({ country: country.id, seatColor: country.seatColor }),
        position: { x: country.position.x, y: 1.05, z: country.position.z },
        rotation: { y: country.position.rotation },
        scale: { x: 3.2, y: 1, z: 3.2 },
        locked: true,
        tags: ['CountryMat', `Country_${country.id}`],
      },
      { type: 0, thickness: 0.08, stackable: false, stretch: true },
    ),
  )

  const policyDeck = deck({
    nickname: `${country.name} Cabinet Policy Deck`,
    description: 'Shuffle and draw three at the start of each round. Play one, or Conserve Resources.',
    position: localToWorld(country, -4.1, -1.55, 1.55),
    rotation: { y: country.position.rotation + 180, z: 180 },
    scale: { x: 0.82, y: 1, z: 0.82 },
    face: 'policy-sheet.png',
    back: 'policy-back.png',
    deckKey: 100,
    cards: {
      width: 4,
      height: 4,
      items: policies.map((policy) => ({
        title: policy.title,
        description: `${policy.kicker}\n${policy.description}`,
        notes: { type: 'policy', id: policy.id, country: country.id },
        tags: ['PolicyCard', `Policy_${country.id}`],
      })),
    },
    tags: ['PolicyDeck', `Policy_${country.id}`, `Country_${country.id}`],
  })
  policyDecks[country.id] = policyDeck.GUID
  objectStates.push(policyDeck)

  const mandatePosition = localToWorld(country, -0.2, -1.65, 1.5)
  objectStates.push(
    customCard({
      nickname: `${country.name} — Private National Mandate`,
      description: `${country.mandateTitle}\nMANDATE: ${country.mandate}\nRED LINE: ${country.redLine}`,
      position: mandatePosition,
      rotation: { y: country.position.rotation + 180, z: 180 },
      scale: { x: 0.82, y: 1, z: 0.82 },
      face: 'mandate-sheet.png',
      back: 'mandate-back.png',
      deckKey: 300,
      cardIndex: countries.indexOf(country),
      width: 3,
      height: 2,
      tags: ['MandateCard', `Country_${country.id}`],
      notes: { type: 'mandate', country: country.id },
    }),
  )

  const populationCounter = counter(
    {
      nickname: `${country.name} Civilian Population`,
      description: 'Immediate defeat if this reaches 0.',
      position: localToWorld(country, 2.7, -1.45, 1.55),
      rotation: { y: country.position.rotation },
      scale: { x: 0.62, y: 0.62, z: 0.62 },
      color: country.color,
      locked: true,
      tags: ['PopulationCounter', `Country_${country.id}`],
      notes: JSON.stringify({ country: country.id, track: 'population' }),
    },
    country.population,
  )
  const militaryCounter = counter(
    {
      nickname: `${country.name} Military`,
      description: 'Immediate defeat if this reaches 0. Crisis commitments must leave at least 1.',
      position: localToWorld(country, 4.1, -1.45, 1.55),
      rotation: { y: country.position.rotation },
      scale: { x: 0.62, y: 0.62, z: 0.62 },
      color: '#7d554a',
      locked: true,
      tags: ['MilitaryCounter', `Country_${country.id}`],
      notes: JSON.stringify({ country: country.id, track: 'military' }),
    },
    country.military,
  )
  counterStarts[populationCounter.GUID] = country.population
  counterStarts[militaryCounter.GUID] = country.military
  objectStates.push(populationCounter, militaryCounter)

  objectStates.push(
    checker({
      nickname: `${country.name} Signature Seal`,
      description: 'Move this seal to the Vellan Accord only when all four signing locks are open.',
      position: localToWorld(country, 4.25, 1.55, 1.45),
      scale: { x: 0.68, y: 0.68, z: 0.68 },
      color: '#d6ad56',
      tags: ['SignatureSeal', `Country_${country.id}`],
      notes: JSON.stringify({ type: 'signature', country: country.id }),
    }),
    checker(
      {
        nickname: `${country.name} Pressure Marker`,
        description: 'Place on the mat when the red line is crossed. Raise Global Unrest by 1 the first time.',
        position: localToWorld(country, 3.25, 1.55, 1.45),
        scale: { x: 0.58, y: 0.58, z: 0.58 },
        color: '#a94138',
        tags: ['PressureMarker', `Country_${country.id}`],
        notes: JSON.stringify({ type: 'pressure', country: country.id }),
      },
      true,
    ),
  )

  resources.forEach((resource, resourceIndex) => {
    const amount = country.start[resource.id]
    for (let pieceIndex = 0; pieceIndex < amount; pieceIndex += 1) {
      const offset = (pieceIndex - (amount - 1) / 2) * 0.56
      const piece = block({
        nickname: `${resource.label} — ${country.name}`,
        description: `${country.name} ${resource.label} resource cube. Spend and gain exactly as directed by policies, crises, and exchanges.`,
        notes: JSON.stringify({ type: 'resource', resource: resource.id, country: country.id }),
        position: localToWorld(country, -3.75 + resourceIndex * 2.5 + offset, 1.15, 1.55),
        rotation: { y: country.position.rotation },
        scale: { x: 0.38, y: 0.38, z: 0.38 },
        color: resource.color,
        value: 1,
        tags: ['ResourceCube', `Resource_${resource.id}`, `Country_${country.id}`],
      })
      objectStates.push(piece)
    }
  })

  const handPosition =
    country.position.rotation === 0
      ? { x: country.position.x, y: 3.1, z: country.position.z - 7 }
      : { x: country.position.x, y: 3.1, z: country.position.z + 7 }
  const hand = baseObject({
    name: 'HandTrigger',
    nickname: `${country.name} Private Hand`,
    position: handPosition,
    rotation: { y: country.position.rotation },
    scale: { x: 8.2, y: 5, z: 2.3 },
    locked: true,
    tags: ['HandZone', `Country_${country.id}`],
  })
  hand.ColorDiffuse = { ...ttsSeatColors[country.seatColor] }
  hand.FogColor = country.seatColor
  objectStates.push(hand)
}

const crisisDeck = deck({
  nickname: 'Regional Crisis Deck',
  description: 'Shuffle at setup. Reveal one crisis during each round briefing.',
  position: { x: -13.9, y: 1.55, z: 0 },
  rotation: { y: 90, z: 180 },
  scale: { x: 0.9, y: 1, z: 0.9 },
  face: 'crisis-sheet.png',
  back: 'crisis-back.png',
  deckKey: 200,
  cards: {
    width: 3,
    height: 2,
    items: crises.map((crisis) => ({
      title: crisis.title,
      description: `${crisis.location}\n${crisis.briefing}\n\nREQUIREMENT: ${crisis.requirement}\nSUCCESS: ${crisis.success}\nFAILURE: ${crisis.failure}`,
      notes: { type: 'crisis', id: crisis.id },
      tags: ['CrisisCard'],
    })),
  },
  tags: ['CrisisDeck', 'CrisisCard'],
})
guids.crisisDeck = crisisDeck.GUID
objectStates.push(crisisDeck)

for (const [index, resource] of resources.entries()) {
  const template = block({
    nickname: `${resource.label} Supply Cube`,
    description: `Take ${resource.label} cubes when a policy or effect grants them.`,
    notes: JSON.stringify({ type: 'resource', resource: resource.id, country: null }),
    position: { x: -16.7, y: 2.2, z: -5.4 + index * 3.6 },
    scale: { x: 0.38, y: 0.38, z: 0.38 },
    color: resource.color,
    value: 1,
    tags: ['ResourceCube', `Resource_${resource.id}`, 'SupplyPiece'],
  })
  const bag = infiniteBag(
    {
      nickname: `Infinite ${resource.label} Supply`,
      description: `Take cubes when ${resource.label} is gained; return spent cubes here.`,
      position: { x: -16.7, y: 1.3, z: -5.4 + index * 3.6 },
      scale: { x: 0.72, y: 0.72, z: 0.72 },
      color: resource.dark,
      locked: true,
      tags: ['ResourceSupply', `Resource_${resource.id}`],
    },
    template,
  )
  objectStates.push(bag)
}

const peaceCounter = counter(
  {
    nickname: 'Peace Momentum',
    description: 'Starts at 1. A country cannot sign until Peace reaches at least 6.',
    position: { x: -9.7, y: 1.55, z: 3.8 },
    scale: { x: 0.7, y: 0.7, z: 0.7 },
    color: '#567f77',
    locked: true,
    tags: ['GlobalCounter', 'PeaceCounter'],
  },
  1,
)
const unrestCounter = counter(
  {
    nickname: 'Global Unrest',
    description: 'Starts at 3. The table loses immediately at 10.',
    position: { x: -9.7, y: 1.55, z: 2.0 },
    scale: { x: 0.7, y: 0.7, z: 0.7 },
    color: '#a85043',
    locked: true,
    tags: ['GlobalCounter', 'UnrestCounter'],
  },
  3,
)
const refugeeCounter = counter(
  {
    nickname: 'Refugee Pool',
    description: 'Starts at 2 per country. Lose immediately above 5 per country.',
    position: { x: -9.7, y: 1.55, z: 0.2 },
    scale: { x: 0.7, y: 0.7, z: 0.7 },
    color: '#6f7d8c',
    locked: true,
    tags: ['GlobalCounter', 'RefugeeCounter'],
  },
  12,
)
const roundCounter = counter(
  {
    nickname: 'Round',
    description: 'The conference lasts at most six rounds.',
    position: { x: -9.7, y: 1.55, z: -1.6 },
    scale: { x: 0.7, y: 0.7, z: 0.7 },
    color: '#b68751',
    locked: true,
    tags: ['GlobalCounter', 'RoundCounter'],
  },
  1,
)
guids.peaceCounter = peaceCounter.GUID
guids.unrestCounter = unrestCounter.GUID
guids.refugeeCounter = refugeeCounter.GUID
guids.roundCounter = roundCounter.GUID
counterStarts[peaceCounter.GUID] = 1
counterStarts[unrestCounter.GUID] = 3
counterStarts[refugeeCounter.GUID] = 12
counterStarts[roundCounter.GUID] = 1
objectStates.push(peaceCounter, unrestCounter, refugeeCounter, roundCounter)

const trustColumns = [3.9, 5.9, 7.9, 9.9, 11.9]
const trustRows = [-2.4, -0.2, 2.0]
trustPairs.forEach(([first, second], index) => {
  const naturalPartners =
    (first.id === 'aravell' && second.id === 'veyra') ||
    (first.id === 'tomerin' && second.id === 'namarra') ||
    (first.id === 'karsk' && second.id === 'belovar')
  const start = naturalPartners ? 2 : 1
  const trustCounter = counter(
    {
      nickname: `${first.name} ↔ ${second.name} Trust`,
      description: 'Bilateral Trust ranges from 0 Broken to 4 Bound.',
      notes: JSON.stringify({ type: 'trust', countries: [first.id, second.id] }),
      position: {
        x: trustColumns[index % 5],
        y: 1.55,
        z: trustRows[Math.floor(index / 5)],
      },
      scale: { x: 0.52, y: 0.52, z: 0.52 },
      color: first.color,
      locked: true,
      tags: ['TrustCounter', `Country_${first.id}`, `Country_${second.id}`],
    },
    start,
  )
  counterStarts[trustCounter.GUID] = start
  objectStates.push(trustCounter)
})

const turnMarker = baseObject({
  name: 'BlockTriangle',
  nickname: 'Active Delegation Marker',
  description: 'The scripted conference clock moves this marker to the active country.',
  position: localToWorld(countries[0], 0, 3.35, 1.7),
  scale: { x: 0.85, y: 0.85, z: 0.85 },
  color: '#e0b961',
  locked: true,
  tags: ['TurnMarker'],
})
const phaseMarker = block({
  nickname: 'Phase Marker',
  description: 'The scripted conference clock moves this marker across the five phase spaces.',
  position: { x: -6, y: 1.5, z: 5.2 },
  scale: { x: 0.58, y: 0.58, z: 0.58 },
  color: '#e0b961',
  locked: true,
  tags: ['PhaseMarker'],
})
guids.turnMarker = turnMarker.GUID
guids.phaseMarker = phaseMarker.GUID
objectStates.push(turnMarker, phaseMarker)

const controllerLua = await readFile(path.join(sourceDir, 'controller.lua'), 'utf8')
const controller = customTile(
  'controller.png',
  {
    nickname: 'Conference Clock Console',
    description: 'Scripted physical controls for advancing, reversing, and reporting the conference clock.',
    position: { x: 0, y: 1.25, z: -9.6 },
    scale: { x: 1.28, y: 1, z: 1.28 },
    locked: true,
    tags: ['Controller'],
    lua: controllerLua,
  },
  { type: 0, thickness: 0.14, stackable: false, stretch: true },
)
guids.controller = controller.GUID
objectStates.push(controller)

objectStates.push(
  customTile(
    'quick-reference.png',
    {
      nickname: "On War's End Quick Reference",
      description: 'Round cadence, signature locks, and immediate defeat conditions.',
      position: { x: 14.2, y: 1.2, z: 0 },
      rotation: { y: 90 },
      scale: { x: 0.82, y: 1, z: 0.82 },
      locked: true,
      tags: ['QuickReference'],
    },
    { type: 0, thickness: 0.1, stackable: false, stretch: true },
  ),
)

const turnMarkerPositions = Object.fromEntries(
  countries.map((country) => [
    country.id,
    localToWorld(country, 0, 2.55, 1.7),
  ]),
)
const phaseMarkerPositions = {
  briefing: { x: -6, y: 1.5, z: 5.2 },
  cabinet: { x: -3, y: 1.5, z: 5.2 },
  crisis: { x: 0, y: 1.5, z: 5.2 },
  summit: { x: 3, y: 1.5, z: 5.2 },
  aftermath: { x: 6, y: 1.5, z: 5.2 },
  ended: { x: 0, y: 1.5, z: 0 },
}

function toLua(value) {
  if (value === null || value === undefined) return 'nil'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
  if (typeof value === 'string') {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`
  }
  if (Array.isArray(value)) return `{${value.map(toLua).join(',')}}`
  return `{${Object.entries(value)
    .map(([key, item]) => `["${key.replaceAll('"', '\\"')}"]=${toLua(item)}`)
    .join(',')}}`
}

let globalLua = await readFile(path.join(sourceDir, 'global.lua'), 'utf8')
globalLua = globalLua
  .replace('__GUIDS__', toLua(guids))
  .replace('__TURN_MARKER_POSITIONS__', toLua(turnMarkerPositions))
  .replace('__PHASE_MARKER_POSITIONS__', toLua(phaseMarkerPositions))
  .replace('__POLICY_DECKS__', toLua(policyDecks))
  .replace('__COUNTER_STARTS__', toLua(counterStarts))

const globalXml = await readFile(path.join(sourceDir, 'global.xml'), 'utf8')
const completeRules = await readFile(path.join(projectRoot, 'RULES.md'), 'utf8')
const epoch = Math.floor(Date.now() / 1000)
const recursiveObjectStates = (objects) =>
  objects.flatMap((object) => [object, ...recursiveObjectStates(object.ContainedObjects ?? [])])
const componentTagLabels = [
  ...new Set(recursiveObjectStates(objectStates).flatMap((object) => object.Tags ?? [])),
]
  .sort((left, right) => left.localeCompare(right))
  .map((displayed) => ({
    displayed,
    normalized: displayed.toLowerCase().replaceAll(/[^a-z0-9]/g, ''),
  }))
const notebookColors = [
  ['Grey', { r: 0.5, g: 0.5, b: 0.5 }],
  ['Yellow', { r: 0.905, g: 0.898, b: 0.172 }],
  ['Brown', { r: 0.443, g: 0.231, b: 0.09 }],
  ['Red', { r: 0.856, g: 0.1, b: 0.094 }],
  ['Orange', { r: 0.956, g: 0.392, b: 0.113 }],
  ['White', { r: 1, g: 1, b: 1 }],
  ['Green', { r: 0.192, g: 0.701, b: 0.168 }],
  ['Blue', { r: 0.118, g: 0.53, b: 1 }],
  ['Teal', { r: 0.129, g: 0.694, b: 0.607 }],
  ['Purple', { r: 0.627, g: 0.125, b: 0.941 }],
  ['Pink', { r: 0.96, g: 0.439, b: 0.807 }],
  ['Black', { r: 0.25, g: 0.25, b: 0.25 }],
]
const tabStates = Object.fromEntries(
  notebookColors.map(([color, visibleColor], id) => [
    id,
    {
      title: id === 0 ? 'Rules' : color,
      body: id === 0 ? completeRules : '',
      color,
      visibleColor,
      id,
    },
  ]),
)

const save = {
  SaveName: "On War's End v3 — The Vellan Accord",
  EpochTime: epoch,
  Date: new Date().toLocaleString('en-US'),
  VersionNumber: 'v13.3',
  GameMode: "On War's End v3",
  GameType: 'Game',
  GameComplexity: 'Medium Complexity',
  PlayingTime: [60, 120],
  PlayerCounts: [2, 6],
  Tags: ['Board Games', 'Strategy Games', 'Scripting: Automated', 'Scripting', 'English'],
  Gravity: 0.5,
  PlayArea: 0.72,
  Table: 'Table_RPG',
  TableURL: '',
  Sky: 'Sky_Forest',
  SkyURL: '',
  Note: 'A cooperative negotiation game for 2–6 countries. The scripted clock automates chair, turn, phase, and round order; players resolve policies, crises, exchanges, Trust, and signatures with physical components.',
  TabStates: tabStates,
  Grid: {
    Type: 0,
    Lines: false,
    Color: { r: 0, g: 0, b: 0 },
    Opacity: 0.42,
    ThickLines: false,
    Snapping: false,
    Offset: false,
    BothSnapping: false,
    xSize: 1,
    ySize: 1,
    PosOffset: { x: 0, y: 1, z: 0 },
  },
  Lighting: {
    LightIntensity: 0.66,
    LightColor: { r: 1, g: 0.94, b: 0.82 },
    AmbientIntensity: 0.72,
    AmbientType: 0,
    AmbientSkyColor: { r: 0.46, g: 0.43, b: 0.37 },
    AmbientEquatorColor: { r: 0.42, g: 0.39, b: 0.34 },
    AmbientGroundColor: { r: 0.28, g: 0.25, b: 0.22 },
    ReflectionIntensity: 0.55,
    LutIndex: 0,
    LutContribution: 0.42,
    LutURL: '',
  },
  Hands: { Enable: true, DisableUnused: false, Hiding: 0 },
  ComponentTags: {
    labels: componentTagLabels,
  },
  Turns: {
    Enable: false,
    Type: 0,
    TurnOrder: [],
    Reverse: false,
    SkipEmpty: false,
    DisableInteractions: false,
    PassTurns: true,
    TurnColor: '',
  },
  DecalPallet: [],
  LuaScript: globalLua,
  LuaScriptState: '',
  XmlUI: globalXml,
  ObjectStates: objectStates,
}

await writeFile(path.join(distDir, 'TS_Save_1.json'), `${JSON.stringify(save, null, 2)}\n`, 'utf8')
await writeFile(
  path.join(distDir, 'manifest.json'),
  `${JSON.stringify(
    {
      name: save.SaveName,
      generatedAt: new Date().toISOString(),
      assets: [
        'conference-board.png',
        ...countries.map((country) => `mat-${country.id}.png`),
        'policy-sheet.png',
        'policy-back.png',
        'crisis-sheet.png',
        'crisis-back.png',
        'mandate-sheet.png',
        'mandate-back.png',
        'quick-reference.png',
        'controller.png',
        'cover.png',
      ],
      counts: {
        countries: countries.length,
        startingResourceCubes: countries.reduce(
          (sum, country) => sum + Object.values(country.start).reduce((subtotal, amount) => subtotal + amount, 0),
          0,
        ),
        policyCards: policies.length * countries.length,
        crisisCards: crises.length,
        mandateCards: countries.length,
        trustPairs: trustPairs.length,
        topLevelObjects: objectStates.length,
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
)

await writeFile(path.join(distDir, 'TS_Save_1.png'), await readFile(path.join(assetDir, 'cover.png')))

console.log(`Built ${save.SaveName}`)
console.log(`Objects: ${objectStates.length}`)
console.log(`Save: ${path.join(distDir, 'TS_Save_1.json')}`)
