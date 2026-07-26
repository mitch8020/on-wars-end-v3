import assert from 'node:assert/strict'
import net from 'node:net'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const savePath = process.argv[2] ?? path.join(here, 'dist', 'TS_Save_1.json')
const save = JSON.parse(await readFile(savePath, 'utf8'))
const GLOBAL_GUID = '-1'
const TTS_PORT = 39999
const EDITOR_PORT = 39998
const HOST = '127.0.0.1'

class TtsBridge {
  constructor() {
    this.messages = []
    this.waiters = []
    this.server = net.createServer((socket) => {
      let buffer = ''
      socket.setEncoding('utf8')
      socket.on('data', (chunk) => {
        buffer += chunk
        try {
          const message = JSON.parse(buffer)
          buffer = ''
          this.#accept(message)
        } catch {
          // TTS may split one JSON document across TCP packets.
        }
      })
    })
  }

  async start() {
    await new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(EDITOR_PORT, HOST, resolve)
    })
  }

  async close() {
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('TTS bridge closed before the expected response arrived.'))
    }
    await new Promise((resolve) => this.server.close(resolve))
  }

  async request(payload, predicate, timeoutMs = 20_000) {
    const response = this.waitFor(predicate, timeoutMs)
    response.catch(() => {})
    try {
      await this.send(payload)
    } catch (error) {
      this.cancelWait(response, error)
      throw error
    }
    return response
  }

  async send(payload) {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: HOST, port: TTS_PORT }, () => {
        socket.end(JSON.stringify(payload), 'utf8')
      })
      socket.once('error', reject)
      socket.once('close', resolve)
    })
  }

  waitFor(predicate, timeoutMs = 10_000) {
    const existingIndex = this.messages.findIndex(predicate)
    if (existingIndex >= 0) {
      return Promise.resolve(this.messages.splice(existingIndex, 1)[0])
    }
    let waiter
    const promise = new Promise((resolve, reject) => {
      waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((candidate) => candidate !== waiter)
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for Tabletop Simulator.`))
        }, timeoutMs),
      }
    })
    waiter.promise = promise
    this.waiters.push(waiter)
    return promise
  }

  cancelWait(promise, error) {
    const waiterIndex = this.waiters.findIndex((candidate) => candidate.promise === promise)
    if (waiterIndex < 0) return
    const [waiter] = this.waiters.splice(waiterIndex, 1)
    clearTimeout(waiter.timer)
    waiter.reject(error)
  }

  #accept(message) {
    if (message.messageID === 3 && message.error) {
      const error = new Error(`${message.errorMessagePrefix ?? 'TTS Lua error: '}${message.error}`)
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer)
        waiter.reject(error)
      }
      return
    }
    const waiterIndex = this.waiters.findIndex(({ predicate }) => predicate(message))
    if (waiterIndex >= 0) {
      const [waiter] = this.waiters.splice(waiterIndex, 1)
      clearTimeout(waiter.timer)
      waiter.resolve(message)
      return
    }
    this.messages.push(message)
  }
}

function findScriptStates() {
  const controller = save.ObjectStates.find((object) => object.Tags?.includes('Controller'))
  assert(controller, 'Generated save is missing its physical conference controller.')
  return [
    {
      name: 'Global',
      guid: GLOBAL_GUID,
      script: save.LuaScript,
      ui: save.XmlUI,
    },
    {
      name: controller.Nickname || 'Conference Clock Console',
      guid: controller.GUID,
      script: controller.LuaScript,
      ui: controller.XmlUI ?? '',
    },
  ]
}

function nextRng(value) {
  let next = value >>> 0
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  next >>>= 0
  return next === 0 ? 1_831_565_813 : next
}

function expectedChair(seed, playerCount) {
  if (playerCount <= 2) return 1
  let rng = seed >>> 0
  for (let index = 6; index >= 2; index -= 1) rng = nextRng(rng)
  rng = nextRng(rng)
  return Math.floor((rng / 4_294_967_296) * playerCount) + 1
}

function snapshotScript(nonce) {
  return `
local snapshotPayload = "{}"
local snapshotOk, snapshotError = pcall(function()
    local hands = {}
    local handPolicies = {}
    local handNames = {}
    local decks = {}
    local turnOrder = {}
    for _, country in ipairs(COUNTRIES) do
        local color = SEAT_COLORS[country]
        local handObjects = Player[color].getHandObjects()
        hands[country] = #handObjects
        handPolicies[country] = 0
        handNames[country] = {}
        for _, object in ipairs(handObjects) do
            if object.hasTag("Policy_" .. country) then
                handPolicies[country] = handPolicies[country] + 1
            end
            table.insert(handNames[country], object.getName())
        end
        local deck = getObjectFromGUID(POLICY_DECKS[country])
        decks[country] = deck and deck.getQuantity() or -1
    end
    local seatedColors = {}
    for _, player in ipairs(Player.getPlayers()) do table.insert(seatedColors, player.color) end
    for _, color in ipairs(Turns.order) do table.insert(turnOrder, color) end
    local refugee = getObjectFromGUID(GUIDS.refugeeCounter)
    local controller = getObjectFromGUID(GUIDS.controller)
    local controllerButtons = controller and controller.getButtons() or {}
    local snapshot = {
        state = {
            started = state.started,
            playerCount = state.playerCount,
            dispatchCode = state.dispatchCode,
            round = state.round,
            phase = state.phase,
            chairIndex = state.chairIndex,
            turnIndex = state.turnIndex,
            outcome = state.outcome,
            endFromPhase = state.endFromPhase,
            endFromTurn = state.endFromTurn,
        },
        finishArmed = finishArmed,
        panelCollapsed = panelCollapsed,
        status = statusLine(),
        turns = {
            enable = Turns.enable,
            turnColor = Turns.turn_color,
            order = turnOrder,
        },
        ui = {
            phase = UI.getValue("phaseText"),
            active = UI.getValue("activeText"),
            roster = UI.getValue("rosterText"),
            instruction = UI.getValue("instructionText"),
            advance = UI.getAttribute("advanceButton", "text"),
            startActive = UI.getAttribute("startButton", "active"),
            advanceActive = UI.getAttribute("advanceButton", "active"),
            finishActive = UI.getAttribute("finishButton", "active"),
            finishLabel = UI.getAttribute("finishButton", "text"),
            collapseLabel = UI.getAttribute("collapseButton", "text"),
            toolsActive = UI.getAttribute("clockTools", "active"),
            bodyActive = UI.getAttribute("clockBody", "active"),
            panelHeight = UI.getAttribute("clockPanel", "height"),
        },
        hands = hands,
        handPolicies = handPolicies,
        handNames = handNames,
        decks = decks,
        seatedColors = seatedColors,
        refugee = refugee and refugee.getValue() or -1,
        controller = {
            status = controllerButtons[1] and controllerButtons[1].label or "",
            advance = controllerButtons[2] and controllerButtons[2].label or "",
        },
    }
    snapshotPayload = JSON.encode(snapshot)
end)
sendExternalMessage({
    suite = "owe-live",
    nonce = "${nonce}",
    ok = snapshotOk,
    error = tostring(snapshotError),
    payload = snapshotPayload,
})
`
}

async function snapshot(bridge, label, command = '', delaySeconds = 0.35) {
  const commandNonce = `command-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const commandResult = await bridge.request(
    {
      messageID: 3,
      guid: GLOBAL_GUID,
      script: `local commandOk, commandError = pcall(function()
${command}
end)
sendExternalMessage({
    suite = "owe-live",
    nonce = "${commandNonce}",
    commandComplete = true,
    ok = commandOk,
    error = tostring(commandError),
})`,
    },
    (candidate) =>
      candidate.messageID === 4 &&
      candidate.customMessage?.suite === 'owe-live' &&
      candidate.customMessage?.nonce === commandNonce,
  )
  assert.equal(
    commandResult.customMessage.ok,
    true,
    `TTS command for "${label}" failed: ${commandResult.customMessage.error}`,
  )
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1_000))
  const nonce = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const message = await bridge.request(
    {
      messageID: 3,
      guid: GLOBAL_GUID,
      script: snapshotScript(nonce),
    },
    (candidate) =>
      candidate.messageID === 4 &&
      candidate.customMessage?.suite === 'owe-live' &&
      candidate.customMessage?.nonce === nonce,
    Math.max(10_000, delaySeconds * 1_000 + 8_000),
  )
  assert.equal(
    message.customMessage.ok,
    true,
    `TTS snapshot for "${label}" failed: ${message.customMessage.error}`,
  )
  console.log(`✓ ${label}`)
  return JSON.parse(message.customMessage.payload)
}

