import { access, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countries, crises, policies } from './content.mjs'
import { hostGuide, privateDossier, publicRules } from './notebook.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.join(here, 'src')
const savePath = process.argv[2] ?? path.join(here, 'dist', 'TS_Save_1.json')
const save = JSON.parse(await readFile(savePath, 'utf8'))
const buildSource = await readFile(path.join(here, 'build-mod.mjs'), 'utf8')
const liveTestSource = await readFile(path.join(here, 'live-test.mjs'), 'utf8')
const errors = []
const generatedAssetNames = [
  'conference-board.png',
  ...countries.map((country) => `mat-${country.id}.png`),
  'policy-sheet.png',
  'policy-back.png',
  'crisis-sheet.png',
  'crisis-back.png',
  'mandate-sheet.png',
  'mandate-back.png',
  'red-line-sheet.png',
  'red-line-back.png',
  'quick-reference.png',
  'controller.png',
  'cover.png',
]
let manifest = {}
try {
  manifest = JSON.parse(await readFile(path.join(path.dirname(savePath), 'manifest.json'), 'utf8'))
} catch {
  errors.push('The generated save is missing a readable adjacent manifest.json.')
}

function assert(condition, message) {
  if (!condition) errors.push(message)
}

async function hashFiles(files) {
  const hash = createHash('sha256')
  for (const [label, filename] of files) {
    hash.update(label)
    hash.update('\0')
    hash.update(await readFile(filename))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function hashArtifact(filename) {
  if (!filename) return null
  try {
    return createHash('sha256').update(await readFile(filename)).digest('hex')
  } catch {
    return null
  }
}

function hashArtifactInventory(assetHashes, counts) {
  const orderedInventory = {
    assetSha256: generatedAssetNames.map((filename) => [filename, assetHashes[filename]]),
    counts,
  }
  return createHash('sha256').update(JSON.stringify(orderedInventory)).digest('hex')
}

function parseNotes(object) {
  try {
    return JSON.parse(object?.GMNotes || '{}')
  } catch {
    return {}
  }
}

function hasValidBbcode(value) {
  const stack = []
  for (const match of String(value ?? '').matchAll(/\[([0-9A-F]{6}|b|i|\/b|\/i|-)\]/gi)) {
    const token = match[1].toLowerCase()
    if (/^[0-9a-f]{6}$/.test(token)) {
      stack.push('color')
    } else if (token === 'b' || token === 'i') {
      stack.push(token)
    } else {
      const expected = token === '-' ? 'color' : token.slice(1)
      if (stack.pop() !== expected) return false
    }
  }
  return stack.length === 0
}

function xmlOpeningTagById(id) {
  return save.XmlUI.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? ''
}

function luaBetween(startMarker, endMarker) {
  const start = save.LuaScript.indexOf(startMarker)
  if (start < 0) return ''
  const end = save.LuaScript.indexOf(endMarker, start + startMarker.length)
  return end < 0 ? save.LuaScript.slice(start) : save.LuaScript.slice(start, end)
}

const currentBuildFingerprint = await hashFiles([
  ['build-mod.mjs', path.join(here, 'build-mod.mjs')],
  ['content.mjs', path.join(here, 'content.mjs')],
  ['notebook.mjs', path.join(here, 'notebook.mjs')],
  ['src/global.lua', path.join(sourceDir, 'global.lua')],
  ['src/controller.lua', path.join(sourceDir, 'controller.lua')],
  ['src/global.xml', path.join(sourceDir, 'global.xml')],
])

function allObjects(objects) {
  return objects.flatMap((object) => [object, ...allObjects(object.ContainedObjects ?? [])])
}

const topLevel = save.ObjectStates ?? []
const recursive = allObjects(topLevel)
const expectedTopLevelObjects = 145
const expectedRecursiveObjects = 252
const guids = recursive.map((object) => object.GUID)
const uniqueGuids = new Set(guids)
const usedTags = new Set(recursive.flatMap((object) => object.Tags ?? []))
const declaredTags = new Set((save.ComponentTags?.labels ?? []).map((tag) => tag.displayed))
const ttsSeatColors = {
  Blue: { r: 0.117999978, g: 0.53, b: 1, a: 0 },
  Red: { r: 0.856, g: 0.09999997, b: 0.09399996, a: 0 },
  Green: { r: 0.191999972, g: 0.701, b: 0.167999953, a: 0 },
  Yellow: { r: 0.905, g: 0.898, b: 0.171999961, a: 0 },
  Purple: { r: 0.627, g: 0.124999978, b: 0.941, a: 0 },
  Teal: { r: 0.128999949, g: 0.694, b: 0.606999934, a: 0 },
}

assert(save.SaveName === "On War's End v3 — The Vellan Accord", 'Unexpected save name.')
assert(save.VersionNumber === 'v13.3', 'Unexpected TTS save version.')
assert(
  topLevel.length === expectedTopLevelObjects,
  `Expected exactly ${expectedTopLevelObjects} top-level objects; found ${topLevel.length}.`,
)
assert(save.LuaScriptState === '', 'Generated Global LuaScriptState must begin empty.')
assert(
  recursive.every((object) => (object.LuaScriptState ?? '') === ''),
  'Generated object LuaScriptState must not persist player identity, pending grants, or transient clock gates.',
)
assert(
  recursive.length === expectedRecursiveObjects,
  `Expected exactly ${expectedRecursiveObjects} recursive objects; found ${recursive.length}.`,
)
assert(save.Lighting?.LightIntensity === 0.66, 'Directional table lighting is not production-calibrated.')
assert(save.Lighting?.AmbientIntensity === 0.72, 'Ambient table lighting is not production-calibrated.')
assert(save.Lighting?.ReflectionIntensity === 0.55, 'Table reflections are not production-calibrated.')
assert(save.Lighting?.LutContribution === 0.42, 'Table color grading is not production-calibrated.')
assert(Object.keys(save.TabStates ?? {}).length === 12, 'Expected all twelve TTS notebook tabs.')
assert(
  save.Turns?.Enable === false && save.Turns?.Type === 0 && save.Turns?.TurnOrder?.length === 0,
  'The serialized turn system must use TTS safe disabled defaults.',
)
assert(typeof save.LuaScript === 'string' && save.LuaScript.length > 5000, 'Global Lua script is missing or too short.')
assert(
  save.LuaScript.includes(
    'reload the untouched original save; this discards unsaved physical changes',
  ),
  'Runtime reset guidance must name the untouched original and warn that reload discards unsaved physical changes.',
)
assert(
  save.LuaScript.includes(
    "Choose the active roster, sit in matching color seats, take only the active delegations' private cards, then enter dispatch and open the conference.",
  ),
  'Runtime setup guidance does not use the canonical roster, seating, secrets, dispatch, open sequence.',
)
assert(
  !save.LuaScript.includes('Start first') && !save.LuaScript.includes('Start conference'),
  'Generated runtime still contains a stale setup action label.',
)
assert(typeof save.XmlUI === 'string' && save.XmlUI.includes('clockPanel'), 'Global conference-clock UI is missing.')
assert(guids.length === uniqueGuids.size, `Duplicate GUIDs found (${guids.length - uniqueGuids.size}).`)
assert([...usedTags].every((tag) => declaredTags.has(tag)), 'One or more object tags are missing from ComponentTags.')
assert(
  (save.ComponentTags?.labels ?? []).every(
    ({ displayed, normalized }) =>
      normalized === displayed.toLowerCase().replaceAll(/[^a-z0-9]/g, ''),
  ),
  'One or more component-tag normalizations are invalid.',
)
assert(!save.LuaScript.includes('__GUIDS__'), 'Unexpanded Global Lua placeholders remain.')

const notebookTabs = Object.values(save.TabStates ?? {})
const tabByColor = (color) => notebookTabs.find((tab) => tab.color === color)
const publicTab = tabByColor('Grey')
const hostTab = tabByColor('White')
const privateSecrets = countries.flatMap((country) => [country.mandateTitle, country.mandate, country.redLine])
assert(publicTab?.title === 'TTS Rules', 'The public Notebook tab must be titled TTS Rules.')
assert(
  publicTab?.body === publicRules,
  'The public Notebook tab does not exactly match the TTS-specific rules.',
)
assert(
  !privateSecrets.some((secret) => publicTab?.body?.includes(secret)),
  'The public Notebook tab leaks a private mandate or red line.',
)
assert(
  publicTab?.body?.includes('CONFIRM MANUAL HOTSEAT') &&
    publicTab.body.includes('native End Turn disabled') &&
    publicTab.body.includes('Distinct people may preserve private hands only by passing control before each viewing') &&
    publicTab.body.includes('one operator controlling multiple delegations is necessarily open information'),
  'The public Notebook does not state the exact Manual Hotseat, native-turn, and open-information boundary.',
)
assert(
  publicTab?.body?.includes("that card's owner moves only its own National Mandate card out of its private hand") &&
    publicTab.body.includes('printed MANDATE REVEAL space') &&
    publicTab.body.includes('Red Line card and private dossier remain private'),
  'The public Notebook does not unambiguously keep red lines private after a mandate reveal.',
)
assert(
  !publicTab?.body?.includes('Solo Envoy') &&
    !publicTab?.body?.includes('# On War') &&
    !publicTab?.body?.includes('## '),
  'The public Notebook tab still contains browser-only or raw Markdown rules.',
)
assert(
  hostTab?.title === 'Host Guide' && hostTab.body === hostGuide,
  'The White Notebook tab does not exactly match the host guide.',
)
assert(
  !privateSecrets.some((secret) => hostTab?.body?.includes(secret)),
  'The host guide leaks a private mandate or red line.',
)
assert(
  hostTab?.body?.includes('Exact active seats open Native Turns immediately') &&
    hostTab.body.includes('native End Turn stays off') &&
    hostTab.body.includes('one operator controlling multiple countries is an open-information rehearsal'),
  'The host guide does not state the exact native/manual seating contract.',
)

for (const country of countries) {
  const tab = tabByColor(country.seatColor)
  const otherSecrets = countries
    .filter((other) => other.id !== country.id)
    .flatMap((other) => [other.mandateTitle, other.mandate, other.redLine])
  assert(tab?.title === `${country.name} — Private`, `${country.name} is missing its private Notebook tab.`)
  assert(
    tab?.body === privateDossier(country),
    `${country.name}'s private Notebook tab does not exactly match its dossier.`,
  )
  assert(
    !otherSecrets.some((secret) => tab?.body?.includes(secret)),
    `${country.name}'s private Notebook tab leaks another delegation's secret.`,
  )
}
for (const color of ['Brown', 'Orange', 'Pink', 'Black']) {
  assert(tabByColor(color)?.body === '', `${color} Notebook tab must remain empty.`)
}
for (const tab of notebookTabs) {
  assert(hasValidBbcode(tab.body), `${tab.color} Notebook tab has invalid or misnested BBCode formatting.`)
}

const topByName = (name) => topLevel.filter((object) => object.Name === name)
const withTag = (tag) => recursive.filter((object) => object.Tags?.includes(tag))
const topWithTag = (tag) => topLevel.filter((object) => object.Tags?.includes(tag))

assert(topWithTag('CountryMat').length === countries.length, 'Expected six country mats.')
assert(topWithTag('PolicyDeck').length === countries.length, 'Expected six Cabinet policy decks.')
assert(
  countries.every((country) => {
    const hand = topWithTag(`Country_${country.id}`).find((object) => object.Name === 'HandTrigger')
    return (
      hand?.FogColor === country.seatColor &&
      JSON.stringify(hand?.ColorDiffuse) === JSON.stringify(ttsSeatColors[country.seatColor])
    )
  }),
  'Every private hand zone must use its exact TTS seat color and remain transparent.',
)
assert(withTag('PolicyCard').length === policies.length * countries.length, 'Expected 96 contained policy cards.')
assert(withTag('CrisisCard').length === crises.length + 1, 'Expected six crisis cards plus the tagged crisis deck.')
assert(withTag('MandateCard').length === countries.length, 'Expected six private mandate cards.')
assert(withTag('RedLineCard').length === countries.length, 'Expected six separate private red-line cards.')
assert(topWithTag('ResourceCube').length === 61, 'Expected 61 starting resource cubes.')
assert(topWithTag('ResourceSupply').length === 4, 'Expected four infinite resource supply bags.')
assert(topWithTag('MilitarySupply').length === 1, 'Expected one infinite Military commitment-proxy supply.')
assert(withTag('MilitaryCommitment').length === 1, 'Expected one contained Military commitment-proxy template.')
assert(topWithTag('TrustCounter').length === 15, 'Expected all 15 bilateral Trust counters.')
assert(topWithTag('SignatureSeal').length === countries.length, 'Expected six signature seals.')
assert(topWithTag('PressureMarker').length === countries.length, 'Expected six pressure markers.')
assert(topWithTag('PopulationCounter').length === countries.length, 'Expected six Population counters.')
assert(topWithTag('MilitaryCounter').length === countries.length, 'Expected six Military counters.')
assert(topWithTag('HandZone').length === countries.length, 'Expected six private hand zones.')
assert(
  withTag('ResourceCube').every(
    (object) => object.Hands === true && object.Tags?.includes('HandEligible'),
  ) &&
    withTag('MilitaryCommitment').every(
      (object) => object.Hands === true && object.Tags?.includes('HandEligible'),
    ),
  'Every starting/supply resource cube and Military proxy must be eligible for concealed hand use.',
)
assert(
  topWithTag('HandZone').every((object) => object.Tags?.includes('HandEligible')),
  'Every private hand zone must accept shared HandEligible commitment pieces.',
)
assert(topWithTag('Controller').length === 1, 'Expected one physical conference console.')
assert(topWithTag('TurnMarker').length === 1, 'Expected one active delegation marker.')
assert(topWithTag('PhaseMarker').length === 1, 'Expected one phase marker.')
assert(topByName('Custom_Board').length === 0, 'Framed custom boards reintroduce oversized colliders.')

const requiredPolicyText = {
  'demobilize-brigade': 'Lose 1 Military, gain 1 Population, and gain 1 Peace.',
  'relief-corridor': "Spend 1 Food and 1 Capital. Move up to 2 Refugees into this country's Population: reduce Refugees and gain equal Population. Gain 1 Peace.",
  'state-visit': 'Spend 1 Capital. Choose another active country: build 2 Trust with it, reveal its mandate, and gain 1 Peace.',
  'medical-mission': 'Spend 1 Food. Another active country gains 1 Population; build 2 Trust with that country and gain 1 Peace.',
}
for (const [policyId, expectedText] of Object.entries(requiredPolicyText)) {
  const policy = policies.find((candidate) => candidate.id === policyId)
  assert(policy?.description === expectedText, `${policyId} does not state its complete canonical effect.`)
  const generatedCards = withTag('PolicyCard').filter(
    (card) => JSON.parse(card.GMNotes || '{}').id === policyId,
  )
  assert(generatedCards.length === countries.length, `${policyId} is missing from one or more country decks.`)
  assert(
    generatedCards.every((card) => card.Description?.includes(expectedText)),
    `${policyId} generated card text is stale.`,
  )
}

const conferenceBoard = topWithTag('ConferenceBoard')[0]
const conferenceBoardNotes = parseNotes(conferenceBoard)
const conferenceBoardHash = await hashArtifact(conferenceBoard?.CustomImage?.ImageURL)
assert(conferenceBoard?.Name === 'Custom_Tile', 'The conference surface must use a low-profile custom tile.')
assert(
  conferenceBoardNotes.buildFingerprint === currentBuildFingerprint,
  'The generated conference board/save is stale relative to its source templates.',
)
assert(
  conferenceBoardHash !== null && conferenceBoardNotes.assetSha256 === conferenceBoardHash,
  'The conference board image does not match the generated save artifact hash.',
)
assert(
  buildSource.includes('SEALED → REVEAL') &&
    buildSource.includes('PUBLIC PROPOSALS · CLEAR IN AFTERMATH') &&
    buildSource.includes('<i>GIVE</i>') &&
    buildSource.includes('<i>WANT</i>') &&
    buildSource.includes('min-height:76px') &&
    buildSource.includes('min-height:96px') &&
    buildSource.includes('height:68px'),
  'The fingerprinted conference board source is missing a required workflow label or lane size.',
)
assert(
  conferenceBoard?.Transform?.scaleX === 11.25 && conferenceBoard?.Transform?.scaleZ === 11.25,
  'The conference surface is not calibrated to the compact table layout.',
)

for (const country of countries) {
  const countryTag = `Country_${country.id}`
  const countryMat = topWithTag('CountryMat').find((object) => object.Tags?.includes(countryTag))
  const policyDeck = topLevel.find(
    (object) => object.Tags?.includes('PolicyDeck') && object.Tags?.includes(countryTag),
  )
  assert(policyDeck?.ContainedObjects?.length === policies.length, `${country.name} policy deck is incomplete.`)
  assert(policyDeck?.DeckIDs?.length === policies.length, `${country.name} policy DeckIDs are incomplete.`)
  assert(
    policyDeck?.Description ===
      'A fresh hand of three is dealt when Cabinet opens each round. Play one, or Conserve Resources.',
    `${country.name} policy deck gives stale or ambiguous deal-timing guidance.`,
  )
  for (const policy of policies) {
    const generatedPolicy = policyDeck?.ContainedObjects?.find(
      (card) => parseNotes(card).id === policy.id,
    )
    const policyNotes = parseNotes(generatedPolicy)
    assert(
      generatedPolicy?.Nickname === policy.title &&
        generatedPolicy.Description === `${policy.kicker}\n${policy.description}` &&
        policyNotes.type === 'policy' &&
        policyNotes.id === policy.id &&
        policyNotes.country === country.id &&
        generatedPolicy.Tags?.includes('PolicyCard') &&
        generatedPolicy.Tags?.includes(countryTag),
      `${country.name}'s ${policy.title} card metadata or executable text is incomplete.`,
    )
  }

  const mandate = topLevel.find(
    (object) => object.Tags?.includes('MandateCard') && object.Tags?.includes(countryTag),
  )
  const redLine = topLevel.find(
    (object) => object.Tags?.includes('RedLineCard') && object.Tags?.includes(countryTag),
  )
  const mandateDeckState = Object.values(mandate?.CustomDeck ?? {})[0]
  const redLineNotes = parseNotes(redLine)
  const redLineDeckState = Object.values(redLine?.CustomDeck ?? {})[0]
  const redLineFaceHash = await hashArtifact(redLineDeckState?.FaceURL)
  const redLineBackHash = await hashArtifact(redLineDeckState?.BackURL)
  const handZone = topLevel.find(
    (object) => object.Tags?.includes('HandZone') && object.Tags?.includes(countryTag),
  )
  const signatureSeal = topLevel.find(
    (object) => object.Tags?.includes('SignatureSeal') && object.Tags?.includes(countryTag),
  )
  const pressureMarker = topLevel.find(
    (object) => object.Tags?.includes('PressureMarker') && object.Tags?.includes(countryTag),
  )
  assert(
    mandate?.Description?.includes(country.mandate) &&
      !mandate.Description.includes(country.redLine),
    `${country.name}'s mandate card must reveal the mandate without its red line.`,
  )
  assert(
    mandate?.Hands === true &&
      mandate.HideWhenFaceDown === true &&
      mandate.Transform?.rotZ === 180 &&
      mandateDeckState?.BackIsHidden === true &&
      path.basename(mandateDeckState?.FaceURL ?? '') === 'mandate-sheet.png' &&
      path.basename(mandateDeckState?.BackURL ?? '') === 'mandate-back.png',
    `${country.name}'s mandate card is not concealed, face-down, or paired to the correct art.`,
  )
  assert(
    redLine?.Description?.includes(country.redLine) &&
      !redLine.Description.includes(country.mandate),
    `${country.name}'s red-line card must remain a separate private component.`,
  )
  assert(
    redLine?.Hands === true &&
      redLine.HideWhenFaceDown === true &&
      redLine.Transform?.rotZ === 180 &&
      redLineDeckState?.BackIsHidden === true &&
      path.basename(redLineDeckState?.FaceURL ?? '') === 'red-line-sheet.png' &&
      path.basename(redLineDeckState?.BackURL ?? '') === 'red-line-back.png',
    `${country.name}'s red-line card is not concealed, face-down, or paired to the correct art.`,
  )
  assert(
    redLineNotes.buildFingerprint === currentBuildFingerprint &&
      redLineFaceHash !== null &&
      redLineNotes.faceSha256 === redLineFaceHash &&
      redLineBackHash !== null &&
      redLineNotes.backSha256 === redLineBackHash,
    `${country.name}'s red-line card art is stale or does not match its generated artifact hash.`,
  )
  assert(
    signatureSeal?.Description?.includes('Pressure is cleared') &&
      signatureSeal.Description.includes('gain 1 Peace'),
    `${country.name}'s signature seal omits a signing lock or Peace reward.`,
  )
  assert(
    pressureMarker?.Description?.includes('safe to unsafe') &&
      pressureMarker.Description.includes('each later safe-to-unsafe recrossing'),
    `${country.name}'s Pressure marker omits safe-to-unsafe recrossing behavior.`,
  )
  assert(countryMat?.Name === 'Custom_Tile', `${country.name} mat must use a low-profile custom tile.`)
  assert(
    countryMat?.Transform?.posX === country.position.x &&
      countryMat?.Transform?.posZ === country.position.z &&
      countryMat?.Transform?.scaleX === 3.2 &&
      countryMat?.Transform?.scaleZ === 3.2,
    `${country.name} mat is not calibrated to the compact delegation row.`,
  )
  const boardGap = Math.abs(country.position.z) - 11.25 - 3.2
  assert(boardGap >= 0.5, `${country.name} mat overlaps the central conference surface.`)
  for (const component of [policyDeck, mandate, redLine]) {
    if (!component?.Transform || !handZone?.Transform) continue
    const distance = Math.hypot(
      component.Transform.posX - handZone.Transform.posX,
      component.Transform.posZ - handZone.Transform.posZ,
    )
    assert(
      distance >= 5,
      `${country.name} private hand zone overlaps ${component.Nickname ?? component.Name}.`,
    )
  }
}

for (const rowZ of [-15, 15]) {
  const row = countries.filter((country) => country.position.z === rowZ).sort((left, right) => left.position.x - right.position.x)
  for (let index = 1; index < row.length; index += 1) {
    const horizontalGap = row[index].position.x - row[index - 1].position.x - 2 * 3.2 * (16 / 9)
    assert(horizontalGap >= 0.5, `${row[index - 1].name} and ${row[index].name} mats overlap.`)
  }
}

const customAssetUrls = recursive.flatMap((object) => {
  const urls = []
  if (object.CustomImage?.ImageURL) urls.push(object.CustomImage.ImageURL)
  for (const deckState of Object.values(object.CustomDeck ?? {})) {
    if (deckState.FaceURL) urls.push(deckState.FaceURL)
    if (deckState.BackURL) urls.push(deckState.BackURL)
  }
  return urls
})

const uniqueAssetUrls = new Set(customAssetUrls)
assert(uniqueAssetUrls.size === 17, 'Expected 17 unique save-referenced local asset URLs.')
assert(manifest.name === save.SaveName, 'The generated manifest names a different save.')
assert(
  manifest.buildFingerprint === currentBuildFingerprint,
  'The generated manifest is stale relative to the current source fingerprint.',
)
assert(
  manifest.counts?.topLevelObjects === expectedTopLevelObjects &&
    manifest.counts?.recursiveObjects === expectedRecursiveObjects &&
    manifest.counts.topLevelObjects === topLevel.length &&
    manifest.counts.recursiveObjects === recursive.length,
  'The generated manifest/save must agree on the exact 145 top-level and 252 recursive object counts.',
)
assert(
  JSON.stringify(manifest.assets) === JSON.stringify(generatedAssetNames) &&
    Object.keys(manifest.assetSha256 ?? {}).length === generatedAssetNames.length,
  'The generated manifest must inventory exactly 18 generated PNG assets and digests.',
)
const actualAssetSha256 = Object.fromEntries(
  await Promise.all(
    generatedAssetNames.map(async (filename) => [
      filename,
      await hashArtifact(path.join(here, 'assets', filename)),
    ]),
  ),
)
for (const filename of generatedAssetNames) {
  const expectedHash = manifest.assetSha256?.[filename]
  const actualHash = actualAssetSha256[filename]
  assert(
    typeof expectedHash === 'string' &&
      /^[a-f0-9]{64}$/.test(expectedHash) &&
      actualHash !== null &&
      expectedHash === actualHash,
    `Generated asset digest mismatch: ${filename}`,
  )
}
const actualArtifactFingerprint = hashArtifactInventory(actualAssetSha256, {
  topLevelObjects: topLevel.length,
  recursiveObjects: recursive.length,
})
assert(
  /^[a-f0-9]{64}$/.test(manifest.artifactFingerprint ?? '') &&
    manifest.artifactFingerprint === actualArtifactFingerprint &&
    conferenceBoardNotes.artifactFingerprint === actualArtifactFingerprint,
  'The manifest and generated save do not bind the exact ordered asset hashes and object counts.',
)
const previewHash = await hashArtifact(path.join(path.dirname(savePath), 'TS_Save_1.png'))
assert(
  previewHash !== null && previewHash === manifest.assetSha256?.['cover.png'],
  'The generated TTS save preview does not match cover.png.',
)

for (const localPath of uniqueAssetUrls) {
  assert(path.isAbsolute(localPath), `Asset path is not absolute: ${localPath}`)
  assert(!localPath.startsWith('file:'), `File URI found where TTS requires a local path: ${localPath}`)
  if (path.isAbsolute(localPath)) {
    try {
      await access(localPath)
      const filename = path.basename(localPath)
      const referencedHash = await hashArtifact(localPath)
      assert(
        referencedHash !== null && referencedHash === manifest.assetSha256?.[filename],
        `Save-referenced asset does not match its manifest digest: ${localPath}`,
      )
    } catch {
      errors.push(`Missing local asset: ${localPath}`)
    }
  }
}

const requiredLuaFragments = [
  'function onLoad',
  'function onSave',
  'function onChat',
  'function advanceClock',
  'function stepBack',
  'function hotkeyNext',
  'function onPlayerTurn',
  'TURN_MODE_NATIVE = "native"',
  'TURN_MODE_MANUAL = "manual"',
  'function classifySeats',
  'function auditSeats',
  'function spectatorPlayers',
  'function playerAtColor',
  'function nativeSeatRecoveryOpportunity',
  'function disarmManualOpen',
  'function disarmSeatRecovery',
  'function armSeatRecovery',
  'function restoreNativeSeat',
  'function commitConferenceStart',
  'function nativeTurnsAllowed',
  'function beginTurnsSync',
  'function finishTurnsSync',
  'function disableTurnsSafely',
  'function handleUnexpectedNativeTurn',
  'CONFIRM MANUAL HOTSEAT',
  'CONFIRM ASSIGN',
  'One operator controlling multiple countries is open information',
  'addHotkey("On War\'s End: next", hotkeyNext, false)',
  'addHotkey("On War\'s End: back", hotkeyBack, false)',
  'addHotkey("On War\'s End: status", hotkeyStatus, false)',
  'Turns.order',
  'Turns.turn_color',
  'function dealPolicyHands',
  'function finishConference',
  'function uiTogglePanel',
  'function frameOverview',
  'function frameSetupHost',
]
for (const fragment of requiredLuaFragments) {
  assert(save.LuaScript.includes(fragment), `Global Lua is missing ${fragment}.`)
}
assert(
  !save.LuaScript.includes('function startConference('),
  'A zero-argument conference-start path can bypass the required seat-mode decision.',
)
assert(
  (save.LuaScript.match(/Turns\.enable = true/g) ?? []).length === 1,
  'Runtime Turns may be enabled only once, behind the exact-seat native-mode gate.',
)
assert(
  !save.LuaScript.includes('Turns.skip_empty_hands = true'),
  'Native turn safety must not confuse empty hands with empty seats.',
)
const updateTurnsLua = luaBetween('function updateTurns()', 'function handleUnexpectedNativeTurn()')
const disableTurnsLua = luaBetween('function disableTurnsSafely()', 'function updateTurns()')
const disableTurnsIndex = updateTurnsLua.indexOf('Turns.enable = false')
const clearOrderIndex = updateTurnsLua.indexOf('Turns.order = {}')
const finalDisableTurnsIndex = updateTurnsLua.lastIndexOf('Turns.enable = false')
const nativeGateIndex = updateTurnsLua.indexOf('if nativeTurnsAllowed()')
const enableTurnsIndex = updateTurnsLua.indexOf('Turns.enable = true')
assert(
  disableTurnsIndex >= 0 &&
    clearOrderIndex > disableTurnsIndex &&
    finalDisableTurnsIndex > clearOrderIndex &&
    nativeGateIndex > clearOrderIndex &&
    nativeGateIndex > finalDisableTurnsIndex &&
    enableTurnsIndex > nativeGateIndex,
  'updateTurns must disable and clear native Turns before the exact-seat native-mode gate can re-enable it.',
)
assert(
  disableTurnsLua.indexOf('beginTurnsSync()') >= 0 &&
    disableTurnsLua.indexOf('Turns.enable = false') > disableTurnsLua.indexOf('beginTurnsSync()') &&
    disableTurnsLua.indexOf('Turns.order = {}') > disableTurnsLua.indexOf('Turns.enable = false') &&
    disableTurnsLua.indexOf('finishTurnsSync(generation)') > disableTurnsLua.indexOf('Turns.order = {}'),
  'Idempotent native-turn shutdown must guard every mutation for the complete synchronization window.',
)
const turnsMutationRemainder = save.LuaScript
  .replace(disableTurnsLua, '')
  .replace(updateTurnsLua, '')
assert(
  !/Turns\.(?:enable|order)\s*=/.test(turnsMutationRemainder),
  'Turns enable/order mutations must be centralized in disableTurnsSafely or updateTurns.',
)
const playerTurnLua = luaBetween('function onPlayerTurn(', 'function updateController()')
const currentPlayerNoopIndex = playerTurnLua.indexOf(
  'if player.color == current_color then return end',
)
const missingPreviousIndex = playerTurnLua.indexOf('if not previous_player then')
const expectedNextIndex = playerTurnLua.indexOf('local expected_next =')
assert(
  currentPlayerNoopIndex >= 0 &&
    currentPlayerNoopIndex < missingPreviousIndex &&
    currentPlayerNoopIndex < expectedNextIndex &&
    missingPreviousIndex >= 0 &&
    expectedNextIndex >= 0 &&
    playerTurnLua.includes('previous_player.color ~= current_color') &&
    playerTurnLua.includes('if not nativeTurnsAllowed()') &&
    playerTurnLua.includes('nativeTurnFaultSignature == clockTurnSignature()') &&
    playerTurnLua.includes('handleUnexpectedNativeTurn()') &&
    playerTurnLua.includes('advanceClock()') &&
    !playerTurnLua.includes('state.turnIndex = state.turnIndex + 1'),
  'onPlayerTurn does not distinguish current-seat announcements, expected transitions, ineligible states, and unexpected native events.',
)
const nativeAllowedLua = luaBetween('function nativeTurnsAllowed()', 'function clockTurnSignature()')
const unexpectedTurnLua = luaBetween('function handleUnexpectedNativeTurn()', 'function onPlayerTurn(')
assert(
  nativeAllowedLua.includes('nativeTurnFaultSignature == clockTurnSignature()') &&
    nativeAllowedLua.includes(
      'seatRefreshPending or seatRecoveryPending or nativeSeatResumeRequired or nativeResumeSettling',
    ) &&
    unexpectedTurnLua.includes('disableTurnsSafely()') &&
    unexpectedTurnLua.indexOf('nativeTurnFaultSignature == signature') <
      unexpectedTurnLua.indexOf('nativeTurnResyncSignature ~= signature') &&
    (unexpectedTurnLua.match(/Native End Turn paused after an unexpected turn event/g) ?? []).length === 1,
  'Native fault handling must latch fail-closed, reject queued events, and broadcast only once per clock state.',
)
const seatRefreshLua = luaBetween('function scheduleSeatRefresh()', 'function onPlayerChangeColor(')
const seatAuditRecorderLua = luaBetween('function recordSeatAudit(', 'function scheduleSeatRefresh(')
assert(
  seatRefreshLua.indexOf('disableTurnsSafely()') >= 0 &&
    seatRefreshLua.indexOf('disableTurnsSafely()') < seatRefreshLua.indexOf('Wait.frames(') &&
    seatRefreshLua.indexOf('disarmSeatRecovery()') < seatRefreshLua.indexOf('Wait.frames(') &&
    seatRefreshLua.includes('nativeSeatResumeRequired = true') &&
    seatRefreshLua.indexOf('nativeSeatResumeRequired = true') <
      seatRefreshLua.indexOf('seatRefreshPending = true') &&
    seatRefreshLua.indexOf('disableTurnsSafely()') <
      seatRefreshLua.indexOf('seatRefreshPending = true') &&
    (seatRefreshLua.match(/recordSeatAudit\(auditSeats\(\)\)/g) ?? []).length === 2 &&
    (seatRefreshLua.match(/recordSeatAudit\(settled_audit\)/g) ?? []).length === 1 &&
    seatAuditRecorderLua.includes('previous_exact_active == false and audit.exactActiveSeats') &&
    seatAuditRecorderLua.includes('nativeTurnFaultSignature = nil') &&
    seatAuditRecorderLua.includes('nativeSeatResumeRequired = true') &&
    seatAuditRecorderLua.includes('state.turnMode == TURN_MODE_NATIVE') &&
    !seatAuditRecorderLua.includes('nativeSeatResumeRequired = false') &&
    !seatRefreshLua.includes('clearNativeTurnSafety()'),
  'Every running-Native seat event must synchronously disable Turns and latch Resume before any stale or coalesced audit.',
)
const seatRecoveryIdentityLua = luaBetween(
  'function nativeSeatRecoveryIdentity(',
  'function seatColorAvailable(',
)
const seatRecoveryContextLua = luaBetween(
  'function nativeSeatRecoveryContext(',
  'function seatItemList(',
)
const seatBlockInstructionLua = luaBetween(
  'function seatBlockInstruction(',
  'function disarmManualOpen(',
)
const nativeSeatResumeMessageLua = luaBetween(
  'function nativeSeatResumeMessage(',
  'function nativeResumeSettlingMessage(',
)
const seatRecoveryOpportunityLua = luaBetween(
  'function nativeSeatRecoveryOpportunity(',
  'function seatItemList(',
)
const seatRecoveryLua = luaBetween('function disarmSeatRecovery()', 'function turnModeLabel()')
const uiAdvanceLua = luaBetween('function uiAdvance(', 'function uiBack(')
assert(
  seatRecoveryIdentityLua.includes('player and player.steam_id') &&
    seatRecoveryIdentityLua.includes('player and player.steam_name') &&
    seatRecoveryIdentityLua.includes(
      'steam_id == "" or sanitizePlayerLabel(steam_name) == ""',
    ) &&
    seatRecoveryIdentityLua.includes('tostring(#steam_id)') &&
    seatRecoveryIdentityLua.includes('tostring(#steam_name)') &&
    seatRecoveryContextLua.includes('state.turnMode ~= TURN_MODE_NATIVE') &&
    seatRecoveryOpportunityLua.includes(
      'seatRefreshPending or seatRecoveryPending or nativeResumeSettling',
    ) &&
    !seatRecoveryOpportunityLua.includes('nativeSeatResumeRequired') &&
    seatRecoveryContextLua.includes('#audit.occupiedInactive > 0') &&
    seatRecoveryContextLua.includes('#audit.missingActive ~= 1') &&
    seatRecoveryContextLua.includes('#spectators ~= 1') &&
    seatRecoveryContextLua.includes('seatColorAvailable(missing.color)') &&
    seatRecoveryContextLua.includes('clockTurnSignature()') &&
    seatRecoveryContextLua.includes('seatRefreshGeneration') &&
    seatRecoveryContextLua.includes('nativeSeatRecoveryIdentity(spectator)') &&
    seatRecoveryContextLua.includes('if not identity then return nil end') &&
    seatRecoveryContextLua.includes('return nativeSeatRecoveryContext(audit)'),
  'Native seat assignment must fail closed unless one missing active seat, one visibly named Grey spectator with a stable account identity, and the exact target color are freshly available.',
)
assert(
  seatBlockInstructionLua.includes(
    'ASSIGN needs one named Grey with a Steam account.',
  ) &&
    seatBlockInstructionLua.includes('Use TTS Change Color') &&
    nativeSeatResumeMessageLua.includes('Exact seating restored.') &&
    nativeSeatResumeMessageLua.includes('RESUME NATIVE TURNS') &&
    nativeSeatResumeMessageLua.includes('The clock stays fixed; native End Turn remains paused.'),
  'Ineligible seat recovery and exact-seat Resume must provide concise, actionable, non-clipping TTS guidance.',
)
const liveSnapshotSource = liveTestSource.slice(
  liveTestSource.indexOf('function snapshotScript('),
  liveTestSource.indexOf('async function snapshot('),
)
assert(
  liveSnapshotSource.includes(
    'seatRecoveryArmedSignature = seatRecoveryArmedSignature and "armed" or nil',
  ) &&
    liveSnapshotSource.includes('seatRecoveryPending = seatRecoveryPending and {') &&
    !liveSnapshotSource.includes(
      'seatRecoveryArmedSignature = seatRecoveryArmedSignature,',
    ) &&
    !liveSnapshotSource.includes('contextSignature = seatRecoveryPending.contextSignature') &&
    !liveSnapshotSource.includes('playerName = seatRecoveryPending.playerName'),
  'Diagnostic live snapshots must redact transient private-seat identity tuples and recipient names.',
)
assert(
  seatRecoveryLua.includes('SEAT_RECOVERY_CONFIRM_SECONDS') &&
    seatRecoveryLua.includes('SEAT_RECOVERY_SETTLE_SECONDS') &&
    seatRecoveryLua.includes('seatRecoveryArmedSignature == recovery.signature') &&
    seatRecoveryLua.includes('not player or not isHostOrPromoted(player)') &&
    seatRecoveryLua.includes('nativeSeatRecoveryOpportunity(auditSeats())') &&
    seatRecoveryLua.includes('pcall(function()') &&
    seatRecoveryLua.includes('recovery.player.changeColor(recovery.missing.color)') &&
    seatRecoveryLua.includes('function broadcastSeatRecoveryOutcome(') &&
    seatRecoveryLua.includes('local recipient = playerAtColor(preferred_color)') &&
    seatRecoveryLua.includes('if recipient and recipient.seated then') &&
    seatRecoveryLua.includes('delivered = pcall(function()') &&
    seatRecoveryLua.includes('if not delivered then') &&
    seatRecoveryLua.includes('broadcastSeatRecoveryOutcome(message, recovery.missing.color') &&
    seatRecoveryLua.includes('broadcastToAll("[On War\'s End] " .. message, tint)') &&
    seatRecoveryLua.includes('scheduleSeatRefresh()') &&
    seatRecoveryLua.includes('beginSeatRecoveryPending(recovery)') &&
    seatRecoveryLua.includes('clearSeatRecoveryPending()') &&
    seatRefreshLua.includes('nativeSeatRecoveryContext(settled_audit)') &&
    seatRefreshLua.includes('missing_changed or not recovery or') &&
    (save.LuaScript.match(/Player\.getSpectators\(\)/g) ?? []).length === 1 &&
    (save.LuaScript.match(/Player\.getAvailableColors\(\)/g) ?? []).length === 1,
  'Seat assignment must re-authorize, revalidate, confirm, target only the audited missing color, suppress retries, and re-audit after TTS settles.',
)
assert(
  uiAdvanceLua.indexOf('requireControl(player)') >= 0 &&
    uiAdvanceLua.includes('if seatRefreshPending then') &&
    uiAdvanceLua.includes('if seatRecoveryPending then') &&
    uiAdvanceLua.includes(
      'if nativeSeatResumeRequired and audit.exactActiveSeats and #audit.occupiedInactive == 0 then',
    ) &&
    uiAdvanceLua.includes('resumeNativeTurns(player, target_color)') &&
    uiAdvanceLua.indexOf('nativeSeatRecoveryOpportunity(audit)') >
      uiAdvanceLua.indexOf('local audit = auditSeats()') &&
    uiAdvanceLua.includes('if not player then') &&
    uiAdvanceLua.indexOf('seatRecoveryArmedSignature == recovery.signature') >= 0 &&
    uiAdvanceLua.indexOf('restoreNativeSeat(player, target_color)') >= 0 &&
    uiAdvanceLua.indexOf('armSeatRecovery(recovery, target_color)') >= 0 &&
    uiAdvanceLua.indexOf('return') < uiAdvanceLua.indexOf('advanceClock(target_color)'),
  'The docket seat-assignment and Native-resume surface must stay actor-bound, authorized, stale-audit-safe, and separate from conference-clock advancement.',
)
assert(
  (save.LuaScript.match(/restoreNativeSeat\(/g) ?? []).length === 2 &&
    (save.LuaScript.match(/resumeNativeTurns\(/g) ?? []).length === 2 &&
    !save.LuaScript.includes('controllerRestoreNativeSeat') &&
    !save.LuaScript.includes('hotkeyRestoreNativeSeat') &&
    !save.LuaScript.includes('controllerResumeNativeTurns') &&
    !save.LuaScript.includes('hotkeyResumeNativeTurns'),
  'Private-seat assignment and Native resume must be reachable only from the docket handler, never console, hotkey, or chat adapters.',
)
assert(
  playerTurnLua.includes('if nativeResumeSettling then') &&
    playerTurnLua.includes('scheduleNativeResumeSettlement()') &&
    playerTurnLua.indexOf('if nativeResumeSettling then') <
      playerTurnLua.indexOf('if syncingTurns then return end') &&
    playerTurnLua.includes('if seatRefreshPending or seatRecoveryPending then') &&
    nativeAllowedLua.includes(
      'seatRefreshPending or seatRecoveryPending or nativeSeatResumeRequired or nativeResumeSettling',
    ) &&
    seatRefreshLua.includes('seatRefreshPending = true') &&
    seatRefreshLua.includes('seatRefreshPending = false') &&
    seatRefreshLua.includes('recordSeatAudit(settled_audit)') &&
    seatRefreshLua.indexOf('recordSeatAudit(settled_audit)') <
      seatRefreshLua.lastIndexOf('seatRefreshPending = false'),
  'Seat assignment and explicit restoration resume must suppress and drain native callbacks until generation-guarded audits and the docket handshake complete.',
)
const onSaveLua = luaBetween('function onSave()', 'function normalizeState()')
const onLoadLua = luaBetween('function onLoad(', 'function onSave()')
const savedStateValidatorLua = luaBetween('function validateSavedState(', 'function normalizeState()')
assert(
  onSaveLua.includes('schemaVersion = SAVE_SCHEMA_VERSION') &&
    onSaveLua.includes('started = state.started') &&
    onSaveLua.includes('turnMode = state.turnMode') &&
    onSaveLua.includes('endFromTurn = state.endFromTurn') &&
    onSaveLua.includes('JSON.encode(saved)') &&
    onSaveLua.includes('if loadFault and loadFaultSavedData then return loadFaultSavedData end') &&
    !onSaveLua.includes('pairs(state)') &&
    !onSaveLua.includes('seatRecovery') &&
    !onSaveLua.includes('nativeSeatResume') &&
    !save.LuaScript.includes('state.nativeSeatResume') &&
    !save.LuaScript.includes('state.seatRecovery'),
  'Spectator identity, seat-assignment confirmation, pending state, and Native-resume latch must remain transient.',
)
assert(
  onLoadLua.includes('validateSavedState(loaded)') &&
    onLoadLua.includes('resetStateToSafeSetup()') &&
    onLoadLua.includes('loadFault =') &&
    onLoadLua.includes('state.started and state.turnMode == TURN_MODE_NATIVE') &&
    onLoadLua.includes('nativeSeatResumeRequired =') &&
    onLoadLua.includes('disableTurnsSafely()') &&
    onLoadLua.indexOf('disableTurnsSafely()') < onLoadLua.indexOf('Wait.frames('),
  'Running Native loads must synchronously empty serialized Turns and reconstruct docket Resume before delayed initialization.',
)
assert(
  savedStateValidatorLua.includes('if type(candidate) ~= "table" then return false end') &&
    savedStateValidatorLua.includes('schemaVersion = true') &&
    savedStateValidatorLua.includes('turnMode = true') &&
    savedStateValidatorLua.includes('for key, _ in pairs(candidate) do') &&
    savedStateValidatorLua.includes('type(key) ~= "string" or not allowed[key]') &&
    savedStateValidatorLua.includes('schema ~= SAVE_SCHEMA_VERSION') &&
    savedStateValidatorLua.includes('validSavedInteger(candidate.playerCount, 2, 6)') &&
    savedStateValidatorLua.includes('validSavedInteger(candidate.dispatchCode, 1, 999999999)') &&
    savedStateValidatorLua.includes('candidate.phase == "ended"') &&
    savedStateValidatorLua.includes('if not candidate.started and') &&
    savedStateValidatorLua.includes('local expected_chair = ((chooseFirstChair(') &&
    savedStateValidatorLua.includes('candidate.chairIndex ~= expected_chair') &&
    savedStateValidatorLua.includes('candidate.phase == "briefing" or candidate.phase == "aftermath"') &&
    onLoadLua.includes('loadFaultSavedData = saved_data') &&
    onSaveLua.includes('return loadFaultSavedData'),
  'Nonempty saved script state must pass an exact schema/type/range/ending validator or remain preserved behind load quarantine.',
)
const startLua = luaBetween('function uiStartConference(', 'function chooseFirstChair(')
const requireControlLua = luaBetween('function requireControl(', 'function uiPlayerCount(')
const statusLineLua = luaBetween('function statusLine()', 'function currentInstruction()')
const updateUiLua = luaBetween('function updateUI()', 'function updatePhaseRail()')
const updateControllerLua = luaBetween('function updateController()', 'function resetCounters()')
const loadQuarantineUpdateLua = luaBetween('function updateAll()', 'function updateUI()')
assert(
  requireControlLua.includes('if loadFault then') &&
    requireControlLua.indexOf('if loadFault then') < requireControlLua.indexOf('isHostOrPromoted(player)') &&
    startLua.includes('if loadFault then') &&
    updateUiLua.includes('local setup_operable = is_setup and not loadFault') &&
    updateUiLua.includes('start_label = "LOAD BLOCKED"') &&
    updateUiLua.includes('UI.setAttribute("playerCount", "interactable", setup_operable)') &&
    updateUiLua.includes('UI.setAttribute("dispatchCode", "interactable", setup_operable)') &&
    updateControllerLua.includes('loadFault and "LOAD BLOCKED"') &&
    loadQuarantineUpdateLua.includes('if loadFault then') &&
    loadQuarantineUpdateLua.indexOf('if loadFault then') <
      loadQuarantineUpdateLua.indexOf('disableTurnsSafely()') &&
    loadQuarantineUpdateLua.indexOf('disableTurnsSafely()') <
      loadQuarantineUpdateLua.indexOf('return') &&
    loadQuarantineUpdateLua.indexOf('return') <
      loadQuarantineUpdateLua.indexOf('updateMarkers()') &&
    seatRefreshLua.indexOf('if loadFault then') <
      seatRefreshLua.indexOf('seatRefreshPending = true'),
  'Invalid saved state must remain visibly quarantined across setup, docket, console, authorized mutation, player events, and physical marker updates.',
)
assert(
  startLua.includes('if seatRefreshPending then') &&
    startLua.includes('audit.exactActiveSeats') &&
    startLua.includes('audit.occupiedInactive') &&
    startLua.includes('manualOpenSignature == audit.fingerprint') &&
    startLua.includes('commitConferenceStart(TURN_MODE_NATIVE, player, audit.fingerprint)') &&
    startLua.includes('commitConferenceStart(TURN_MODE_MANUAL, player, audit.fingerprint)') &&
    startLua.includes('if state.started then') &&
    startLua.includes('not player or not isHostOrPromoted(player)') &&
    startLua.includes('expected_audit_fingerprint ~= audit.fingerprint') &&
    startLua.includes('not manualOpenArmed or manualOpenSignature ~= audit.fingerprint') &&
    startLua.includes('lastSeatExactActive = audit.exactActiveSeats') &&
    startLua.indexOf('lastSeatExactActive = audit.exactActiveSeats') <
      startLua.indexOf('state.started = true'),
  'OPEN and its commit helper do not enforce one-use actor authorization, fresh seating, and exact Native or armed Manual decisions.',
)
const resumeNativeTurnsLua = luaBetween('function resumeNativeTurns(', 'function uiBack(')
const resumeLatchClearIndex = resumeNativeTurnsLua.indexOf('nativeSeatResumeRequired = false')
const resumeSuccessLua =
  resumeLatchClearIndex < 0 ? '' : resumeNativeTurnsLua.slice(resumeLatchClearIndex)
assert(
  resumeNativeTurnsLua.includes('not player or not isHostOrPromoted(player)') &&
    resumeNativeTurnsLua.includes('seatRefreshPending or seatRecoveryPending') &&
    resumeNativeTurnsLua.includes('auditSeats()') &&
    resumeNativeTurnsLua.includes('not audit.exactActiveSeats') &&
    resumeNativeTurnsLua.includes('nativeSeatResumeRequired = false') &&
    resumeNativeTurnsLua.includes('nativeResumeSettling = true') &&
    resumeSuccessLua.includes('nativeResumeClockSignature = clockTurnSignature()') &&
    resumeNativeTurnsLua.includes('scheduleNativeResumeSettlement()') &&
    resumeNativeTurnsLua.includes('function finishNativeResumeSettlement(') &&
    resumeNativeTurnsLua.includes('clockTurnSignature() == nativeResumeClockSignature') &&
    save.LuaScript.includes('NATIVE_RESUME_QUIET_SECONDS = 1') &&
    resumeNativeTurnsLua.includes('NATIVE_RESUME_QUIET_SECONDS') &&
    resumeNativeTurnsLua.includes('updateAll()') &&
    resumeNativeTurnsLua.indexOf('not player or not isHostOrPromoted(player)') <
      resumeLatchClearIndex &&
    resumeNativeTurnsLua.indexOf('seatRefreshPending or seatRecoveryPending') <
      resumeLatchClearIndex &&
    resumeNativeTurnsLua.indexOf('local audit = auditSeats()') < resumeLatchClearIndex &&
    resumeNativeTurnsLua.indexOf('not audit.exactActiveSeats') < resumeLatchClearIndex &&
    resumeSuccessLua.indexOf('nativeResumeSettling = true') <
      resumeSuccessLua.indexOf('nativeResumeClockSignature = clockTurnSignature()') &&
    resumeSuccessLua.indexOf('nativeResumeClockSignature = clockTurnSignature()') <
      resumeSuccessLua.indexOf('updateAll()') &&
    resumeSuccessLua.indexOf('updateAll()') <
      resumeSuccessLua.indexOf('scheduleNativeResumeSettlement()') &&
    !resumeNativeTurnsLua.includes('advanceClock(') &&
    !resumeNativeTurnsLua.includes('stepBack('),
  'Docket Native resume must re-authorize, re-audit exact seating, and drain delayed callbacks without moving the conference clock.',
)
const advanceLua = luaBetween('function advanceClock(', 'function stepBack(')
const stepBackLua = luaBetween('function stepBack(', 'function updateAll()')
const updateAllLua = luaBetween('function updateAll()', 'function updateUI()')
const finishLua = luaBetween('function finishConference(', 'function advanceClock(')
const sharedGateBeforeSafetyClear = (lua) =>
  lua.indexOf('forwardSeatBlockReason()') >= 0 &&
  (lua.indexOf('clearNativeTurnSafety()') < 0 ||
    lua.indexOf('forwardSeatBlockReason()') < lua.indexOf('clearNativeTurnSafety()'))
assert(
  advanceLua.includes('if syncingTurns then return false end') &&
    finishLua.includes('if syncingTurns then return false end') &&
    playerTurnLua.includes('advanceClock()') &&
    sharedGateBeforeSafetyClear(advanceLua) &&
    sharedGateBeforeSafetyClear(stepBackLua) &&
    sharedGateBeforeSafetyClear(finishLua) &&
    save.LuaScript.includes('advanceClock(target_color)') &&
    save.LuaScript.includes('advanceClock(player.color)') &&
    save.LuaScript.includes('advanceClock(player_color)') &&
    save.LuaScript.includes('advanceClock(sender.color)'),
  'UI, console, hotkey, chat, finish, and Back paths do not share the seat-safety gate before transient state can clear.',
)
assert(
  updateAllLua.includes('recordSeatAudit(audit)') &&
    !updateAllLua.includes('lastSeatExactActive =') &&
    !updateAllLua.includes('lastSeatCountryFingerprint ='),
  'updateAll must never swallow an inexact-to-exact transition by overwriting the seat-audit baseline.',
)
assert(
  stepBackLua.includes('state.phase == "ended" and nativeSeatResumeRequired') &&
    stepBackLua.indexOf('preserve_native_resume') < stepBackLua.indexOf('clearNativeTurnSafety()') &&
    stepBackLua.indexOf('nativeSeatResumeRequired = true') >
      stepBackLua.indexOf('clearNativeTurnSafety()'),
  'Ended-state Undo must preserve a restoration Resume latch into the reopened running state.',
)
const runningStatusPauseLua = statusLineLua.slice(
  statusLineLua.indexOf('local higher_priority_pause'),
  statusLineLua.indexOf('local turn_fault'),
)
assert(
  runningStatusPauseLua.includes(
    'higher_priority_pause = repair_required or seatRefreshPending or seatRecoveryPending',
  ) &&
    runningStatusPauseLua.indexOf('nativeResumeSettling and') <
      runningStatusPauseLua.indexOf('higher_priority_pause and') &&
    runningStatusPauseLua.indexOf('higher_priority_pause and') <
      runningStatusPauseLua.indexOf('nativeSeatResumeRequired and') &&
    runningStatusPauseLua.indexOf('nativeSeatResumeRequired and') <
      runningStatusPauseLua.indexOf('seat_block and'),
  'Running status must prioritize active settlement and refresh/repair gates, then candidly expose settled docket Resume.',
)
assert(
  statusLineLua.includes(
    'nativeSeatResumeRequired and not repair_required and not seat_block',
  ) &&
    statusLineLua.includes('local ended_pause = seat_block and " · SEATING PAUSED" or ""') &&
    statusLineLua.includes('mode .. ended_pause .. ended_resume'),
  'Ended status text can advertise Undo while a higher-priority seat gate blocks it.',
)
assert(
  updateControllerLua.includes('not repair_required and not seat_block') &&
    updateControllerLua.includes('seatRecoveryPending and "SEAT CHANGE REQUESTED"') &&
    updateControllerLua.includes('seatRefreshPending and "SEATING SETTLING"') &&
    updateControllerLua.includes('back = ended_resume and "UNDO\\nTO RESUME" or "BACK"') &&
    updateControllerLua.includes('Reopen the recorded ended-state clock.') &&
    updateControllerLua.indexOf('seatRefreshPending and "SEATING SETTLING"') <
      updateControllerLua.indexOf('nativeSeatResumeRequired and "RESUME IN DOCKET"'),
  'The physical console can advertise ended-state Undo or Resume while a higher-priority seat gate blocks it.',
)
const playerAtColorLua = luaBetween('function playerAtColor(', 'function availableSeatColors(')
const controllerAdaptersLua = luaBetween('function controllerAdvance(', 'function hotkeyStatus(')
assert(
  playerAtColorLua.includes('if color == "Grey" then') &&
    playerAtColorLua.includes('#spectators == 1') &&
    playerAtColorLua.includes('pcall(function() return Player[color] end)') &&
    (save.LuaScript.match(/Player\[/g) ?? []).length === 1 &&
    (controllerAdaptersLua.match(/playerAtColor\(/g) ?? []).length === 4 &&
    !controllerAdaptersLua.includes('Player['),
  'Physical-console and Game Key adapters must resolve v14.2 Grey spectators without unsafe Player.Grey indexing or ambiguity.',
)
assert(
  save.LuaScript.includes('UI.setAttribute("startButton", "text"') &&
    save.LuaScript.includes('UI.setAttribute("startButton", "tooltip"') &&
    save.LuaScript.includes('UI.setAttribute("startButton", "colors"') &&
    save.LuaScript.includes('UI.setAttribute("startButton", "interactable"') &&
    save.LuaScript.includes('SEATING SETTLING'),
  'The visible OPEN control does not render and disable its manual-confirmation, blocked-seat, and settling states.',
)
assert(
    save.LuaScript.includes('UI.setAttribute("advanceButton", "tooltip"') &&
    save.LuaScript.includes('UI.setAttribute("advanceButton", "colors"') &&
    save.LuaScript.includes('SEAT CHANGE REQUESTED') &&
    save.LuaScript.includes('not seat_block or recovery ~= nil') &&
    save.LuaScript.includes('RESUME NATIVE TURNS') &&
    save.LuaScript.includes('RESUME IN DOCKET') &&
    save.LuaScript.includes('RESUMING NATIVE TURNS') &&
    save.LuaScript.includes('"UNDO\\nTO RESUME"') &&
    save.LuaScript.includes('nativeSeatResumeRequired') &&
    save.LuaScript.includes('ASSIGN  "'),
  'The paused docket does not expose the guarded, candid seat-assignment, settling, and Native-resume states.',
)
assert(
  save.LuaScript.includes('function conciseUnicodeLabel(') &&
    save.LuaScript.includes('function unicodeScalarAt(') &&
    save.LuaScript.includes('function sanitizePlayerLabel(') &&
    save.LuaScript.includes('string.unicode(value, index)') &&
    save.LuaScript.includes('first >= 0xD800 and first <= 0xDBFF') &&
    save.LuaScript.includes('first >= 0xDC00 and first <= 0xDFFF') &&
    save.LuaScript.includes('return 1, 0x3F, true') &&
    save.LuaScript.includes('function playerLabelSeparator(') &&
    save.LuaScript.includes('scalar >= 0x2028 and scalar <= 0x202E') &&
    save.LuaScript.includes('scalar >= 0x2060 and scalar <= 0x206F') &&
    save.LuaScript.includes('scalar >= 0x2000 and scalar <= 0x200A') &&
    save.LuaScript.includes('scalar >= 0x115F and scalar <= 0x1160') &&
    save.LuaScript.includes('scalar >= 0x180B and scalar <= 0x180F') &&
    save.LuaScript.includes('scalar >= 0xFE00 and scalar <= 0xFE0F') &&
    save.LuaScript.includes('scalar >= 0xFFF0 and scalar <= 0xFFF8') &&
    save.LuaScript.includes('scalar >= 0xE0000 and scalar <= 0xE0FFF') &&
    save.LuaScript.includes('scalar == 0x3164') &&
    save.LuaScript.includes('scalar == 0xFFA0') &&
    save.LuaScript.includes('scalar == 0x3000') &&
    !save.LuaScript.includes('[%c%[%]<>]') &&
    save.LuaScript.includes('return conciseUnicodeLabel(label, 28, 25)'),
  'User-facing spectator labels are not sanitized and truncated at complete Unicode scalars under TTS UTF-16.',
)
const uiAdvanceSeatSafetyLua = luaBetween('function uiAdvance(', 'function resumeNativeTurns(')
assert(
  uiAdvanceSeatSafetyLua.includes('if seatRecoveryArmedSignature and') &&
    uiAdvanceSeatSafetyLua.includes('seatRecoveryArmedSignature ~= recovery.signature') &&
    uiAdvanceSeatSafetyLua.includes('disarmSeatRecovery()') &&
    uiAdvanceSeatSafetyLua.includes('Seat assignment conditions changed.') &&
    uiAdvanceSeatSafetyLua.indexOf('if seatRecoveryArmedSignature and') <
      uiAdvanceSeatSafetyLua.indexOf('if recovery then') &&
    uiAdvanceSeatSafetyLua.indexOf('if seatRecoveryArmedSignature and') <
      uiAdvanceSeatSafetyLua.indexOf('if nativeSeatResumeRequired and audit.exactActiveSeats'),
  'A changed roster can reinterpret an armed seat-assignment confirmation as Native Resume or clock advancement.',
)

for (const object of topWithTag('Controller')) {
  assert(
    object.LuaScript.includes('Global.call("controllerAdvance"'),
    'Controller NEXT button is not wired to Global.',
  )
  assert(
    object.LuaScript.includes('Global.call("controllerBack"') &&
      object.LuaScript.includes('index = 2') &&
      object.LuaScript.includes('label = data.back or "BACK"') &&
      object.LuaScript.includes('tooltip = data.backTooltip or'),
    'Controller BACK button cannot receive and execute its ended-state Undo label and tooltip.',
  )
}

const uiIds = [...save.XmlUI.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(uiIds.length === new Set(uiIds).size, 'Global UI element ids must be unique.')
const clockPanelTag = xmlOpeningTagById('clockPanel')
const clockBodyTag = xmlOpeningTagById('clockBody')
const instructionTextTag = xmlOpeningTagById('instructionText')
const xmlExpandedPanelHeight = clockPanelTag.match(/\bheight="(\d+)"/)?.[1]
const luaExpandedPanelHeight = save.LuaScript.match(/PANEL_HEIGHT_EXPANDED\s*=\s*"(\d+)"/)?.[1]
assert(
  save.XmlUI.includes('offsetXY="-174 -92"'),
  'The conference clock must leave the native turn strip and upper-right player/color menu unobstructed.',
)
assert(!save.XmlUI.includes('position="-174 -92"'), 'The conference clock still uses the wrong 3D position attribute.')
assert(save.XmlUI.includes('preferredHeight="54"'), 'The primary clock action is missing an explicit layout height.')
assert(save.XmlUI.includes('id="activeText"') && save.XmlUI.includes('preferredHeight="46"'), 'The active roster cannot render its full two-line label.')
assert(/\bheight="504"/.test(clockPanelTag), 'The expanded conference clock is not 504 px tall.')
assert(/\bpreferredHeight="426"/.test(clockBodyTag), 'The expanded conference-clock body is not 426 px tall.')
assert(/\bpreferredHeight="64"/.test(instructionTextTag), 'The setup instruction is not tall enough for its wrapped production copy.')
assert(
  xmlExpandedPanelHeight === luaExpandedPanelHeight &&
    save.LuaScript.includes('PANEL_HEIGHT_COLLAPSED = "70"') &&
    save.LuaScript.includes('panelCollapsed and PANEL_HEIGHT_COLLAPSED or PANEL_HEIGHT_EXPANDED'),
  'The XML and runtime conference-clock heights can drift apart.',
)
assert(
  save.XmlUI.includes('tooltip="Open on an untouched original table. This is not a full physical reset."') &&
    !save.XmlUI.includes('Reset public counters'),
  'OPEN must not claim to reset physical table state.',
)
assert(save.XmlUI.includes('id="finishButton"'), 'The guarded all-signatures action is missing.')
assert(save.XmlUI.includes('id="collapseButton"'), 'The collapsible conference docket control is missing.')
assert(save.XmlUI.includes('id="overviewButton"'), 'The per-player table overview control is missing.')
assert(save.XmlUI.includes('>UNDO CLOCK</Button>'), 'The clock-repair action needs an unambiguous label.')
assert(save.LuaScript.includes('UI.setAttribute("advanceButton", "text"'), 'The rendered primary-action label is not updated.')
assert(save.LuaScript.includes('UI.setAttribute("finishButton", "text"'), 'The rendered finish-confirmation label is not updated.')
assert(save.LuaScript.includes('UI.setAttribute("collapseButton", "text"'), 'The rendered collapse label is not updated.')
assert(!save.LuaScript.includes('UI.setValue("advanceButton"'), 'Button labels must use the rendered text attribute.')
assert(
  save.LuaScript.includes('position = {x = -6, y = 0, z = 0}') &&
    save.LuaScript.includes('pitch = 68') &&
    save.LuaScript.includes('distance = 58'),
  'The overview camera is not calibrated for the compact table and conference docket.',
)

const uiHandlers = [
  ...save.XmlUI.matchAll(/\bon(?:Click|ValueChanged|EndEdit)="([^"]+)"/g),
].map((match) => match[1])
for (const handler of uiHandlers) {
  assert(save.LuaScript.includes(`function ${handler}`), `Global UI handler ${handler} is not defined in Lua.`)
}

if (errors.length > 0) {
  console.error(`Verification failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Verified ${save.SaveName}`)
  console.log(`Top-level objects: ${topLevel.length}`)
  console.log(`Recursive objects: ${recursive.length}`)
  console.log(`Unique local assets: ${new Set(customAssetUrls).size}`)
  console.log(`Generated PNG artifacts: ${generatedAssetNames.length}`)
  console.log('Turn automation, decks, pieces, trackers, tokens, and private hand zones are present.')
}
