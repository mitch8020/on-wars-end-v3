import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countries, crises, policies } from './content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const savePath = process.argv[2] ?? path.join(here, 'dist', 'TS_Save_1.json')
const save = JSON.parse(await readFile(savePath, 'utf8'))
const errors = []

function assert(condition, message) {
  if (!condition) errors.push(message)
}

function allObjects(objects) {
  return objects.flatMap((object) => [object, ...allObjects(object.ContainedObjects ?? [])])
}

const topLevel = save.ObjectStates ?? []
const recursive = allObjects(topLevel)
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
assert(topWithTag('ResourceCube').length === 61, 'Expected 61 starting resource cubes.')
assert(topWithTag('ResourceSupply').length === 4, 'Expected four infinite resource supply bags.')
assert(topWithTag('TrustCounter').length === 15, 'Expected all 15 bilateral Trust counters.')
assert(topWithTag('SignatureSeal').length === countries.length, 'Expected six signature seals.')
assert(topWithTag('PressureMarker').length === countries.length, 'Expected six pressure markers.')
assert(topWithTag('PopulationCounter').length === countries.length, 'Expected six Population counters.')
assert(topWithTag('MilitaryCounter').length === countries.length, 'Expected six Military counters.')
assert(topWithTag('HandZone').length === countries.length, 'Expected six private hand zones.')
assert(topWithTag('Controller').length === 1, 'Expected one physical conference console.')
assert(topWithTag('TurnMarker').length === 1, 'Expected one active delegation marker.')
assert(topWithTag('PhaseMarker').length === 1, 'Expected one phase marker.')
assert(topByName('Custom_Board').length === 0, 'Framed custom boards reintroduce oversized colliders.')

const conferenceBoard = topWithTag('ConferenceBoard')[0]
assert(conferenceBoard?.Name === 'Custom_Tile', 'The conference surface must use a low-profile custom tile.')
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

  const mandate = topLevel.find(
    (object) => object.Tags?.includes('MandateCard') && object.Tags?.includes(countryTag),
  )
  const handZone = topLevel.find(
    (object) => object.Tags?.includes('HandZone') && object.Tags?.includes(countryTag),
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
  for (const component of [policyDeck, mandate]) {
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

for (const localPath of new Set(customAssetUrls)) {
  assert(path.isAbsolute(localPath), `Asset path is not absolute: ${localPath}`)
  assert(!localPath.startsWith('file:'), `File URI found where TTS requires a local path: ${localPath}`)
  if (path.isAbsolute(localPath)) {
    try {
      await access(localPath)
    } catch {
      errors.push(`Missing local asset: ${localPath}`)
    }
  }
}

const requiredLuaFragments = [
  'function onLoad',
  'function onSave',
  'function advanceClock',
  'function stepBack',
  'function onPlayerTurn',
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

for (const object of topWithTag('Controller')) {
  assert(object.LuaScript.includes('Global.call("controllerAdvance"'), 'Controller NEXT button is not wired to Global.')
}

const uiIds = [...save.XmlUI.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(uiIds.length === new Set(uiIds).size, 'Global UI element ids must be unique.')
assert(save.XmlUI.includes('offsetXY="-24 -24"'), 'The conference clock must use a screen-space offset.')
assert(!save.XmlUI.includes('position="-24 -24"'), 'The conference clock still uses the wrong 3D position attribute.')
assert(save.XmlUI.includes('preferredHeight="54"'), 'The primary clock action is missing an explicit layout height.')
assert(save.XmlUI.includes('id="activeText"') && save.XmlUI.includes('preferredHeight="46"'), 'The active roster cannot render its full two-line label.')
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
  console.log('Turn automation, decks, pieces, trackers, tokens, and private hand zones are present.')
}