function isTrue(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

function isFalse(value) {
  return value === false || String(value).toLowerCase() === 'false'
}

const bridge = new TtsBridge()
let failure

try {
  await bridge.start()
  const scripts = findScriptStates()
  await bridge.request(
    { messageID: 1, scriptStates: scripts },
    (message) =>
      message.messageID === 1 &&
      message.scriptStates?.some(
        (scriptState) =>
          scriptState.guid === GLOBAL_GUID &&
          scriptState.script?.includes('function finishConference'),
      ),
    30_000,
  )
  console.log(`Loaded generated scripts from ${path.relative(process.cwd(), savePath)} into TTS.`)

  const healthNonce = `health-${Date.now()}`
  await bridge.request(
    {
      messageID: 3,
      guid: GLOBAL_GUID,
      script: `sendExternalMessage({suite = "owe-live", nonce = "${healthNonce}", health = true})`,
    },
    (candidate) =>
      candidate.messageID === 4 &&
      candidate.customMessage?.suite === 'owe-live' &&
      candidate.customMessage?.nonce === healthNonce,
  )
  console.log('✓ external execution and custom-message transport')

  const waiting = await snapshot(
    bridge,
    'setup state and control visibility',
    `
state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
}
finishArmed = false
panelCollapsed = false
for _, player in ipairs(Player.getPlayers()) do
    if player.color ~= "White" then player.changeColor("White") end
end
updateAll()
`,
  )
  assert.equal(waiting.state.started, false)
  assert.equal(waiting.state.playerCount, 6)
  assert(isTrue(waiting.ui.startActive), 'Setup must expose the start action.')
  assert(isFalse(waiting.ui.advanceActive), 'Setup must hide the advance action.')
  assert.equal(waiting.ui.active, 'ARAVELL · TOMERIN · VEYRA\nKARSK · BELOVAR · NAMARRA')
  assert.match(waiting.ui.roster, /0 \/ 6 SEATED · 6 ACTIVE/)
  assert.match(waiting.ui.instruction, /Sit in the matching color seats/)

  const opened = await snapshot(bridge, 'conference start, deterministic chair, and counter reset', 'startConference()')
  assert.equal(opened.state.started, true)
  assert.equal(opened.state.phase, 'briefing')
  assert.equal(opened.state.chairIndex, expectedChair(148802, 6))
  assert.equal(opened.refugee, 12)
  assert.equal(opened.turns.enable, false)
  assert.match(opened.ui.active, /TABLE STEP/)
  assert(isFalse(opened.ui.finishActive), 'All-signed control must not appear during Briefing.')

  const cabinet = await snapshot(
    bridge,
    'Cabinet opening, built-in turns, and six private deals',
    `
if Player["White"].seated then Player["White"].changeColor(SEAT_COLORS[chairCountry()]) end
advanceClock()
`,
    2.5,
  )
  assert.equal(cabinet.state.phase, 'cabinet')
  assert.equal(cabinet.state.turnIndex, 1)
  assert.equal(cabinet.turns.enable, true)
  assert.equal(cabinet.turns.turnColor, cabinet.turns.order[0])
  assert.equal(cabinet.ui.advance, 'END CABINET TURN')
  assert.match(cabinet.ui.roster, /1 \/ 6 SEATED · 6 ACTIVE/)
  for (const country of ['aravell', 'tomerin', 'veyra', 'karsk', 'belovar', 'namarra']) {
    assert.equal(cabinet.handPolicies[country], 3, `${country} should receive three policy cards.`)
    assert.equal(cabinet.decks[country], 13, `${country} deck should retain thirteen cards.`)
  }

  const crisis = await snapshot(
    bridge,
    'six Cabinet turns advance exactly once into Crisis Council',
    'for index = 1, state.playerCount do advanceClock() end',
  )
  assert.equal(crisis.state.phase, 'crisis')
  assert.equal(crisis.state.turnIndex, 1)
  assert.equal(crisis.ui.advance, 'SEAL COMMITMENT')

  const summit = await snapshot(
    bridge,
    'six Crisis turns advance exactly once into Peace Summit',
    'for index = 1, state.playerCount do advanceClock() end',
  )
  assert.equal(summit.state.phase, 'summit')
  assert.equal(summit.state.turnIndex, 1)
  assert.equal(summit.ui.advance, 'END SUMMIT TURN')
  assert(isTrue(summit.ui.finishActive), 'Peace Summit must expose the guarded all-signed action.')

  const armed = await snapshot(bridge, 'first all-signed action arms a five-second confirmation', 'finishConference()')
  assert.equal(armed.state.phase, 'summit')
  assert.equal(armed.finishArmed, true)
  assert.match(armed.ui.finishLabel, /CONFIRM ALL SIGNED/)

  const signed = await snapshot(bridge, 'confirmed signatures close the conference and disable turns', 'finishConference()')
  assert.equal(signed.state.phase, 'ended')
  assert.equal(signed.state.outcome, 'signed')
  assert.equal(signed.turns.enable, false)
  assert.equal(signed.ui.advance, 'CONFERENCE CLOSED')
  assert.match(signed.ui.active, /ACCORD COMPLETE/)

  const restored = await snapshot(bridge, 'Back restores the exact pre-ending Summit turn', 'stepBack()')
  assert.equal(restored.state.phase, 'summit')
  assert.equal(restored.state.turnIndex, 1)
  assert.equal(restored.state.outcome, undefined)

  const aftermath = await snapshot(
    bridge,
    'six Summit turns advance exactly once into the Aftermath table step',
    'for index = 1, state.playerCount do advanceClock() end',
  )
  assert.equal(aftermath.state.phase, 'aftermath')
  assert.equal(aftermath.turns.enable, false)
  assert.equal(aftermath.ui.advance, 'NEXT ROUND')
  assert.match(aftermath.ui.active, /TABLE STEP/)

  const nextRound = await snapshot(bridge, 'Aftermath rotates the chair into Round 2 Briefing', 'advanceClock()')
  assert.equal(nextRound.state.round, 2)
  assert.equal(nextRound.state.phase, 'briefing')
  assert.equal(nextRound.state.chairIndex, (opened.state.chairIndex % 6) + 1)
  assert.match(nextRound.status, /Table step/)

  const overview = await snapshot(
    bridge,
    'per-player Overview frames the table without changing clock state',
    'uiOverview(Player[SEAT_COLORS[chairCountry()]])',
  )
  assert.equal(overview.state.round, 2)
  assert.equal(overview.state.phase, 'briefing')

  const collapsed = await snapshot(bridge, 'docket collapses without changing conference state', 'uiTogglePanel(nil)')
  assert.equal(collapsed.panelCollapsed, true)
  assert(isFalse(collapsed.ui.bodyActive))
  assert.equal(String(collapsed.ui.panelHeight), '70')
  assert.equal(collapsed.ui.collapseLabel, '+')

  const rosterNames = new Map([
    [3, 'ARAVELL · TOMERIN · VEYRA'],
    [4, 'ARAVELL · TOMERIN · VEYRA\nKARSK'],
    [5, 'ARAVELL · TOMERIN · VEYRA\nKARSK · BELOVAR'],
  ])
  for (const playerCount of [3, 4, 5]) {
    const rosterSetup = await snapshot(
      bridge,
      `${playerCount}-country setup callback selects the exact active roster`,
      `
state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
}
finishArmed = false
panelCollapsed = false
for _, player in ipairs(Player.getPlayers()) do
    if player.color ~= "White" then player.changeColor("White") end
end
uiPlayerCount(nil, "${playerCount}")
`,
    )
    assert.equal(rosterSetup.state.playerCount, playerCount)
    assert.equal(rosterSetup.ui.active, rosterNames.get(playerCount))
    assert.match(rosterSetup.ui.roster, new RegExp(`0 / ${playerCount} SEATED · ${playerCount} ACTIVE`))

    const rosterOpened = await snapshot(
      bridge,
      `${playerCount}-country start sets deterministic chair, counters, and setup lock`,
      `
startConference()
uiPlayerCount(nil, "2")
`,
    )
    assert.equal(rosterOpened.state.playerCount, playerCount, 'Roster changes must lock after opening.')
    assert.equal(rosterOpened.state.chairIndex, expectedChair(148802, playerCount))
    assert.equal(rosterOpened.refugee, playerCount * 2)
    assert.match(rosterOpened.controller.status, new RegExp(`Round 1/6 · Briefing`))
    assert.equal(rosterOpened.controller.advance, 'BEGIN CABINET')
  }

  const nativeTurns = await snapshot(
    bridge,
    'native three-country turns initialize in conference order',
    `
state = {
    started = true,
    playerCount = 3,
    dispatchCode = 148802,
    round = 3,
    phase = "cabinet",
    chairIndex = 1,
    turnIndex = 1,
}
finishArmed = false
panelCollapsed = false
if Player["White"].seated then Player["White"].changeColor("Blue") end
updateAll()
`,
  )
  assert.deepEqual(nativeTurns.turns.order, ['Blue', 'Red', 'Green'])
  assert.equal(nativeTurns.turns.turnColor, 'Blue')

  const nativeSecond = await snapshot(
    bridge,
    'native End Turn advances to the second delegation',
    'Player["Blue"].changeColor("Red"); Turns.endTurn()',
    0.8,
  )
  assert.equal(nativeSecond.state.phase, 'cabinet')
  assert.equal(nativeSecond.state.turnIndex, 2)
  assert.equal(nativeSecond.turns.turnColor, 'Red')

  const nativeThird = await snapshot(
    bridge,
    'native End Turn advances to the third delegation',
    'Player["Red"].changeColor("Green"); Turns.endTurn()',
    0.8,
  )
  assert.equal(nativeThird.state.phase, 'cabinet')
  assert.equal(nativeThird.state.turnIndex, 3)
  assert.equal(nativeThird.turns.turnColor, 'Green')

  const nativeCrisis = await snapshot(
    bridge,
    'native final End Turn advances exactly once into Crisis Council',
    'Player["Green"].changeColor("Blue"); Turns.endTurn()',
    0.8,
  )
  assert.equal(nativeCrisis.state.phase, 'crisis')
  assert.equal(nativeCrisis.state.turnIndex, 1)
  assert.equal(nativeCrisis.turns.turnColor, 'Blue')

  const roundLimit = await snapshot(
    bridge,
    'physical console bridge closes Round 6 from Aftermath',
    `
state = {
    started = true,
    playerCount = 3,
    dispatchCode = 148802,
    round = 6,
    phase = "aftermath",
    chairIndex = 2,
    turnIndex = 1,
}
finishArmed = false
updateAll()
for _, player in ipairs(Player.getPlayers()) do
    if player.host then controllerAdvance({color = player.color}) end
end
`,
  )
  assert.equal(roundLimit.state.phase, 'ended')
  assert.equal(roundLimit.state.outcome, 'rounds')
  assert.equal(roundLimit.turns.enable, false)
  assert.match(roundLimit.ui.active, /SIX ROUNDS COMPLETE/)
  assert.equal(roundLimit.controller.advance, 'CONFERENCE CLOSED')

  const roundLimitBack = await snapshot(
    bridge,
    'physical console Back restores Round 6 Aftermath exactly',
    `
for _, player in ipairs(Player.getPlayers()) do
    if player.host then controllerBack({color = player.color}) end
end
`,
  )
  assert.equal(roundLimitBack.state.round, 6)
  assert.equal(roundLimitBack.state.phase, 'aftermath')
  assert.equal(roundLimitBack.state.outcome, undefined)
  assert.equal(roundLimitBack.controller.advance, 'NEXT ROUND')

  const twoPlayerSetup = await snapshot(
    bridge,
    'two-country roster starts with Aravell in the deterministic chair',
    `
for _, country in ipairs(COUNTRIES) do
    local deck = getObjectFromGUID(POLICY_DECKS[country])
    if deck then
        local tag = "Policy_" .. country
        for _, object in ipairs(getAllObjects()) do
            if object ~= deck and object.hasTag(tag) then deck.putObject(object) end
        end
    end
end
for _, player in ipairs(Player.getPlayers()) do
    if player.color ~= "White" then player.changeColor("White") end
end
state = {
    started = false,
    playerCount = 2,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
}
finishArmed = false
panelCollapsed = false
updateAll()
startConference()
`,
    1.2,
  )
  assert.equal(twoPlayerSetup.state.playerCount, 2)
  assert.equal(twoPlayerSetup.state.chairIndex, 1)
  assert.equal(twoPlayerSetup.refugee, 4)
  assert.match(twoPlayerSetup.ui.roster, /0 \/ 2 SEATED · 2 ACTIVE/)

  const twoPlayerCabinet = await snapshot(
    bridge,
    'two-country Cabinet seats only active countries and deals only their decks',
    `
if Player["White"].seated then Player["White"].changeColor("Blue") end
advanceClock()
`,
    2.5,
  )
  assert.deepEqual(twoPlayerCabinet.turns.order, ['Blue', 'Red'])
  assert.equal(twoPlayerCabinet.turns.enable, true)
  assert.equal(twoPlayerCabinet.turns.turnColor, 'Blue')
  assert.match(twoPlayerCabinet.ui.roster, /1 \/ 2 SEATED · 2 ACTIVE/)
  for (const country of ['aravell', 'tomerin']) {
    assert.equal(twoPlayerCabinet.handPolicies[country], 3)
    assert.equal(twoPlayerCabinet.decks[country], 13)
  }
  for (const country of ['veyra', 'karsk', 'belovar', 'namarra']) {
    assert.equal(twoPlayerCabinet.handPolicies[country], 0)
    assert.equal(twoPlayerCabinet.decks[country], 16)
  }

  const reset = await snapshot(
    bridge,
    'test session restores the untouched setup surface',
    `
for _, country in ipairs(COUNTRIES) do
    local deck = getObjectFromGUID(POLICY_DECKS[country])
    if deck then
        local tag = "Policy_" .. country
        for _, object in ipairs(getAllObjects()) do
            if object ~= deck and object.hasTag(tag) then deck.putObject(object) end
        end
    end
end
for _, player in ipairs(Player.getPlayers()) do
    if player.color ~= "White" then player.changeColor("White") end
end
state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
}
finishArmed = false
panelCollapsed = false
resetCounters()
updateAll()
frameOverview(Player["White"])
`,
    1.2,
  )
  assert.equal(reset.state.started, false)
  assert(isTrue(reset.ui.bodyActive))
  assert(isTrue(reset.ui.toolsActive), 'Overview and Status must remain available during setup.')
  assert.equal(String(reset.ui.panelHeight), '492')
  assert.equal(reset.ui.collapseLabel, '−')
  assert.match(reset.ui.roster, /0 \/ 6 SEATED · 6 ACTIVE/)
  assert.equal(reset.refugee, 12, 'Cleanup must restore the six-player refugee counter.')

  console.log('Live TTS verification passed: setup tools, all 2–6-player rosters, deals, native turns, console controls, both endings/undo paths, chair rotation, overview, and collapse.')
} catch (error) {
  failure = error
  console.error(`Live TTS verification failed: ${error.message}`)
  process.exitCode = 1
} finally {
  try {
    await bridge.close()
  } catch (closeError) {
    if (!failure) {
      console.error(`Failed to close TTS bridge: ${closeError.message}`)
      process.exitCode = 1
    }
  }
}
