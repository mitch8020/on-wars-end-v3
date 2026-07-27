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
    this.fatalError = null
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
    if (this.fatalError) throw this.fatalError
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
    if (this.fatalError) throw this.fatalError
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: HOST, port: TTS_PORT }, () => {
        socket.end(JSON.stringify(payload), 'utf8')
      })
      socket.once('error', reject)
      socket.once('close', resolve)
    })
  }

  waitFor(predicate, timeoutMs = 10_000) {
    if (this.fatalError) return Promise.reject(this.fatalError)
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
      if (!this.fatalError) this.fatalError = error
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
    local handGuids = {}
    local decks = {}
    local policyDeckOrder = {}
    local counterValues = {}
    local turnOrder = {}
    local seatAudit = auditSeats()
    local missingActive = {}
    local occupiedInactive = {}
    for _, item in ipairs(seatAudit.missingActive) do
        table.insert(missingActive, item.color .. " (" .. item.countryName .. ")")
    end
    for _, item in ipairs(seatAudit.occupiedInactive) do
        table.insert(occupiedInactive, item.color .. " (" .. item.countryName .. ")")
    end
    for _, country in ipairs(COUNTRIES) do
        local color = SEAT_COLORS[country]
        local handObjects = Player[color].getHandObjects()
        hands[country] = #handObjects
        handPolicies[country] = 0
        handNames[country] = {}
        handGuids[country] = {}
        for _, object in ipairs(handObjects) do
            if object.hasTag("Policy_" .. country) then
                handPolicies[country] = handPolicies[country] + 1
            end
            table.insert(handNames[country], object.getName())
            table.insert(handGuids[country], object.getGUID())
        end
        table.sort(handGuids[country])
        local deck = getObjectFromGUID(POLICY_DECKS[country])
        decks[country] = deck and deck.getQuantity() or -1
        policyDeckOrder[country] = {}
        if deck then
            for _, entry in ipairs(deck.getObjects()) do
                table.insert(policyDeckOrder[country], entry.guid or entry.nickname or "")
            end
        end
    end
    for guid, _ in pairs(COUNTER_STARTS) do
        local counter = getObjectFromGUID(guid)
        counterValues[guid] = counter and counter.getValue() or -1
    end
    local crisisOrder = {}
    local crisisDeck = getObjectFromGUID(GUIDS.crisisDeck)
    if crisisDeck then
        for _, entry in ipairs(crisisDeck.getObjects()) do
            table.insert(crisisOrder, entry.guid or entry.nickname or "")
        end
    end
    local function markerTransform(guid)
        local marker = getObjectFromGUID(guid)
        if not marker then return nil end
        local position = marker.getPosition()
        local rotation = marker.getRotation()
        return {
            position = {x = position.x, y = position.y, z = position.z},
            rotation = {x = rotation.x, y = rotation.y, z = rotation.z},
        }
    end
    local seatedColors = {}
    for _, player in ipairs(Player.getPlayers()) do table.insert(seatedColors, player.color) end
    local observedTurnOrder = nativeTestTurns and nativeTestTurns.order or Turns.order
    for _, color in ipairs(observedTurnOrder) do table.insert(turnOrder, color) end
    local observedTurnEnable = Turns.enable
    local observedTurnColor = Turns.turn_color
    if nativeTestTurns then
        observedTurnEnable = nativeTestTurns.enable
        observedTurnColor = nativeTestTurns.turnColor
    end
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
            turnMode = state.turnMode,
            outcome = state.outcome,
            endFromPhase = state.endFromPhase,
            endFromTurn = state.endFromTurn,
        },
        finishArmed = finishArmed,
        manualOpenArmed = manualOpenArmed,
        manualOpenSignature = manualOpenSignature,
        manualOpenGeneration = manualOpenGeneration,
        seatRecoveryArmedSignature = seatRecoveryArmedSignature and "armed" or nil,
        seatRecoveryGeneration = seatRecoveryGeneration,
        seatRecoveryPending = seatRecoveryPending and {
            color = seatRecoveryPending.color,
            countryName = seatRecoveryPending.countryName,
        } or nil,
        seatRecoveryPendingGeneration = seatRecoveryPendingGeneration,
        seatRefreshPending = seatRefreshPending,
        nativeSeatResumeRequired = nativeSeatResumeRequired,
        nativeResumeSettling = nativeResumeSettling,
        nativeResumeGeneration = nativeResumeGeneration,
        syncingTurns = syncingTurns,
        nativeTurnResyncSignature = nativeTurnResyncSignature,
        nativeTurnFaultSignature = nativeTurnFaultSignature,
        loadFault = loadFault,
        nativeFaultBroadcasts = nativeTestFaultBroadcasts or 0,
        nativeUnicodeLabel = nativeTestUnicodeLabel,
        nativeEmojiScalarSafe = nativeTestEmojiScalarSafe,
        nativeMalformedLabel = nativeTestMalformedLabel,
        nativeHiddenFormatLabel = nativeTestHiddenFormatLabel,
        nativeBlankUnicodeSpaceLabel = nativeTestBlankUnicodeSpaceLabel,
        nativeBlankDefaultIgnorableLabel = nativeTestBlankDefaultIgnorableLabel,
        nativeMarkupLabel = nativeTestMarkupLabel,
        nativeLateResumeCallbackFired = nativeTestLateResumeCallbackFired,
        nativeTurnsAllowed = nativeTurnsAllowed(),
        turnSyncGeneration = turnSyncGeneration,
        panelCollapsed = panelCollapsed,
        status = statusLine(),
        turns = {
            enable = observedTurnEnable,
            effective = observedTurnEnable == true and #turnOrder > 0,
            turnColor = observedTurnColor,
            order = turnOrder,
        },
        ui = {
            phase = UI.getValue("phaseText"),
            active = UI.getValue("activeText"),
            roster = UI.getValue("rosterText"),
            instruction = UI.getValue("instructionText"),
            advance = UI.getAttribute("advanceButton", "text"),
            advanceTooltip = UI.getAttribute("advanceButton", "tooltip"),
            advanceColors = UI.getAttribute("advanceButton", "colors"),
            advanceInteractable = UI.getAttribute("advanceButton", "interactable"),
            startActive = UI.getAttribute("startButton", "active"),
            startInteractable = UI.getAttribute("startButton", "interactable"),
            startLabel = UI.getAttribute("startButton", "text"),
            startTooltip = UI.getAttribute("startButton", "tooltip"),
            startColors = UI.getAttribute("startButton", "colors"),
            playerCountInteractable = UI.getAttribute("playerCount", "interactable"),
            dispatchInteractable = UI.getAttribute("dispatchCode", "interactable"),
            advanceActive = UI.getAttribute("advanceButton", "active"),
            finishActive = UI.getAttribute("finishButton", "active"),
            finishInteractable = UI.getAttribute("finishButton", "interactable"),
            finishLabel = UI.getAttribute("finishButton", "text"),
            backInteractable = UI.getAttribute("backButton", "interactable"),
            collapseLabel = UI.getAttribute("collapseButton", "text"),
            toolsActive = UI.getAttribute("clockTools", "active"),
            bodyActive = UI.getAttribute("clockBody", "active"),
            panelHeight = UI.getAttribute("clockPanel", "height"),
        },
        hands = hands,
        handPolicies = handPolicies,
        handNames = handNames,
        handGuids = handGuids,
        decks = decks,
        physical = {
            counterValues = counterValues,
            policyDeckOrder = policyDeckOrder,
            crisisOrder = crisisOrder,
            handGuids = handGuids,
            turnMarker = markerTransform(GUIDS.turnMarker),
            phaseMarker = markerTransform(GUIDS.phaseMarker),
        },
        seatedColors = seatedColors,
        seatAudit = {
            exactActiveSeats = seatAudit.exactActiveSeats,
            activeSeated = seatAudit.activeSeated,
            missingActive = missingActive,
            occupiedInactive = occupiedInactive,
            neutralObservers = seatAudit.neutralObservers,
            fingerprint = seatAudit.fingerprint,
            countryFingerprint = seatAudit.countryFingerprint,
        },
        refugee = refugee and refugee.getValue() or -1,
        controller = {
            status = controllerButtons[1] and controllerButtons[1].label or "",
            advance = controllerButtons[2] and controllerButtons[2].label or "",
            back = controllerButtons[3] and controllerButtons[3].label or "",
            backTooltip = controllerButtons[3] and controllerButtons[3].tooltip or "",
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

async function runDelayedCommand(bridge, label, prepare, complete, delaySeconds) {
  const nonce = `delayed-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const message = await bridge.request(
    {
      messageID: 3,
      guid: GLOBAL_GUID,
      script: `
local scheduleOk, scheduleError = pcall(function()
${prepare}
    Wait.time(function()
        local completeOk, completeError = pcall(function()
${complete}
        end)
        sendExternalMessage({
            suite = "owe-live",
            nonce = "${nonce}",
            delayedComplete = true,
            ok = completeOk,
            error = tostring(completeError),
        })
    end, ${delaySeconds})
end)
if not scheduleOk then
    sendExternalMessage({
        suite = "owe-live",
        nonce = "${nonce}",
        delayedComplete = true,
        ok = false,
        error = tostring(scheduleError),
    })
end
`,
    },
    (candidate) =>
      candidate.messageID === 4 &&
      candidate.customMessage?.suite === 'owe-live' &&
      candidate.customMessage?.nonce === nonce &&
      candidate.customMessage?.delayedComplete === true,
    Math.max(10_000, delaySeconds * 1_000 + 8_000),
  )
  assert.equal(
    message.customMessage.ok,
    true,
    `Delayed TTS command for "${label}" failed: ${message.customMessage.error}`,
  )
}

function isTrue(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

function isFalse(value) {
  return value === false || String(value).toLowerCase() === 'false'
}

function assertPhysicalEquivalent(actual, expected, message, transformTolerance = 0.001) {
  for (const key of ['counterValues', 'policyDeckOrder', 'crisisOrder', 'handGuids']) {
    assert.deepEqual(actual[key], expected[key], `${message}: ${key}`)
  }
  for (const marker of ['turnMarker', 'phaseMarker']) {
    assert(actual[marker] && expected[marker], `${message}: ${marker} is missing`)
    for (const component of ['position', 'rotation']) {
      for (const axis of ['x', 'y', 'z']) {
        const delta = Math.abs(actual[marker][component][axis] - expected[marker][component][axis])
        assert(
          delta <= transformTolerance,
          `${message}: ${marker}.${component}.${axis} drifted by ${delta}`,
        )
      }
    }
  }
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
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
panelCollapsed = false
liveTestOriginalAuditSeats = auditSeats
liveTestSeatColors = {"White"}
liveTestHostColor = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then liveTestHostColor = player.color end
end
assert(liveTestHostColor ~= nil, "live fixture has no host player")
auditSeats = function()
    return classifySeats(liveTestSeatColors, state.playerCount)
end
for count = 2, 6 do
    local exactColors = {"White", "Grey"}
    for index = 1, count do table.insert(exactColors, SEAT_COLORS[COUNTRIES[index]]) end
    local exactAudit = classifySeats(exactColors, count)
    assert(exactAudit.exactActiveSeats, "exact seat classifier failed for N=" .. tostring(count))
    assert(exactAudit.activeSeated == count, "active seat count failed for N=" .. tostring(count))
    assert(#exactAudit.missingActive == 0, "exact audit reported missing active seats for N=" .. tostring(count))
    assert(#exactAudit.occupiedInactive == 0, "exact audit reported occupied inactive seats for N=" .. tostring(count))
    assert(#exactAudit.neutralObservers == 2, "neutral observers were not preserved for N=" .. tostring(count))
    assert(exactAudit.neutralObservers[1] == "Grey" and exactAudit.neutralObservers[2] == "White",
        "neutral observer identities were unstable for N=" .. tostring(count))
    local expectedCountryColors = {}
    for index = 1, count do table.insert(expectedCountryColors, SEAT_COLORS[COUNTRIES[index]]) end
    table.sort(expectedCountryColors)
    assert(exactAudit.countryFingerprint == tostring(count) .. "|" .. table.concat(expectedCountryColors, "|"),
        "country-seat fingerprint failed for N=" .. tostring(count))

    local missingColors = {"White"}
    for index = 1, count - 1 do table.insert(missingColors, SEAT_COLORS[COUNTRIES[index]]) end
    local missingAudit = classifySeats(missingColors, count)
    assert(not missingAudit.exactActiveSeats, "missing audit was incorrectly exact for N=" .. tostring(count))
    assert(missingAudit.activeSeated == count - 1, "missing active count failed for N=" .. tostring(count))
    assert(#missingAudit.missingActive == 1, "missing seat classifier failed for N=" .. tostring(count))
    assert(missingAudit.missingActive[1].country == COUNTRIES[count],
        "missing country identity failed for N=" .. tostring(count))
    assert(#missingAudit.occupiedInactive == 0, "missing audit reported inactive occupants for N=" .. tostring(count))

    if count < 6 then
        local inactiveColors = {}
        for index = 1, count do table.insert(inactiveColors, SEAT_COLORS[COUNTRIES[index]]) end
        table.insert(inactiveColors, SEAT_COLORS[COUNTRIES[count + 1]])
        local inactiveAudit = classifySeats(inactiveColors, count)
        assert(not inactiveAudit.exactActiveSeats, "inactive audit was incorrectly exact for N=" .. tostring(count))
        assert(inactiveAudit.activeSeated == count, "inactive audit lost an active seat for N=" .. tostring(count))
        assert(#inactiveAudit.missingActive == 0, "inactive audit reported a missing active seat for N=" .. tostring(count))
        assert(#inactiveAudit.occupiedInactive == 1, "inactive seat classifier failed for N=" .. tostring(count))
        assert(inactiveAudit.occupiedInactive[1].country == COUNTRIES[count + 1],
            "inactive country identity failed for N=" .. tostring(count))
    end
end
updateAll()
`,
    0.75,
  )
  assert.equal(waiting.state.started, false)
  assert.equal(waiting.state.playerCount, 6)
  assert(isTrue(waiting.ui.startActive), 'Setup must expose the start action.')
  assert(isFalse(waiting.ui.advanceActive), 'Setup must hide the advance action.')
  assert.equal(waiting.ui.active, 'ARAVELL · TOMERIN · VEYRA\nKARSK · BELOVAR · NAMARRA')
  assert.match(waiting.ui.roster, /0 \/ 6 SEATED · 6 ACTIVE/)
  assert.match(
    waiting.ui.instruction,
    /Choose the active roster, sit in matching color seats, take only the active delegations' private cards, then enter dispatch and open the conference\./,
  )
  assert.equal(waiting.ui.startLabel, 'OPEN THE CONFERENCE')
  assert.deepEqual(waiting.seatAudit.missingActive, [
    'Blue (Aravell)',
    'Red (Tomerin)',
    'Green (Veyra)',
    'Yellow (Karsk)',
    'Purple (Belovar)',
    'Teal (Namarra)',
  ])
  assert.deepEqual(waiting.seatAudit.occupiedInactive, [])
  assert.equal(waiting.turns.effective, false)
  assert.deepEqual(waiting.turns.order, [])

  const setupSentinel = await snapshot(
    bridge,
    'seed progressed physical sentinels before testing load quarantine',
    `
local refugee = getObjectFromGUID(GUIDS.refugeeCounter)
if refugee then refugee.setValue(77) end
local turnMarker = getObjectFromGUID(GUIDS.turnMarker)
local phaseMarker = getObjectFromGUID(GUIDS.phaseMarker)
assert(turnMarker and phaseMarker, "load-quarantine fixture is missing a marker")
local turnPosition = turnMarker.getPosition()
local phasePosition = phaseMarker.getPosition()
turnMarker.setPosition({x = turnPosition.x + 3, y = turnPosition.y + 1, z = turnPosition.z - 2})
turnMarker.setRotation({x = 0, y = 137, z = 0})
phaseMarker.setPosition({x = phasePosition.x - 4, y = phasePosition.y + 1, z = phasePosition.z + 3})
phaseMarker.setRotation({x = 0, y = 223, z = 0})
`,
    0.75,
  )
  assert.equal(setupSentinel.state.started, false)
  assert.equal(setupSentinel.refugee, 77)

  const invalidSavePayloads = [
    ['invalid JSON', '{not-json'],
    ['JSON scalar', '42'],
    ['JSON array', '[]'],
    ['empty object', '{}'],
    ['partial object', '{"started":true}'],
    [
      'unknown field',
      '{"schemaVersion":1,"started":false,"playerCount":6,"dispatchCode":148802,"round":1,"phase":"briefing","chairIndex":1,"turnIndex":1,"turnMode":"native","endFromTurn":1,"unexpected":"unsafe"}',
    ],
    [
      'future schema',
      '{"schemaVersion":2,"started":false,"playerCount":6,"dispatchCode":148802,"round":1,"phase":"briefing","chairIndex":1,"turnIndex":1,"turnMode":"native","endFromTurn":1}',
    ],
    [
      'fractional persisted index',
      '{"schemaVersion":1,"started":true,"playerCount":2.5,"dispatchCode":148802,"round":3,"phase":"cabinet","chairIndex":1,"turnIndex":1,"turnMode":"native","endFromTurn":1}',
    ],
    [
      'versioned object missing endFromTurn',
      '{"schemaVersion":1,"started":true,"playerCount":2,"dispatchCode":148802,"round":3,"phase":"cabinet","chairIndex":1,"turnIndex":1,"turnMode":"native"}',
    ],
    [
      'persisted dispatch above UI maximum',
      '{"schemaVersion":1,"started":false,"playerCount":6,"dispatchCode":1000000000,"round":1,"phase":"briefing","chairIndex":1,"turnIndex":1,"turnMode":"native","endFromTurn":1}',
    ],
    [
      'unreachable briefing turn',
      '{"schemaVersion":1,"started":true,"playerCount":2,"dispatchCode":148802,"round":3,"phase":"briefing","chairIndex":1,"turnIndex":2,"turnMode":"native","endFromTurn":1}',
    ],
    [
      'impossible round chair',
      '{"schemaVersion":1,"started":true,"playerCount":2,"dispatchCode":148802,"round":3,"phase":"cabinet","chairIndex":2,"turnIndex":1,"turnMode":"native","endFromTurn":1}',
    ],
    [
      'impossible signed aftermath origin',
      '{"schemaVersion":1,"started":true,"playerCount":2,"dispatchCode":148802,"round":3,"phase":"ended","chairIndex":1,"turnIndex":1,"turnMode":"native","outcome":"signed","endFromPhase":"aftermath","endFromTurn":2}',
    ],
  ]
  let loadFaultQuarantine
  for (const [payloadLabel, rejectedSavePayload] of invalidSavePayloads) {
    loadFaultQuarantine = await snapshot(
      bridge,
      `${payloadLabel} saved state fails closed without physical mutation`,
      `
local rejected = [==[${rejectedSavePayload}]==]
onLoad(rejected)
assert(loadFault ~= nil, "invalid nonempty save did not enter load quarantine")
assert(onSave() == rejected, "invalid save payload was overwritten while quarantined")
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was unavailable for load-quarantine checks")
local signature = clockTurnSignature()
uiPlayerCount(hostPlayer, "2")
uiDispatch(hostPlayer, "999")
uiStartConference(hostPlayer)
uiAdvance(hostPlayer)
uiBack(hostPlayer)
uiFinishConference(hostPlayer)
controllerAdvance({color = hostPlayer.color})
controllerBack({color = hostPlayer.color})
hotkeyNext(hostPlayer.color)
hotkeyBack(hostPlayer.color)
onChat("!owe next", hostPlayer)
onChat("!owe back", hostPlayer)
onChat("!owe finish", hostPlayer)
onPlayerChangeColor(hostPlayer.color)
onPlayerConnect(hostPlayer)
onPlayerDisconnect(hostPlayer)
assert(clockTurnSignature() == signature, "load-quarantined user surface moved the clock")
assert(state.started == false and state.playerCount == 6 and state.dispatchCode == 148802,
    "load-quarantined user surface mutated safe setup state")
assert(seatRefreshPending == false, "load-quarantined player event scheduled a mutating refresh")
assert(commitConferenceStart(TURN_MODE_NATIVE, hostPlayer, auditSeats().fingerprint) == false,
    "direct conference-start helper bypassed load quarantine")
assert(#Turns.order == 0, "load quarantine exposed a serialized native turn order")
`,
      0.75,
    )
    assert.match(loadFaultQuarantine.loadFault, /invalid or from an unsupported future version/)
    assert.match(loadFaultQuarantine.status, /^LOAD BLOCKED/)
    assert.equal(loadFaultQuarantine.ui.phase, 'Reload a trusted untouched save')
    assert.equal(loadFaultQuarantine.ui.active, 'SCRIPTED MUTATION QUARANTINED')
    assert.equal(loadFaultQuarantine.ui.startLabel, 'LOAD BLOCKED')
    assert(isFalse(loadFaultQuarantine.ui.startInteractable))
    assert(isFalse(loadFaultQuarantine.ui.playerCountInteractable))
    assert(isFalse(loadFaultQuarantine.ui.dispatchInteractable))
    assert(isFalse(loadFaultQuarantine.ui.backInteractable))
    assert.equal(loadFaultQuarantine.controller.advance, 'LOAD BLOCKED')
    assert.equal(loadFaultQuarantine.turns.effective, false)
    assert.deepEqual(loadFaultQuarantine.turns.order, [])
    assert.deepEqual(
      loadFaultQuarantine.physical,
      setupSentinel.physical,
      `${payloadLabel} quarantine mutated counters, hands, deck order, or marker transforms.`,
    )
  }

  const loadFaultCleared = await snapshot(
    bridge,
    'empty trusted original payload clears load quarantine into operable pristine setup',
    `
onLoad("")
assert(loadFault == nil, "empty original payload did not clear load quarantine")
local saved = JSON.decode(onSave())
assert(saved.schemaVersion == SAVE_SCHEMA_VERSION, "supported save schema was not emitted")
assert(saved.started == false and saved.phase == "briefing", "safe setup did not serialize faithfully")
`,
    0.75,
  )
  assert.equal(loadFaultCleared.loadFault ?? null, null)
  assert.equal(loadFaultCleared.state.started, false)
  assert.equal(loadFaultCleared.ui.startLabel, 'OPEN THE CONFERENCE')
  assert(isTrue(loadFaultCleared.ui.startInteractable))
  assert(isTrue(loadFaultCleared.ui.playerCountInteractable))
  assert(isTrue(loadFaultCleared.ui.dispatchInteractable))

  const validSavedStateMigrations = await snapshot(
    bridge,
    'valid versioned, complete legacy, Manual, and ended clocks load and re-emit schema one',
    `
local legacy = [==[{"started":false,"playerCount":4,"dispatchCode":42,"round":1,"phase":"briefing","chairIndex":1,"turnIndex":1,"endFromTurn":1}]==]
onLoad(legacy)
assert(loadFault == nil and state.turnMode == TURN_MODE_NATIVE,
    "complete legacy setup did not migrate to Native schema")
local migrated = JSON.decode(onSave())
assert(migrated.schemaVersion == SAVE_SCHEMA_VERSION and migrated.playerCount == 4,
    "legacy setup did not re-emit schema one")
local manual = {
    schemaVersion = SAVE_SCHEMA_VERSION,
    started = true,
    playerCount = 2,
    dispatchCode = 42,
    round = 3,
    phase = "cabinet",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_MANUAL,
    endFromTurn = 1,
}
onLoad(JSON.encode(manual))
assert(loadFault == nil and state.started and state.turnMode == TURN_MODE_MANUAL,
    "valid Manual clock failed to load")
assert(nativeSeatResumeRequired == false, "Manual load acquired Native Resume quarantine")
local ended = {
    schemaVersion = SAVE_SCHEMA_VERSION,
    started = true,
    playerCount = 2,
    dispatchCode = 42,
    round = 6,
    phase = "ended",
    chairIndex = 2,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
    outcome = "rounds",
    endFromPhase = "aftermath",
    endFromTurn = 1,
}
onLoad(JSON.encode(ended))
assert(loadFault == nil and state.phase == "ended" and state.outcome == "rounds",
    "valid round-limit ending failed to load")
local setup = {
    schemaVersion = SAVE_SCHEMA_VERSION,
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
    endFromTurn = 1,
}
onLoad(JSON.encode(setup))
assert(loadFault == nil and not state.started, "valid setup did not restore after migration matrix")
`,
    0.75,
  )
  assert.equal(validSavedStateMigrations.loadFault ?? null, null)
  assert.equal(validSavedStateMigrations.state.started, false)
  assert.equal(validSavedStateMigrations.state.playerCount, 6)
  assert.equal(validSavedStateMigrations.ui.startLabel, 'OPEN THE CONFERENCE')

  const setupSeatRefreshGate = await snapshot(
    bridge,
    'stale setup seat audits cannot OPEN or confirm while seating is settling',
    `
uiPlayerCount(nil, "2")
liveTestSeatColors = {"Blue", "Red", "White"}
scheduleSeatRefresh()
assert(seatRefreshPending == true, "exact-seat arrival did not enter the setup refresh gate")
uiStartConference(nil)
uiStartConference(nil)
assert(commitConferenceStart(TURN_MODE_NATIVE, Player[liveTestHostColor], auditSeats().fingerprint) == false,
    "direct native OPEN bypassed the stale-seat gate")
assert(state.started == false and manualOpenArmed == false,
    "exact-seat arrival opened or armed setup before its fresh audit")

liveTestSeatColors = {"White"}
scheduleSeatRefresh()
uiStartConference(nil)
uiStartConference(nil)
assert(commitConferenceStart(TURN_MODE_MANUAL, Player[liveTestHostColor], auditSeats().fingerprint) == false,
    "direct manual OPEN bypassed the stale-seat gate")
assert(state.started == false and manualOpenArmed == false,
    "active-seat removal opened or armed setup before its fresh audit")

uiPlayerCount(nil, "6")
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(setupSeatRefreshGate.state.started, false)
  assert.equal(setupSeatRefreshGate.manualOpenArmed, false)
  assert.equal(setupSeatRefreshGate.ui.startLabel, 'OPEN THE CONFERENCE')
  assert(isTrue(setupSeatRefreshGate.ui.startInteractable))
  assert.deepEqual(
    setupSeatRefreshGate.physical,
    validSavedStateMigrations.physical,
    'Stale setup OPEN attempts mutated counters, hands, deck order, or marker transforms.',
  )

  const setupSeatRefreshVisible = await snapshot(
    bridge,
    'setup visibly disables OPEN while a fresh seat audit is pending',
    `
seatRefreshPending = true
updateUI()
`,
    0.1,
  )
  assert.equal(setupSeatRefreshVisible.ui.startLabel, 'SEATING SETTLING')
  assert(isFalse(setupSeatRefreshVisible.ui.startInteractable))
  assert.match(setupSeatRefreshVisible.ui.instruction, /Wait for the fresh seat audit/)
  assert.deepEqual(setupSeatRefreshVisible.physical, validSavedStateMigrations.physical)

  const unarmedSetupCallback = await snapshot(
    bridge,
    'direct setup helpers cannot bypass actor, fresh-audit, or Manual confirmation gates',
    `
seatRefreshPending = false
liveTestSeatColors = {"White"}
local audit = auditSeats()
recordSeatAudit(audit)
updateAll()
local hostPlayer = Player[liveTestHostColor]
assert(commitConferenceStart(TURN_MODE_MANUAL, hostPlayer, audit.fingerprint) == false,
    "unarmed direct Manual OPEN started the conference")
assert(commitConferenceStart(TURN_MODE_NATIVE, hostPlayer, audit.fingerprint) == false,
    "inexact direct Native OPEN started the conference")
assert(commitConferenceStart(TURN_MODE_MANUAL, nil, audit.fingerprint) == false,
    "actorless direct Manual OPEN started the conference")
`,
  )
  assert.equal(unarmedSetupCallback.state.started, false)
  assert.equal(unarmedSetupCallback.manualOpenArmed, false)
  assert.deepEqual(unarmedSetupCallback.physical, validSavedStateMigrations.physical)

  const firstManualArm = await snapshot(
    bridge,
    'first missing-seat OPEN press arms manual mode without mutating setup',
    `
seatRefreshPending = false
recordSeatAudit(auditSeats())
updateAll()
uiStartConference(nil)
`,
  )
  assert.equal(firstManualArm.state.started, false)
  assert.deepEqual(firstManualArm.state, setupSentinel.state, 'The warning press mutated persisted clock state.')
  assert.deepEqual(
    firstManualArm.physical,
    validSavedStateMigrations.physical,
    'The warning press mutated counters, hands, deck order, or clock-marker transforms.',
  )
  assert.equal(firstManualArm.manualOpenArmed, true)
  assert.equal(firstManualArm.ui.startLabel, 'CONFIRM MANUAL HOTSEAT')
  assert.match(firstManualArm.ui.startTooltip, /One operator controlling multiple countries is open information/)
  assert.equal(firstManualArm.refugee, 77, 'The warning press must not reset public counters.')
  assert.equal(firstManualArm.turns.effective, false)
  assert.deepEqual(firstManualArm.turns.order, [])

  const expiredManualArm = await snapshot(
    bridge,
    'manual-open confirmation expires without mutating setup',
    '',
    5.25,
  )
  assert.equal(expiredManualArm.state.started, false)
  assert.equal(expiredManualArm.manualOpenArmed, false)
  assert.equal(expiredManualArm.ui.startLabel, 'OPEN THE CONFERENCE')
  assert.equal(expiredManualArm.refugee, 77)

  const invalidatedManualArm = await snapshot(
    bridge,
    'dispatch change invalidates a pending manual-open confirmation',
    `
uiStartConference(nil)
assert(manualOpenArmed == true, "manual confirmation did not arm")
uiDispatch(nil, "148803")
`,
  )
  assert.equal(invalidatedManualArm.state.started, false)
  assert.equal(invalidatedManualArm.manualOpenArmed, false)
  assert.equal(invalidatedManualArm.state.dispatchCode, 148803)
  assert.equal(invalidatedManualArm.refugee, 77)

  const rosterInvalidatedManualArm = await snapshot(
    bridge,
    'roster change invalidates a pending manual-open confirmation',
    `
uiDispatch(nil, "148802")
uiPlayerCount(nil, "6")
uiStartConference(Player[liveTestHostColor])
assert(manualOpenArmed == true, "manual confirmation did not arm before roster change")
uiPlayerCount(nil, "5")
`,
  )
  assert.equal(rosterInvalidatedManualArm.state.started, false)
  assert.equal(rosterInvalidatedManualArm.state.playerCount, 5)
  assert.equal(rosterInvalidatedManualArm.manualOpenArmed, false)
  assert.equal(rosterInvalidatedManualArm.manualOpenSignature, undefined)
  assert.equal(rosterInvalidatedManualArm.ui.startLabel, 'OPEN THE CONFERENCE')
  assert.equal(rosterInvalidatedManualArm.refugee, 77)
  assert.deepEqual(
    rosterInvalidatedManualArm.physical,
    validSavedStateMigrations.physical,
    'Changing the setup roster while armed mutated physical state.',
  )

  const connectInvalidatedManualArm = await snapshot(
    bridge,
    'player connection invalidates a pending manual-open confirmation',
    `
uiPlayerCount(nil, "6")
uiStartConference(Player[liveTestHostColor])
assert(manualOpenArmed == true, "manual confirmation did not arm before player connection")
onPlayerConnect({color = "Grey", host = false, promoted = false})
`,
    0.75,
  )
  assert.equal(connectInvalidatedManualArm.state.started, false)
  assert.equal(connectInvalidatedManualArm.manualOpenArmed, false)
  assert.equal(connectInvalidatedManualArm.manualOpenSignature, undefined)
  assert.equal(connectInvalidatedManualArm.ui.startLabel, 'OPEN THE CONFERENCE')
  assert.equal(connectInvalidatedManualArm.refugee, 77)
  assert.deepEqual(
    connectInvalidatedManualArm.physical,
    validSavedStateMigrations.physical,
    'A player connection while armed mutated physical state.',
  )

  const disconnectInvalidatedManualArm = await snapshot(
    bridge,
    'player disconnection invalidates a pending manual-open confirmation',
    `
uiStartConference(Player[liveTestHostColor])
assert(manualOpenArmed == true, "manual confirmation did not arm before player disconnection")
onPlayerDisconnect({color = "Grey", host = false, promoted = false})
`,
    0.75,
  )
  assert.equal(disconnectInvalidatedManualArm.state.started, false)
  assert.equal(disconnectInvalidatedManualArm.manualOpenArmed, false)
  assert.equal(disconnectInvalidatedManualArm.manualOpenSignature, undefined)
  assert.equal(disconnectInvalidatedManualArm.ui.startLabel, 'OPEN THE CONFERENCE')
  assert.equal(disconnectInvalidatedManualArm.refugee, 77)
  assert.deepEqual(
    disconnectInvalidatedManualArm.physical,
    validSavedStateMigrations.physical,
    'A player disconnection while armed mutated physical state.',
  )

  const inactiveSeatPositioned = await snapshot(
    bridge,
    'country-color change invalidates manual confirmation and exposes an inactive-seat block',
    `
uiPlayerCount(nil, "2")
uiStartConference(nil)
assert(manualOpenArmed == true, "two-country manual confirmation did not arm")
liveTestSeatColors = {"Green", "White"}
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(inactiveSeatPositioned.state.started, false)
  assert.equal(inactiveSeatPositioned.manualOpenArmed, false)
  assert.deepEqual(inactiveSeatPositioned.seatAudit.occupiedInactive, ['Green (Veyra)'])
  assert.equal(inactiveSeatPositioned.ui.startLabel, 'FIX INACTIVE SEATING')

  const inactiveBlocked = await snapshot(
    bridge,
    'occupied inactive country color hard-blocks OPEN without resetting setup',
    'uiStartConference(nil)',
  )
  assert.equal(inactiveBlocked.state.started, false)
  assert.deepEqual(inactiveBlocked.state, inactiveSeatPositioned.state, 'The inactive-seat block mutated clock state.')
  assert.deepEqual(
    inactiveBlocked.physical,
    inactiveSeatPositioned.physical,
    'The inactive-seat block mutated counters, hands, deck order, or clock-marker transforms.',
  )
  assert.equal(inactiveBlocked.manualOpenArmed, false)
  assert.equal(inactiveBlocked.refugee, 77)
  assert.match(inactiveBlocked.ui.instruction, /Opening blocked: 1 inactive country seat is occupied/)
  assert.equal(inactiveBlocked.turns.effective, false)
  assert.deepEqual(inactiveBlocked.turns.order, [])

  const neutralRestored = await snapshot(
    bridge,
    'moving the operator back to a neutral observer color clears the inactive-seat block',
    `
liveTestSeatColors = {"White"}
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(neutralRestored.state.started, false)
  assert.deepEqual(neutralRestored.seatAudit.occupiedInactive, [])
  assert.equal(neutralRestored.ui.startLabel, 'OPEN THE CONFERENCE')

  const rearmedManual = await snapshot(
    bridge,
    'fresh missing-seat OPEN press re-arms after invalidation',
    `
uiPlayerCount(nil, "6")
uiDispatch(nil, "148802")
uiStartConference(Player[liveTestHostColor])
`,
  )
  assert.equal(rearmedManual.state.started, false)
  assert.equal(rearmedManual.manualOpenArmed, true)
  assert.equal(rearmedManual.ui.startLabel, 'CONFIRM MANUAL HOTSEAT')

  const opened = await snapshot(
    bridge,
    'a different authorized operator may confirm persistent manual hotseat and reset setup',
    `
local confirming_color = liveTestHostColor == "White" and "Grey" or "White"
local confirming_operator = {color = confirming_color, host = false, promoted = true}
assert(confirming_color ~= liveTestHostColor, "confirmation operator was not different")
assert(isHostOrPromoted(confirming_operator), "confirmation operator was not authorized")
uiStartConference(confirming_operator)
`,
  )
  assert.equal(opened.state.started, true)
  assert.equal(opened.state.turnMode, 'manual')
  assert.equal(opened.state.phase, 'briefing')
  assert.equal(opened.state.chairIndex, expectedChair(148802, 6))
  assert.equal(opened.refugee, 12)
  assert.equal(opened.turns.effective, false)
  assert.deepEqual(opened.turns.order, [])
  assert.equal(opened.manualOpenArmed, false)
  assert.match(opened.ui.active, /TABLE STEP/)
  assert.match(opened.ui.roster, /MANUAL/)
  assert(isFalse(opened.ui.finishActive), 'All-signed control must not appear during Briefing.')

  const controlBoundary = await snapshot(
    bridge,
    'save payload and chat authorization preserve the active conference',
    `
local unpromotedPlayer = {color = liveTestHostColor, host = false, promoted = false}
assert(not isHostOrPromoted(unpromotedPlayer), "authorization fixture was not unpromoted")
local ordinaryChatResult = onChat("ordinary table talk", unpromotedPlayer)
local deniedChatResult = onChat("!owe next", unpromotedPlayer)
state.steam_id = "must-not-persist"
state.unapprovedNested = {spectator = "must-not-persist"}
local persistedText = onSave()
local persisted = JSON.decode(persistedText)
state.steam_id = nil
state.unapprovedNested = nil
local allowedSavedKeys = {
    schemaVersion = true,
    started = true,
    playerCount = true,
    dispatchCode = true,
    round = true,
    phase = true,
    chairIndex = true,
    turnIndex = true,
    turnMode = true,
    outcome = true,
    endFromPhase = true,
    endFromTurn = true,
}
for key, value in pairs(persisted) do
    assert(allowedSavedKeys[key] == true, "onSave leaked an unapproved key: " .. tostring(key))
    assert(type(value) ~= "table", "onSave persisted a nested transient payload at " .. tostring(key))
end
assert(persisted.schemaVersion == SAVE_SCHEMA_VERSION, "onSave omitted the supported schema version")
assert(not string.find(persistedText, "steam", 1, true), "onSave persisted a Steam identity")
assert(not string.find(persistedText, "unapprovedNested", 1, true),
    "onSave shallow-copied an unapproved future state field")
assert(not string.find(persistedText, "spectator", 1, true), "onSave persisted a spectator identity")
assert(not string.find(persistedText, "seatRecovery", 1, true), "onSave persisted seat recovery state")
local beforeSignature = clockTurnSignature()
local beforeRefugee = getObjectFromGUID(GUIDS.refugeeCounter).getValue()
assert(commitConferenceStart(TURN_MODE_MANUAL, Player[liveTestHostColor], auditSeats().fingerprint) == false,
    "repeated direct OPEN reset a running conference")
assert(clockTurnSignature() == beforeSignature, "repeated direct OPEN changed the running clock")
assert(getObjectFromGUID(GUIDS.refugeeCounter).getValue() == beforeRefugee,
    "repeated direct OPEN reset a running public counter")
assert(ordinaryChatResult == true, "ordinary chat must pass through")
assert(deniedChatResult == false, "recognized commands must stay out of public chat")
assert(state.phase == "briefing", "an unpromoted seat advanced the conference")
assert(persisted.started == true, "started state was not persisted")
assert(persisted.playerCount == 6, "active roster was not persisted")
assert(persisted.dispatchCode == 148802, "dispatch code was not persisted")
assert(persisted.chairIndex == state.chairIndex, "chair was not persisted")
assert(persisted.turnMode == TURN_MODE_MANUAL, "manual hotseat mode was not persisted")
`,
  )
  assert.equal(controlBoundary.state.phase, 'briefing')
  assert.equal(controlBoundary.state.chairIndex, opened.state.chairIndex)
  assert.deepEqual(controlBoundary.physical, opened.physical)

  const cabinet = await snapshot(
    bridge,
    'manual-hotseat Cabinet opening keeps native Turns off and deals six private hands',
    'hotkeyNext(liveTestHostColor)',
    2.5,
  )
  assert.equal(cabinet.state.phase, 'cabinet')
  assert.equal(cabinet.state.turnIndex, 1)
  assert.equal(cabinet.state.turnMode, 'manual')
  assert.equal(cabinet.turns.effective, false)
  assert.deepEqual(cabinet.turns.order, [])
  assert.equal(cabinet.ui.advance, 'END CABINET TURN')
  assert.match(cabinet.ui.roster, /0 \/ 6 SEATED · 6 ACTIVE · MANUAL/)
  for (const country of ['aravell', 'tomerin', 'veyra', 'karsk', 'belovar', 'namarra']) {
    assert.equal(cabinet.handPolicies[country], 3, `${country} should receive three policy cards.`)
    assert.equal(cabinet.decks[country], 13, `${country} deck should retain thirteen cards.`)
  }

  const manualTurnEvent = await snapshot(
    bridge,
    'manual hotseat ignores native turn events without advancing or re-enabling',
    'onPlayerTurn({color = liveTestHostColor}, nil)',
  )
  assert.equal(manualTurnEvent.state.phase, 'cabinet')
  assert.equal(manualTurnEvent.state.turnIndex, 1)
  assert.equal(manualTurnEvent.turns.effective, false)
  assert.deepEqual(manualTurnEvent.turns.order, [])

  const crisis = await snapshot(
    bridge,
    'six Cabinet turns advance exactly once into Crisis Council',
    `
for index = 1, state.playerCount do
    assert(advanceClock(), "Cabinet test turn did not advance at index " .. tostring(index))
    syncingTurns = false
end
`,
  )
  assert.equal(crisis.state.phase, 'crisis')
  assert.equal(crisis.state.turnIndex, 1)
  assert.equal(crisis.ui.advance, 'SEAL COMMITMENT')

  const summit = await snapshot(
    bridge,
    'six Crisis turns advance exactly once into Peace Summit',
    `
for index = 1, state.playerCount do
    assert(advanceClock(), "Crisis test turn did not advance at index " .. tostring(index))
    syncingTurns = false
end
`,
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
  assert.equal(signed.turns.effective, false)
  assert.deepEqual(signed.turns.order, [])
  assert.equal(signed.ui.advance, 'CONFERENCE CLOSED')
  assert.match(signed.ui.active, /ACCORD COMPLETE/)

  const restored = await snapshot(bridge, 'Back restores the exact pre-ending Summit turn', 'stepBack()')
  assert.equal(restored.state.phase, 'summit')
  assert.equal(restored.state.turnIndex, 1)
  assert.equal(restored.state.outcome, undefined)

  const aftermath = await snapshot(
    bridge,
    'six Summit turns advance exactly once into the Aftermath table step',
    `
for index = 1, state.playerCount do
    assert(advanceClock(), "Summit test turn did not advance at index " .. tostring(index))
    syncingTurns = false
end
`,
  )
  assert.equal(aftermath.state.phase, 'aftermath')
  assert.equal(aftermath.turns.effective, false)
  assert.deepEqual(aftermath.turns.order, [])
  assert.equal(aftermath.ui.advance, 'NEXT ROUND')
  assert.match(aftermath.ui.active, /TABLE STEP/)

  const nextRound = await snapshot(bridge, 'Aftermath rotates the chair into Round 2 Briefing', 'advanceClock()')
  assert.equal(nextRound.state.round, 2)
  assert.equal(nextRound.state.phase, 'briefing')
  assert.equal(nextRound.state.chairIndex, (opened.state.chairIndex % 6) + 1)
  assert.match(nextRound.status, /Table step/)

  const overview = await snapshot(
    bridge,
    'chat Status and Overview commands preserve the clock state',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for chat checks")
onChat("!owe status", hostPlayer)
onChat("!owe view", hostPlayer)
`,
  )
  assert.equal(overview.state.round, 2)
  assert.equal(overview.state.phase, 'briefing')

  const collapsed = await snapshot(bridge, 'docket collapses without changing conference state', 'uiTogglePanel(nil)')
  assert.equal(collapsed.panelCollapsed, true)
  assert(isFalse(collapsed.ui.bodyActive))
  assert.equal(String(collapsed.ui.panelHeight), '70')
  assert.equal(collapsed.ui.collapseLabel, '+')

  const nativeRosterOpenMatrix = await snapshot(
    bridge,
    'exact-seat OPEN selects native mode and rotated order for every 2-6 country roster',
    `
local expectedOrders = {
    [2] = {"Blue", "Red"},
    [3] = {"Blue", "Red", "Green"},
    [4] = {"Red", "Green", "Yellow", "Blue"},
    [5] = {"Red", "Green", "Yellow", "Purple", "Blue"},
    [6] = {"Red", "Green", "Yellow", "Purple", "Teal", "Blue"},
}
for count = 2, 6 do
    state = {
        started = false,
        playerCount = count,
        dispatchCode = 148802,
        round = 1,
        phase = "briefing",
        chairIndex = 1,
        turnIndex = 1,
        turnMode = TURN_MODE_NATIVE,
    }
    disarmFinish()
    disarmManualOpen()
    clearNativeTurnSafety()
    liveTestSeatColors = {"White"}
    for index = 1, count do table.insert(liveTestSeatColors, SEAT_COLORS[COUNTRIES[index]]) end
    uiStartConference(Player[liveTestHostColor])
    assert(state.started == true, "exact-seat OPEN did not start N=" .. tostring(count))
    assert(state.turnMode == TURN_MODE_NATIVE, "exact-seat OPEN did not select native N=" .. tostring(count))
    assert(state.chairIndex == (count <= 3 and 1 or 2),
        "dispatch chair did not match the independent fixture for N=" .. tostring(count))
    local order = activeOrder()
    assert(#order == count, "native order length failed for N=" .. tostring(count))
    for index, expectedColor in ipairs(expectedOrders[count]) do
        assert(SEAT_COLORS[order[index]] == expectedColor,
            "rotated native order failed at N=" .. tostring(count) .. " index=" .. tostring(index))
    end
    assert(SEAT_COLORS[activeCountry()] == expectedOrders[count][1],
        "native current color failed for N=" .. tostring(count))
    state.phase = "cabinet"
    assert(nativeTurnsAllowed(), "exact-seat native action was not allowed for N=" .. tostring(count))
    state.phase = "briefing"
    if count < 6 then
        local inactiveColor = SEAT_COLORS[COUNTRIES[count + 1]]
        for _, expectedColor in ipairs(expectedOrders[count]) do
            assert(expectedColor ~= inactiveColor,
                "inactive country leaked into native order for N=" .. tostring(count))
        end

        state.started = false
        disarmManualOpen()
        table.insert(liveTestSeatColors, inactiveColor)
        uiStartConference(Player[liveTestHostColor])
        assert(state.started == false,
            "occupied inactive country opened the exact-seat fixture for N=" .. tostring(count))
    end
end
state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
liveTestSeatColors = {"White"}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
updateAll()
`,
    0.75,
  )
  assert.equal(nativeRosterOpenMatrix.state.started, false)
  assert.equal(nativeRosterOpenMatrix.state.playerCount, 6)
  assert.equal(nativeRosterOpenMatrix.state.turnMode, 'native')
  assert.equal(nativeRosterOpenMatrix.turns.effective, false)

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
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
panelCollapsed = false
uiPlayerCount(nil, "${playerCount}")
`,
    )
    assert.equal(rosterSetup.state.playerCount, playerCount)
    assert.equal(rosterSetup.ui.active, rosterNames.get(playerCount))
    assert.match(rosterSetup.ui.roster, new RegExp(`0 / ${playerCount} SEATED · ${playerCount} ACTIVE`))

    const rosterOpened = await snapshot(
      bridge,
      `${playerCount}-country manual start sets deterministic chair, counters, and setup lock`,
      `
uiStartConference(Player[liveTestHostColor])
uiStartConference(Player[liveTestHostColor])
uiPlayerCount(nil, "2")
`,
    )
    assert.equal(rosterOpened.state.playerCount, playerCount, 'Roster changes must lock after opening.')
    assert.equal(rosterOpened.state.chairIndex, expectedChair(148802, playerCount))
    assert.equal(rosterOpened.refugee, playerCount * 2)
    assert.match(rosterOpened.controller.status, new RegExp(`Round 1/6 · Briefing`))
    assert.equal(rosterOpened.controller.advance, 'BEGIN CABINET')
  }

  const nativeSeatPause = await snapshot(
    bridge,
    'native mode with missing active seats disables Turns and pauses every clock surface',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for seat-pause checks")
local function resetMissingSeatPause()
    state = {
        started = true,
        playerCount = 3,
        dispatchCode = 148802,
        round = 3,
        phase = "cabinet",
        chairIndex = 1,
        turnIndex = 1,
        turnMode = TURN_MODE_NATIVE,
    }
    disarmFinish()
    disarmManualOpen()
    clearNativeTurnSafety()
    panelCollapsed = false
    updateAll()
    syncingTurns = false
end
local surfaces = {
    function() uiAdvance(hostPlayer) end,
    function() uiBack(hostPlayer) end,
    function() controllerAdvance({color = hostPlayer.color}) end,
    function() controllerBack({color = hostPlayer.color}) end,
    function() hotkeyNext(hostPlayer.color) end,
    function() hotkeyBack(hostPlayer.color) end,
    function() onChat("!owe next", hostPlayer) end,
    function() onChat("!owe back", hostPlayer) end,
    function() onPlayerTurn(hostPlayer, nil) end,
    function() finishConference(hostPlayer.color) end,
}
for index, surface in ipairs(surfaces) do
    resetMissingSeatPause()
    local signature = clockTurnSignature()
    surface()
    assert(clockTurnSignature() == signature,
        "missing-seat surface advanced the clock at index " .. tostring(index))
end
`,
  )
  assert.equal(nativeSeatPause.state.phase, 'cabinet')
  assert.equal(nativeSeatPause.state.turnIndex, 1)
  assert.equal(nativeSeatPause.state.turnMode, 'native')
  assert.equal(nativeSeatPause.turns.effective, false)
  assert.deepEqual(nativeSeatPause.turns.order, [])
  assert.match(nativeSeatPause.ui.advance, /SEATING PAUSED/)
  assert(isFalse(nativeSeatPause.ui.backInteractable))
  assert.match(nativeSeatPause.ui.instruction, /Native Turns paused: 3 active seats are missing/)

  const syntheticNativeReady = await snapshot(
    bridge,
    'synthetic runtime native fixture enables the exact two-country order',
    `
nativeTestOriginalAuditSeats = auditSeats
nativeTestOriginalBroadcastToAll = broadcastToAll
nativeTestOriginalUpdateTurns = updateTurns
nativeTestOriginalDisableTurnsSafely = disableTurnsSafely
nativeTestOriginalSpectatorPlayers = spectatorPlayers
nativeTestOriginalAvailableSeatColors = availableSeatColors
nativeTestSeatColors = {"Blue", "Red", "White"}
nativeTestSpectators = {}
nativeTestAvailableSeatColors = {"White", "Brown", "Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple", "Pink"}
nativeTestFaultBroadcasts = 0
nativeTestTurns = {enable = false, order = {}, turnColor = nil}
auditSeats = function()
    return classifySeats(nativeTestSeatColors, state.playerCount)
end
spectatorPlayers = function()
    return nativeTestSpectators
end
availableSeatColors = function()
    return nativeTestAvailableSeatColors
end
broadcastToAll = function(message, color)
    if string.find(message or "", "Native End Turn paused after an unexpected turn event", 1, true) then
        nativeTestFaultBroadcasts = nativeTestFaultBroadcasts + 1
    end
    nativeTestOriginalBroadcastToAll(message, color)
end
updateTurns = function()
    local generation = beginTurnsSync()
    nativeTestTurns.enable = false
    nativeTestTurns.order = {}
    nativeTestTurns.turnColor = nil
    local signature = clockTurnSignature()
    if nativeTurnsAllowed() and nativeTurnFaultSignature ~= signature then
        for _, country in ipairs(activeOrder()) do
            table.insert(nativeTestTurns.order, SEAT_COLORS[country])
        end
        nativeTestTurns.turnColor = SEAT_COLORS[activeCountry()]
        nativeTestTurns.enable = true
    end
    finishTurnsSync(generation)
end
disableTurnsSafely = function()
    if #nativeTestTurns.order == 0 then return false end
    local generation = beginTurnsSync()
    nativeTestTurns.enable = false
    nativeTestTurns.order = {}
    nativeTestTurns.turnColor = nil
    finishTurnsSync(generation)
    return true
end
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 3,
    phase = "cabinet",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
lastSeatCountryFingerprint = nil
lastSeatExactActive = nil
updateAll()
`,
    0.75,
  )
  assert.equal(syntheticNativeReady.state.turnIndex, 1)
  assert.equal(syntheticNativeReady.turns.enable, true)
  assert.deepEqual(syntheticNativeReady.turns.order, ['Blue', 'Red'])
  assert.equal(syntheticNativeReady.turns.turnColor, 'Blue')

  const nativeReloadMissingRepair = await snapshot(
    bridge,
    'running Native load with one missing seat prioritizes the guarded repair action over Resume',
    `
local saved = onSave()
nativeTestSeatColors = {"Red", "White"}
nativeTestSpectators = {{
    steam_name = "Reload Repair Observer",
    steam_id = "reload-repair-observer",
    changeColor = function() end,
}}
onLoad(saved)
assert(nativeSeatResumeRequired == true, "running Native load lost its Resume quarantine")
assert(nativeTestTurns.enable == false and #nativeTestTurns.order == 0,
    "missing-seat load exposed Native Turns")
`,
    0.75,
  )
  assert.equal(nativeReloadMissingRepair.nativeSeatResumeRequired, true)
  assert.equal(nativeReloadMissingRepair.turns.effective, false)
  assert.match(nativeReloadMissingRepair.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)
  assert.match(nativeReloadMissingRepair.status, /SEATING PAUSED/)
  assert.doesNotMatch(nativeReloadMissingRepair.status, /RESUME REQUIRED/)
  assert.equal(nativeReloadMissingRepair.controller.advance, 'SEATING PAUSED')

  const nativeReloadInactiveRepair = await snapshot(
    bridge,
    'running Native load with an inactive country occupied stays visibly paused behind repair',
    `
local saved = onSave()
nativeTestSpectators = {}
nativeTestSeatColors = {"Blue", "Red", "Green", "White"}
onLoad(saved)
assert(nativeSeatResumeRequired == true, "inactive-seat load lost its Resume quarantine")
assert(nativeTestTurns.enable == false and #nativeTestTurns.order == 0,
    "inactive-seat load exposed Native Turns")
`,
    0.75,
  )
  assert.equal(nativeReloadInactiveRepair.nativeSeatResumeRequired, true)
  assert.equal(nativeReloadInactiveRepair.turns.effective, false)
  assert.equal(nativeReloadInactiveRepair.ui.advance, 'SEATING PAUSED')
  assert.match(nativeReloadInactiveRepair.ui.instruction, /inactive country seat is occupied/)
  assert.match(nativeReloadInactiveRepair.status, /SEATING PAUSED/)
  assert.equal(nativeReloadInactiveRepair.controller.advance, 'SEATING PAUSED')

  const nativeReloadQuarantine = await snapshot(
    bridge,
    'running Native onLoad synchronously empties stale Turns and reconstructs docket Resume',
    `
nativeTestSeatColors = {"Blue", "Red", "White"}
local saved = onSave()
local signature = clockTurnSignature()
nativeTestTurns.enable = true
nativeTestTurns.order = {"Blue", "Red"}
nativeTestTurns.turnColor = "Blue"
onLoad(saved)
assert(clockTurnSignature() == signature, "onLoad changed the saved conference clock")
assert(nativeSeatResumeRequired == true, "running Native onLoad did not reconstruct Resume quarantine")
assert(nativeResumeSettling == false, "onLoad confused reload quarantine with post-Resume settling")
assert(nativeTestTurns.enable == false and #nativeTestTurns.order == 0,
    "onLoad did not synchronously empty serialized Native Turns")
onPlayerTurn({color = "Red"}, {color = "Blue"})
assert(clockTurnSignature() == signature, "load-time platform callback advanced the clock")
`,
    0.75,
  )
  assert.equal(nativeReloadQuarantine.state.turnIndex, 1)
  assert.equal(nativeReloadQuarantine.nativeSeatResumeRequired, true)
  assert.equal(nativeReloadQuarantine.turns.effective, false)
  assert.equal(nativeReloadQuarantine.ui.advance, 'RESUME NATIVE TURNS')

  const nativeReloadResumed = await snapshot(
    bridge,
    'authorized reload Resume preserves the clock and restores Native order after settlement',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature and nativeResumeSettling == true,
    "reload Resume moved the clock or skipped settlement")
assert(finishNativeResumeSettlement(nativeResumeGeneration) == true,
    "reload Resume did not settle under exact seats")
assert(clockTurnSignature() == signature, "settled reload Resume moved the clock")
`,
    0.25,
  )
  assert.equal(nativeReloadResumed.nativeSeatResumeRequired, false)
  assert.equal(nativeReloadResumed.nativeResumeSettling, false)
  assert.deepEqual(nativeReloadResumed.turns.order, ['Blue', 'Red'])
  assert.equal(nativeReloadResumed.turns.turnColor, 'Blue')

  const nativeCoalescedSeatEvents = await snapshot(
    bridge,
    'coalesced stale exact seat-event audits conservatively latch same-clock Resume',
    `
local signature = clockTurnSignature()
assert(lastSeatExactActive == true, "coalesced-event fixture did not begin from exact seating")
onPlayerChangeColor("Grey")
onPlayerChangeColor("Blue")
assert(clockTurnSignature() == signature, "coalesced seat events moved the conference clock")
assert(nativeSeatResumeRequired == true,
    "coalesced stale/exact seat events hid the conservative Resume latch")
assert(nativeTestTurns.enable == false and #nativeTestTurns.order == 0,
    "coalesced seat events exposed Native Turns before a fresh Resume")
`,
    0.75,
  )
  assert.deepEqual(nativeCoalescedSeatEvents.state, nativeReloadResumed.state)
  assert.equal(nativeCoalescedSeatEvents.nativeSeatResumeRequired, true)
  assert.equal(nativeCoalescedSeatEvents.ui.advance, 'RESUME NATIVE TURNS')
  assert.equal(nativeCoalescedSeatEvents.turns.effective, false)

  const nativeCoalescedSeatEventsResumed = await snapshot(
    bridge,
    'authorized Resume clears a conservatively latched coalesced seat event without moving clock',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "coalesced-event Resume moved the clock")
assert(finishNativeResumeSettlement(nativeResumeGeneration) == true,
    "coalesced-event Resume did not settle under exact seats")
`,
    0.25,
  )
  assert.deepEqual(nativeCoalescedSeatEventsResumed.state, nativeReloadResumed.state)
  assert.equal(nativeCoalescedSeatEventsResumed.nativeSeatResumeRequired, false)
  assert.deepEqual(nativeCoalescedSeatEventsResumed.turns.order, ['Blue', 'Red'])

  const nativeInitialEvent = await snapshot(
    bridge,
    'native initial previous-player nil event is a strict no-op',
    'onPlayerTurn({color = "Blue"}, nil)',
  )
  assert.equal(nativeInitialEvent.state.phase, 'cabinet')
  assert.equal(nativeInitialEvent.state.turnIndex, 1)
  assert.equal(nativeInitialEvent.turns.enable, true)
  assert.deepEqual(nativeInitialEvent.turns.order, ['Blue', 'Red'])
  const nativeInitialGeneration = nativeInitialEvent.turnSyncGeneration

  const nativeHotseatFocusHandoff = await snapshot(
    bridge,
    'hotseat focus handoff to the already-active player is a strict no-op',
    'onPlayerTurn({color = "Blue"}, {color = "Red"})',
  )
  assert.equal(nativeHotseatFocusHandoff.state.phase, 'cabinet')
  assert.equal(nativeHotseatFocusHandoff.state.turnIndex, 1)
  assert.equal(nativeHotseatFocusHandoff.nativeTurnResyncSignature ?? null, null)
  assert.equal(nativeHotseatFocusHandoff.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeHotseatFocusHandoff.nativeFaultBroadcasts, 0)
  assert.equal(nativeHotseatFocusHandoff.turnSyncGeneration, nativeInitialGeneration)
  assert.equal(nativeHotseatFocusHandoff.turns.enable, true)
  assert.deepEqual(nativeHotseatFocusHandoff.turns.order, ['Blue', 'Red'])
  assert.equal(nativeHotseatFocusHandoff.turns.turnColor, 'Blue')

  const nativeRepeatedHotseatFocusHandoff = await snapshot(
    bridge,
    'repeated settled hotseat focus handoff remains a strict no-op',
    'onPlayerTurn({color = "Blue"}, {color = "Red"})',
  )
  assert.equal(nativeRepeatedHotseatFocusHandoff.state.phase, 'cabinet')
  assert.equal(nativeRepeatedHotseatFocusHandoff.state.turnIndex, 1)
  assert.equal(nativeRepeatedHotseatFocusHandoff.nativeTurnResyncSignature ?? null, null)
  assert.equal(nativeRepeatedHotseatFocusHandoff.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeRepeatedHotseatFocusHandoff.nativeFaultBroadcasts, 0)
  assert.equal(nativeRepeatedHotseatFocusHandoff.turnSyncGeneration, nativeInitialGeneration)
  assert.equal(nativeRepeatedHotseatFocusHandoff.turns.enable, true)
  assert.deepEqual(nativeRepeatedHotseatFocusHandoff.turns.order, ['Blue', 'Red'])
  assert.equal(nativeRepeatedHotseatFocusHandoff.turns.turnColor, 'Blue')

  const nativeMiddleTurn = await snapshot(
    bridge,
    'valid native middle turn advances exactly once',
    'onPlayerTurn({color = "Red"}, {color = "Blue"})',
    0.75,
  )
  assert.equal(nativeMiddleTurn.state.phase, 'cabinet')
  assert.equal(nativeMiddleTurn.state.turnIndex, 2)
  assert.equal(nativeMiddleTurn.turns.enable, true)
  assert.equal(nativeMiddleTurn.turns.turnColor, 'Red')
  assert.equal(nativeMiddleTurn.nativeTurnResyncSignature ?? null, null)
  assert.equal(nativeMiddleTurn.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeMiddleTurn.nativeFaultBroadcasts, 0)

  const nativeDelayedDuplicate = await snapshot(
    bridge,
    'delayed duplicate of the completed native turn is a strict no-op',
    'onPlayerTurn({color = "Red"}, {color = "Blue"})',
  )
  assert.equal(nativeDelayedDuplicate.state.phase, 'cabinet')
  assert.equal(nativeDelayedDuplicate.state.turnIndex, 2)
  assert.equal(nativeDelayedDuplicate.nativeTurnResyncSignature ?? null, null)
  assert.equal(nativeDelayedDuplicate.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeDelayedDuplicate.nativeFaultBroadcasts, 0)
  assert.equal(nativeDelayedDuplicate.turnSyncGeneration, nativeMiddleTurn.turnSyncGeneration)
  assert.equal(nativeDelayedDuplicate.turns.enable, true)
  assert.deepEqual(nativeDelayedDuplicate.turns.order, ['Blue', 'Red'])
  assert.equal(nativeDelayedDuplicate.turns.turnColor, 'Red')

  const nativePhaseBoundary = await snapshot(
    bridge,
    'valid final native turn advances the phase exactly once',
    'onPlayerTurn({color = "Blue"}, {color = "Red"})',
    0.75,
  )
  assert.equal(nativePhaseBoundary.state.phase, 'crisis')
  assert.equal(nativePhaseBoundary.state.turnIndex, 1)
  assert.equal(nativePhaseBoundary.turns.enable, true)
  assert.equal(nativePhaseBoundary.turns.turnColor, 'Blue')

  const nativeSurfaceRaces = await snapshot(
    bridge,
    'native and every forward control surface share one atomic transition gate in both orderings',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for native race checks")
local surfaces = {
    function() uiAdvance(hostPlayer) end,
    function() controllerAdvance({color = hostPlayer.color}) end,
    function() hotkeyNext(hostPlayer.color) end,
    function() onChat("!owe next", hostPlayer) end,
}
local function resetNativeRace()
    state = {
        started = true,
        playerCount = 2,
        dispatchCode = 148802,
        round = 3,
        phase = "cabinet",
        chairIndex = 1,
        turnIndex = 1,
        turnMode = TURN_MODE_NATIVE,
    }
    disarmFinish()
    clearNativeTurnSafety()
    updateAll()
    syncingTurns = false
end
for index, surface in ipairs(surfaces) do
    resetNativeRace()
    onPlayerTurn({color = "Red"}, {color = "Blue"})
    surface()
    assert(state.phase == "cabinet" and state.turnIndex == 2,
        "native-first race double-advanced surface " .. tostring(index))

    resetNativeRace()
    surface()
    onPlayerTurn({color = "Red"}, {color = "Blue"})
    assert(state.phase == "cabinet" and state.turnIndex == 2,
        "control-first race double-advanced surface " .. tostring(index))
end
`,
    0.25,
  )
  assert.equal(nativeSurfaceRaces.state.phase, 'cabinet')
  assert.equal(nativeSurfaceRaces.state.turnIndex, 2)

  const nativeDisarmsFinish = await snapshot(
    bridge,
    'native transition invalidates an armed all-signed confirmation',
    `
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 3,
    phase = "summit",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
clearNativeTurnSafety()
updateAll()
syncingTurns = false
finishConference()
assert(finishArmed == true, "all-signed confirmation did not arm")
onPlayerTurn({color = "Red"}, {color = "Blue"})
`,
    0.25,
  )
  assert.equal(nativeDisarmsFinish.state.phase, 'summit')
  assert.equal(nativeDisarmsFinish.state.turnIndex, 2)
  assert.equal(nativeDisarmsFinish.finishArmed, false)

  const nativeFaultPrepared = await snapshot(
    bridge,
    'prepare an exact-seat native turn for resync and fault-latch checks',
    `
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 3,
    phase = "cabinet",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
clearNativeTurnSafety()
nativeTestFaultBroadcasts = 0
nativeTestSeatColors = {"Blue", "Red", "White"}
updateAll()
`,
    0.75,
  )
  assert.equal(nativeFaultPrepared.turns.enable, true)

  const nativeResynced = await snapshot(
    bridge,
    'first unexpected native event performs one guarded resync without advancing',
    'onPlayerTurn({color = "Red"}, nil)',
    0.75,
  )
  assert.equal(nativeResynced.state.phase, 'cabinet')
  assert.equal(nativeResynced.state.turnIndex, 1)
  assert.equal(nativeResynced.nativeTurnResyncSignature, '3|cabinet|1|1')
  assert.equal(nativeResynced.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeResynced.nativeFaultBroadcasts, 0)
  assert.equal(nativeResynced.turns.enable, true)

  const nativeFaulted = await snapshot(
    bridge,
    'repeated unexpected native event latches one fail-closed fault',
    'onPlayerTurn({color = "Red"}, nil)',
    0.25,
  )
  assert.equal(nativeFaulted.state.phase, 'cabinet')
  assert.equal(nativeFaulted.state.turnIndex, 1)
  assert.equal(nativeFaulted.nativeTurnFaultSignature, '3|cabinet|1|1')
  assert.equal(nativeFaulted.nativeFaultBroadcasts, 1)
  assert.equal(nativeFaulted.turns.enable, false)
  assert.equal(nativeFaulted.turns.effective, false)
  assert.deepEqual(nativeFaulted.turns.order, [])

  const nativeFaultReplay = await snapshot(
    bridge,
    'latched native fault rejects repeated and valid-looking queued events without spam',
    `
onPlayerTurn({color = "Red"}, nil)
onPlayerTurn({color = "Red"}, {color = "Blue"})
onPlayerTurn({color = "Red"}, nil)
`,
    0.25,
  )
  assert.equal(nativeFaultReplay.state.phase, 'cabinet')
  assert.equal(nativeFaultReplay.state.turnIndex, 1)
  assert.equal(nativeFaultReplay.nativeTurnFaultSignature, '3|cabinet|1|1')
  assert.equal(nativeFaultReplay.nativeFaultBroadcasts, 1)
  assert.equal(nativeFaultReplay.turns.enable, false)
  assert.equal(nativeFaultReplay.turns.effective, false)
  assert.deepEqual(nativeFaultReplay.turns.order, [])

  const nativeFaultNeutralChurn = await snapshot(
    bridge,
    'neutral observer churn preserves the native fault latch',
    `
nativeTestSeatColors = {"Blue", "Red", "Grey"}
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(nativeFaultNeutralChurn.state.turnIndex, 1)
  assert.equal(nativeFaultNeutralChurn.nativeTurnFaultSignature, '3|cabinet|1|1')
  assert.equal(nativeFaultNeutralChurn.nativeFaultBroadcasts, 1)
  assert.equal(nativeFaultNeutralChurn.turns.enable, false)
  assert.equal(nativeFaultNeutralChurn.turns.effective, false)

  const nativeFaultSeatLoss = await snapshot(
    bridge,
    'active-seat loss disables native Turns synchronously and preserves the current fault',
    `
nativeTestSeatColors = {"Blue", "Grey"}
scheduleSeatRefresh()
assert(#nativeTestTurns.order == 0,
    "seat loss did not synchronously disable and clear native Turns")
`,
    0.75,
  )
  assert.equal(nativeFaultSeatLoss.state.turnIndex, 1)
  assert.equal(nativeFaultSeatLoss.nativeTurnFaultSignature, '3|cabinet|1|1')
  assert.equal(nativeFaultSeatLoss.seatAudit.exactActiveSeats, false)
  assert.equal(nativeFaultSeatLoss.turns.enable, false)
  assert.equal(nativeFaultSeatLoss.turns.effective, false)

  const nativeFaultSeatRestore = await snapshot(
    bridge,
    'late-settling ineligible-to-exact restoration clears the fault into an explicit same-clock resume latch',
    `
scheduleSeatRefresh()
Wait.frames(function()
    nativeTestSeatColors = {"Blue", "Red", "Grey"}
end, 1)
`,
    0.75,
  )
  assert.equal(nativeFaultSeatRestore.state.phase, 'cabinet')
  assert.equal(nativeFaultSeatRestore.state.turnIndex, 1)
  assert.equal(nativeFaultSeatRestore.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeFaultSeatRestore.nativeSeatResumeRequired, true)
  assert.equal(nativeFaultSeatRestore.turns.enable, false)
  assert.deepEqual(nativeFaultSeatRestore.turns.order, [])
  assert.equal(nativeFaultSeatRestore.ui.advance, 'RESUME NATIVE TURNS')
  assert.match(
    nativeFaultSeatRestore.ui.instruction,
    /Exact seating restored\..*RESUME NATIVE TURNS\..*clock stays fixed/,
  )
  assert(
    nativeFaultSeatRestore.ui.instruction.length <= 140,
    'Native Resume guidance is too long for the production instruction box.',
  )
  assert(isTrue(nativeFaultSeatRestore.ui.advanceInteractable))
  assert(isFalse(nativeFaultSeatRestore.ui.backInteractable))
  assert.equal(nativeFaultSeatRestore.controller.advance, 'RESUME IN DOCKET')

  const nativeRestorationQuarantine = await snapshot(
    bridge,
    'delayed platform callbacks and every non-docket clock adapter remain inert after both frame guards expire',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for resume-quarantine checks")
local signature = clockTurnSignature()
local surfaces = {
    function() advanceClock(hostPlayer.color) end,
    function() stepBack(hostPlayer.color) end,
    function() controllerAdvance({color = hostPlayer.color}) end,
    function() controllerBack({color = hostPlayer.color}) end,
    function() hotkeyNext(hostPlayer.color) end,
    function() hotkeyBack(hostPlayer.color) end,
    function() onChat("!owe next", hostPlayer) end,
    function() onChat("!owe back", hostPlayer) end,
    function() finishConference(hostPlayer.color) end,
    function() onPlayerTurn({color = "Red"}, {color = "Blue"}) end,
    function() onPlayerTurn({color = "Red"}, {color = "Blue"}) end,
}
for index, surface in ipairs(surfaces) do
    surface()
    assert(clockTurnSignature() == signature,
        "resume-quarantined surface advanced the clock at index " .. tostring(index))
    assert(nativeSeatResumeRequired == true,
        "resume-quarantined surface cleared the latch at index " .. tostring(index))
end
uiAdvance({color = hostPlayer.color, host = false, promoted = false})
assert(clockTurnSignature() == signature and nativeSeatResumeRequired == true,
    "unauthorized docket click resumed or advanced Native Turns")
assert(nativeTurnFaultSignature == nil, "quarantined platform callback created a native-turn fault")
`,
    0.25,
  )
  assert.deepEqual(nativeRestorationQuarantine.state, nativeFaultSeatRestore.state)
  assert.deepEqual(
    nativeRestorationQuarantine.physical,
    nativeFaultSeatRestore.physical,
    'Resume quarantine mutated counters, hands, deck order, or marker transforms.',
  )
  assert.equal(nativeRestorationQuarantine.nativeSeatResumeRequired, true)
  assert.equal(nativeRestorationQuarantine.turns.effective, false)

  const nativeResumeStarted = await snapshot(
    bridge,
    'authorized docket Resume re-audits exact seats and enters a no-clock-change quiet period',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "docket Resume moved the conference clock")
assert(nativeSeatResumeRequired == false, "docket Resume did not clear the transient latch")
assert(nativeResumeSettling == true, "docket Resume skipped its post-handoff quiet period")
local saved = onSave()
assert(not string.find(saved, "nativeSeatResume", 1, true),
    "transient resume latch leaked into onSave")
`,
    0.25,
  )
  assert.deepEqual(nativeResumeStarted.state, nativeFaultSeatRestore.state)
  assert.deepEqual(
    nativeResumeStarted.physical,
    nativeFaultSeatRestore.physical,
    'Docket Resume mutated counters, hands, deck order, or marker transforms.',
  )
  assert.equal(nativeResumeStarted.nativeSeatResumeRequired, false)
  assert.equal(nativeResumeStarted.nativeResumeSettling, true)
  assert.equal(nativeResumeStarted.turns.effective, false)
  assert.deepEqual(nativeResumeStarted.turns.order, [])
  assert.equal(nativeResumeStarted.ui.advance, 'RESUMING NATIVE TURNS')
  assert(isFalse(nativeResumeStarted.ui.advanceInteractable))
  assert.equal(nativeResumeStarted.controller.advance, 'NATIVE TURNS RESUMING')

  const nativeResumeQuietAttack = await snapshot(
    bridge,
    'normal-latency second click and delayed valid-looking callbacks remain inert after old frame guards expire',
    `
assert(syncingTurns == false, "old two-frame synchronization guard had not expired")
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
local originalGeneration = nativeResumeGeneration
assert(NATIVE_RESUME_QUIET_SECONDS == 1, "Native Resume quiet period is not one full second")
uiAdvance(hostPlayer)
onPlayerTurn({color = "Red"}, {color = "Blue"})
onPlayerTurn({color = "Red"}, {color = "Blue"})
assert(clockTurnSignature() == signature, "post-Resume quiet-period input advanced the clock")
assert(nativeResumeSettling == true, "delayed platform callback escaped or ended the quiet period")
assert(nativeResumeGeneration > originalGeneration,
    "delayed callbacks did not reschedule the callback-free quiet period")
local rescheduledGeneration = nativeResumeGeneration
assert(finishNativeResumeSettlement(originalGeneration) == false,
    "the original quiet-period timer completed after a delayed callback")
assert(nativeResumeSettling == true and nativeResumeGeneration == rescheduledGeneration,
    "stale quiet-period completion mutated the rescheduled handoff")
syncingTurns = true
local syncingGeneration = nativeResumeGeneration
onPlayerTurn({color = "Red"}, {color = "Blue"})
syncingTurns = false
assert(nativeResumeGeneration > syncingGeneration,
    "callback arriving during internal Turns synchronization was dropped instead of draining")
assert(clockTurnSignature() == signature, "synchronizing callback advanced the clock")
nativeTestLateResumeCallbackFired = false
Wait.time(function()
    nativeTestLateResumeCallbackFired = true
    onPlayerTurn({color = "Red"}, {color = "Blue"})
end, 0.6)
`,
    0.25,
  )
  assert.deepEqual(nativeResumeQuietAttack.state, nativeFaultSeatRestore.state)
  assert.deepEqual(nativeResumeQuietAttack.physical, nativeFaultSeatRestore.physical)
  assert.equal(nativeResumeQuietAttack.nativeResumeSettling, true)
  assert.equal(nativeResumeQuietAttack.turns.effective, false)

  const nativeResumePastOriginalDeadline = await snapshot(
    bridge,
    'rescheduled quiet period remains closed past the original one-second deadline',
    '',
    0.85,
  )
  assert.equal(nativeResumePastOriginalDeadline.nativeLateResumeCallbackFired, true)
  assert.deepEqual(nativeResumePastOriginalDeadline.state, nativeFaultSeatRestore.state)
  assert.deepEqual(nativeResumePastOriginalDeadline.physical, nativeFaultSeatRestore.physical)
  assert.equal(nativeResumePastOriginalDeadline.nativeResumeSettling, true)
  assert.equal(nativeResumePastOriginalDeadline.turns.effective, false)
  assert.deepEqual(nativeResumePastOriginalDeadline.turns.order, [])

  const nativeSeatResumed = await snapshot(
    bridge,
    'one full callback-free second completes Native Resume without moving clock or table state',
    '',
    0.75,
  )
  assert.deepEqual(nativeSeatResumed.state, nativeFaultSeatRestore.state)
  assert.deepEqual(nativeSeatResumed.physical, nativeFaultSeatRestore.physical)
  assert.equal(nativeSeatResumed.nativeSeatResumeRequired, false)
  assert.equal(nativeSeatResumed.nativeResumeSettling, false)
  assert.equal(nativeSeatResumed.turns.enable, true)
  assert.deepEqual(nativeSeatResumed.turns.order, ['Blue', 'Red'])
  assert.equal(nativeSeatResumed.turns.turnColor, 'Blue')
  assert.equal(nativeSeatResumed.ui.advance, 'END CABINET TURN')

  const nativeResumeColorEvent = await snapshot(
    bridge,
    'country-color event during Resume cancels settlement and preserves the same-clock latch',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
nativeSeatResumeRequired = true
updateAll()
uiAdvance(hostPlayer)
assert(nativeResumeSettling == true, "color-event fixture did not enter Resume settlement")
nativeTestSeatColors = {"Red", "Grey"}
onPlayerChangeColor("Grey")
assert(clockTurnSignature() == signature, "color event during Resume moved the clock")
assert(nativeResumeSettling == false and nativeSeatResumeRequired == true,
    "color event during Resume did not restore quarantine")
`,
    0.25,
  )
  assert.deepEqual(nativeResumeColorEvent.state, nativeSeatResumed.state)
  assert.equal(nativeResumeColorEvent.nativeSeatResumeRequired, true)
  assert.equal(nativeResumeColorEvent.nativeResumeSettling, false)
  assert.equal(nativeResumeColorEvent.turns.effective, false)
  assert.deepEqual(nativeResumeColorEvent.seatAudit.missingActive, ['Blue (Aravell)'])

  const nativeResumeConnectEvent = await snapshot(
    bridge,
    'connection event during restored-seat Resume cancels settlement even when the audit is exact',
    `
nativeTestSeatColors = {"Blue", "Red", "Grey"}
onPlayerChangeColor("Blue")
assert(nativeSeatResumeRequired == true, "exact restoration lost its Resume latch")
seatRefreshPending = false
seatRefreshGeneration = seatRefreshGeneration + 1
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(nativeResumeSettling == true, "connect-event fixture did not enter Resume settlement")
onPlayerConnect({color = "Grey", host = false, promoted = false})
assert(clockTurnSignature() == signature, "connection event during Resume moved the clock")
assert(nativeResumeSettling == false and nativeSeatResumeRequired == true,
    "connection event during Resume did not restore quarantine")
`,
    0.25,
  )
  assert.equal(nativeResumeConnectEvent.nativeSeatResumeRequired, true)
  assert.equal(nativeResumeConnectEvent.nativeResumeSettling, false)
  assert.equal(nativeResumeConnectEvent.seatAudit.exactActiveSeats, true)
  assert.equal(nativeResumeConnectEvent.turns.effective, false)

  const nativeResumeDisconnectEvent = await snapshot(
    bridge,
    'disconnection event during exact-seat Resume also restores quarantine without moving clock',
    `
seatRefreshPending = false
seatRefreshGeneration = seatRefreshGeneration + 1
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(nativeResumeSettling == true, "disconnect-event fixture did not enter Resume settlement")
onPlayerDisconnect({color = "Grey", host = false, promoted = false})
assert(clockTurnSignature() == signature, "disconnection event during Resume moved the clock")
assert(nativeResumeSettling == false and nativeSeatResumeRequired == true,
    "disconnection event during Resume did not restore quarantine")
`,
    0.25,
  )
  assert.equal(nativeResumeDisconnectEvent.nativeSeatResumeRequired, true)
  assert.equal(nativeResumeDisconnectEvent.nativeResumeSettling, false)
  assert.equal(nativeResumeDisconnectEvent.turns.effective, false)

  const nativeResumeAfterSeatEvents = await snapshot(
    bridge,
    'fresh Resume after color, connection, and disconnection events settles at the unchanged clock',
    `
seatRefreshPending = false
seatRefreshGeneration = seatRefreshGeneration + 1
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "post-seat-event Resume moved the clock")
`,
    1.25,
  )
  assert.deepEqual(nativeResumeAfterSeatEvents.state, nativeSeatResumed.state)
  assert.deepEqual(nativeResumeAfterSeatEvents.physical, nativeSeatResumed.physical)
  assert.equal(nativeResumeAfterSeatEvents.nativeSeatResumeRequired, false)
  assert.equal(nativeResumeAfterSeatEvents.nativeResumeSettling, false)
  assert.deepEqual(nativeResumeAfterSeatEvents.turns.order, ['Blue', 'Red'])

  const nativeFirstEndAfterResume = await snapshot(
    bridge,
    'first valid-looking post-settlement native transition advances exactly once',
    'onPlayerTurn({color = "Red"}, {color = "Blue"})',
    0.25,
  )
  assert.equal(nativeFirstEndAfterResume.state.phase, 'cabinet')
  assert.equal(nativeFirstEndAfterResume.state.turnIndex, 2)
  assert.equal(nativeFirstEndAfterResume.nativeSeatResumeRequired, false)
  assert.equal(nativeFirstEndAfterResume.turns.enable, true)
  assert.equal(nativeFirstEndAfterResume.turns.turnColor, 'Red')

  const nativeFirstEndDuplicate = await snapshot(
    bridge,
    'duplicate of the first post-Resume End Turn remains a strict no-op',
    'onPlayerTurn({color = "Red"}, {color = "Blue"})',
  )
  assert.equal(nativeFirstEndDuplicate.state.turnIndex, 2)
  assert.equal(nativeFirstEndDuplicate.nativeTurnFaultSignature ?? null, null)

  const nativeFaultRearmed = await snapshot(
    bridge,
    'fresh unexpected event after restoration gets one new resync',
    `
state.turnIndex = 1
clearNativeTurnSafety()
updateAll()
syncingTurns = false
onPlayerTurn({color = "Red"}, nil)
`,
    0.75,
  )
  assert.equal(nativeFaultRearmed.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeFaultRearmed.turns.enable, true)

  const nativeFaultRelatched = await snapshot(
    bridge,
    'second fresh unexpected event re-latches exactly one new fault',
    'onPlayerTurn({color = "Red"}, nil)',
    0.75,
  )
  assert.equal(nativeFaultRelatched.nativeTurnFaultSignature, '3|cabinet|1|1')
  assert.equal(nativeFaultRelatched.nativeFaultBroadcasts, 2)
  assert.equal(nativeFaultRelatched.turns.enable, false)
  assert.equal(nativeFaultRelatched.turns.effective, false)

  const nativeFaultClockRecovery = await snapshot(
    bridge,
    'one conference-clock transition clears a native fault and retries at the next state',
    'advanceClock()',
    0.75,
  )
  assert.equal(nativeFaultClockRecovery.state.phase, 'cabinet')
  assert.equal(nativeFaultClockRecovery.state.turnIndex, 2)
  assert.equal(nativeFaultClockRecovery.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeFaultClockRecovery.turns.enable, true)
  assert.equal(nativeFaultClockRecovery.turns.turnColor, 'Red')

  const nativeInactiveSeatPause = await snapshot(
    bridge,
    'occupied inactive country seat immediately pauses native Turns without advancing',
    `
nativeTestSeatColors = {"Blue", "Red", "Green", "Grey"}
scheduleSeatRefresh()
assert(#nativeTestTurns.order == 0,
    "inactive seat did not synchronously disable and clear native Turns")
`,
    0.75,
  )
  assert.equal(nativeInactiveSeatPause.state.phase, 'cabinet')
  assert.equal(nativeInactiveSeatPause.state.turnIndex, 2)
  assert.deepEqual(nativeInactiveSeatPause.seatAudit.occupiedInactive, ['Green (Veyra)'])
  assert.equal(nativeInactiveSeatPause.turns.enable, false)
  assert.equal(nativeInactiveSeatPause.turns.effective, false)
  assert.match(nativeInactiveSeatPause.ui.instruction, /Seating paused: 1 inactive country seat is occupied/)

  const nativeInactiveSeatRestore = await snapshot(
    bridge,
    'removing the inactive occupant preserves the clock behind the explicit resume latch',
    `
nativeTestSeatColors = {"Blue", "Red", "Grey"}
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(nativeInactiveSeatRestore.state.phase, 'cabinet')
  assert.equal(nativeInactiveSeatRestore.state.turnIndex, 2)
  assert.equal(nativeInactiveSeatRestore.nativeSeatResumeRequired, true)
  assert.equal(nativeInactiveSeatRestore.turns.enable, false)
  assert.deepEqual(nativeInactiveSeatRestore.turns.order, [])
  assert.equal(nativeInactiveSeatRestore.ui.advance, 'RESUME NATIVE TURNS')

  const nativeInactiveSeatResumed = await snapshot(
    bridge,
    'docket Resume after inactive-seat repair preserves the table and current delegation',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "inactive-seat Resume moved the clock")
`,
    1.25,
  )
  assert.deepEqual(nativeInactiveSeatResumed.state, nativeInactiveSeatRestore.state)
  assert.deepEqual(nativeInactiveSeatResumed.physical, nativeInactiveSeatRestore.physical)
  assert.equal(nativeInactiveSeatResumed.nativeSeatResumeRequired, false)
  assert.equal(nativeInactiveSeatResumed.turns.enable, true)
  assert.equal(nativeInactiveSeatResumed.turns.turnColor, 'Red')

  const nativeSeatRecoveryAnonymous = await snapshot(
    bridge,
    'anonymous or unlabelled Grey spectators never expose an automatic private-seat grant',
    `
clearNativeTurnSafety()
nativeTestSeatColors = {"Red", "White"}
nativeTestAvailableSeatColors = {"Blue", "Red", "White"}
nativeTestSpectatorChangeCalls = 0
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for anonymous-recovery checks")
local signature = clockTurnSignature()
local anonymousCases = {
    {steam_name = "", steam_id = ""},
    {steam_name = string.char(0x200B, 0xFE0F), steam_id = "hidden-name-account"},
    {steam_name = "Visible Observer", steam_id = ""},
}
for _, candidate in ipairs(anonymousCases) do
    nativeTestSpectators = {{
        steam_name = candidate.steam_name,
        steam_id = candidate.steam_id,
        changeColor = function()
            nativeTestSpectatorChangeCalls = nativeTestSpectatorChangeCalls + 1
        end,
    }}
    disarmSeatRecovery()
    assert(nativeSeatRecoveryContext(auditSeats()) == nil,
        "anonymous or unlabelled spectator exposed an automatic seat grant")
    uiAdvance(hostPlayer)
    uiAdvance(hostPlayer)
    assert(seatRecoveryArmedSignature == nil,
        "anonymous or unlabelled spectator armed a private-seat assignment")
end
assert(nativeTestSpectatorChangeCalls == 0,
    "anonymous or unlabelled spectator received a private-seat assignment")
assert(clockTurnSignature() == signature, "anonymous seat-recovery rejection moved the clock")
assert(nativeSeatRecoveryIdentity({steam_name = "c", steam_id = "a|b"}) ~=
    nativeSeatRecoveryIdentity({steam_name = "b|c", steam_id = "a"}),
    "seat-recipient identity token permitted delimiter collisions")
recordSeatAudit(auditSeats())
updateAll()
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryAnonymous.state.phase, 'cabinet')
  assert.equal(nativeSeatRecoveryAnonymous.state.turnIndex, 2)
  assert.equal(nativeSeatRecoveryAnonymous.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryAnonymous.turns.effective, false)
  assert.equal(nativeSeatRecoveryAnonymous.ui.advance, 'SEATING PAUSED')
  assert.match(
    nativeSeatRecoveryAnonymous.ui.instruction,
    /ASSIGN needs one named Grey with a Steam account\..*TTS Change Color/,
  )
  assert(
    nativeSeatRecoveryAnonymous.ui.instruction.length <= 180,
    'Ineligible seat-recovery guidance is too long for the production instruction box.',
  )
  assert.deepEqual(
    nativeSeatRecoveryAnonymous.physical,
    nativeInactiveSeatResumed.physical,
    'Anonymous seat-recovery rejection mutated the tactile table.',
  )

  const nativeSeatRecoveryReady = await snapshot(
    bridge,
    'fresh settled audit exposes only the eligible identified and named Grey assignment',
    `
nativeTestSeatColors = {"Red", "White"}
nativeTestSpectatorChangeCalls = 0
nativeTestSpectatorTarget = nil
nativeTestSpectators = {{
    steam_name = "<Aravell>\\nTester",
    steam_id = "hotseat-aravell",
    changeColor = function(color)
        nativeTestSpectatorChangeCalls = nativeTestSpectatorChangeCalls + 1
        nativeTestSpectatorTarget = color
    end,
}}
nativeTestUnicodeLabel =
    concisePlayerName({steam_name = "观察者观察者观察者观察者观察者观察者观察者观察者观察者观察者"})
local liveTestEmoji = string.char(0xD83D, 0xDE00)
nativeTestEmojiLabel =
    concisePlayerName({steam_name = "AAAAAAAAAAAAAAAAAAAAAAAA" .. liveTestEmoji .. "BCDEFG"})
nativeTestEmojiScalarSafe =
    #nativeTestEmojiLabel == 29 and
    string.unicode(nativeTestEmojiLabel, 25) == 0xD83D and
    string.unicode(nativeTestEmojiLabel, 26) == 0xDE00 and
    string.sub(nativeTestEmojiLabel, 27, 29) == "..."
nativeTestMalformedLabel = concisePlayerName({
    steam_name = "A" .. string.char(0xD83D) .. "B" .. string.char(0xDE00) .. "C",
})
nativeTestHiddenFormatLabel = concisePlayerName({
    steam_name = "A" .. string.char(0x2028) .. "B" .. string.char(0x202E) ..
        "C" .. string.char(0x200B) .. "D",
})
nativeTestBlankUnicodeSpaceLabel = concisePlayerName({
    steam_name = string.char(0xA0, 0x1680, 0x2000, 0x202F, 0x205F, 0x3000),
})
local supplementaryVariationSelector = string.char(0xDB40, 0xDD00)
local supplementaryReservedIgnorable = string.char(0xDB40, 0xDE00)
nativeTestBlankDefaultIgnorableLabel = concisePlayerName({
    steam_name = string.char(
        0x115F, 0x17B4, 0x180F, 0x3164, 0xFE0F, 0xFFA0, 0xFFF0
    ) .. supplementaryVariationSelector .. supplementaryReservedIgnorable,
})
nativeTestMarkupLabel =
    concisePlayerName({steam_name = "[b]\\n<Seat>\\t[/b]"})
assert(playerAtColor("Grey") == nativeTestSpectators[1],
    "sole Grey spectator did not resolve through the v14.2-safe player adapter")
scheduleSeatRefresh()
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryReady.seatRefreshPending, false)
  assert.match(nativeSeatRecoveryReady.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)
  assert(isTrue(nativeSeatRecoveryReady.ui.advanceInteractable))

  const nativeSeatRecoveryArmed = await snapshot(
    bridge,
    'single Grey spectator assignment rejects non-actors and arms for an authorized docket click without mutation',
    `
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for seat-recovery checks")
uiAdvance(nil)
assert(seatRecoveryArmedSignature == nil, "nil actor armed a private-seat assignment")
uiAdvance({color = hostPlayer.color, host = false, promoted = false})
assert(seatRecoveryArmedSignature == nil, "unauthorized actor armed a private-seat assignment")
local revokedOperator = {color = hostPlayer.color, host = false, promoted = true}
uiAdvance(revokedOperator)
assert(seatRecoveryArmedSignature ~= nil, "promoted operator did not arm the assignment")
revokedOperator.promoted = false
uiAdvance(revokedOperator)
assert(nativeTestSpectatorChangeCalls == 0,
    "operator whose promotion was revoked confirmed a private-seat grant")
disarmSeatRecovery()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "arming seat recovery moved the clock")
assert(nativeTestSpectatorChangeCalls == 0, "arming seat recovery changed a spectator")
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryArmed.state.phase, 'cabinet')
  assert.equal(nativeSeatRecoveryArmed.state.turnIndex, 2)
  assert.equal(nativeSeatRecoveryArmed.turns.effective, false)
  assert.equal(nativeSeatRecoveryArmed.seatRecoveryArmedSignature, 'armed')
  assert.match(nativeSeatRecoveryArmed.ui.advance, /CONFIRM ASSIGN\s+ARAVELL \/ BLUE/)
  assert.match(nativeSeatRecoveryArmed.ui.instruction, /Confirm assigning Aravell Tester as Blue \(Aravell\)/)
  assert.match(nativeSeatRecoveryArmed.ui.advanceTooltip, /only Grey spectator, Aravell Tester/)
  assert(isTrue(nativeSeatRecoveryArmed.ui.advanceInteractable))
  assert.equal(
    nativeSeatRecoveryArmed.nativeUnicodeLabel,
    '观察者观察者观察者观察者观察者观察者观察者观察者观...',
    'Long Unicode spectator name was not truncated at a complete code point.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeEmojiScalarSafe,
    true,
    'Long spectator name split an emoji surrogate pair inside MoonSharp.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeMalformedLabel,
    'A?B?C',
    'Malformed isolated surrogates reached UI labels.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeHiddenFormatLabel,
    'A B C D',
    'Hidden line, bidi, or zero-width formatting survived label sanitization.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeBlankUnicodeSpaceLabel,
    'Grey spectator',
    'Unicode-only blank spectator name bypassed the safe fallback label.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeBlankDefaultIgnorableLabel,
    'Grey spectator',
    'Default-ignorable or display-filler spectator name bypassed the safe fallback label.',
  )
  assert.equal(
    nativeSeatRecoveryArmed.nativeMarkupLabel,
    'b Seat /b',
    'Markup delimiters or mixed controls survived spectator-name sanitization.',
  )
  assert.deepEqual(
    nativeSeatRecoveryArmed.physical,
    nativeInactiveSeatResumed.physical,
    'Arming private-seat assignment mutated counters, hands, deck order, or marker transforms.',
  )

  for (const [eventLabel, eventCommand] of [
    ['color change', 'onPlayerChangeColor("Grey")'],
    ['player connection', 'onPlayerConnect({color = "Grey", host = false, promoted = false})'],
    ['player disconnection', 'onPlayerDisconnect({color = "Grey", host = false, promoted = false})'],
  ]) {
    const invalidated = await snapshot(
      bridge,
      `${eventLabel} synchronously invalidates an armed private-seat assignment`,
      `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
if seatRecoveryArmedSignature == nil then uiAdvance(hostPlayer) end
assert(seatRecoveryArmedSignature ~= nil, "seat assignment was not armed before ${eventLabel}")
local signature = clockTurnSignature()
${eventCommand}
assert(seatRecoveryArmedSignature == nil, "${eventLabel} left a stale seat grant armed")
assert(clockTurnSignature() == signature, "${eventLabel} moved the conference clock")
`,
      0.25,
    )
    assert.equal(invalidated.seatRecoveryArmedSignature ?? null, null)
    assert.equal(invalidated.state.turnIndex, 2)
    assert.deepEqual(
      invalidated.physical,
      nativeInactiveSeatResumed.physical,
      `${eventLabel} invalidation mutated table state.`,
    )
  }

  const nativeSeatRecoveryStaleTimer = await snapshot(
    bridge,
    'stale confirmation timer cannot disarm a fresh private-seat assignment',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
SEAT_RECOVERY_CONFIRM_SECONDS = 0.05
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature ~= nil, "short-lived seat assignment did not arm")
disarmSeatRecovery()
SEAT_RECOVERY_CONFIRM_SECONDS = 5
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature ~= nil, "fresh seat assignment did not re-arm")
`,
    0.2,
  )
  assert.equal(nativeSeatRecoveryStaleTimer.seatRecoveryArmedSignature, 'armed')

  const nativeSeatRecoveryArmExpired = await snapshot(
    bridge,
    'fresh private-seat confirmation expires without changing clock or table',
    '',
    5.25,
  )
  assert.equal(nativeSeatRecoveryArmExpired.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryArmExpired.state.turnIndex, 2)
  assert.deepEqual(nativeSeatRecoveryArmExpired.physical, nativeInactiveSeatResumed.physical)

  const nativeSeatRecoveryEventlessExact = await snapshot(
    bridge,
    'eventless exact seating between ASSIGN presses becomes Resume and never advances the clock',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
nativeTestSeatColors = {"Red", "White"}
nativeTestSpectators = {{
    steam_name = "Eventless Observer",
    steam_id = "observer-eventless",
    changeColor = function() error("eventless exact fixture should not call changeColor") end,
}}
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature ~= nil, "eventless exact fixture did not arm ASSIGN")
nativeTestSeatColors = {"Blue", "Red", "White"}
nativeTestSpectators = {}
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "eventless exact second ASSIGN press advanced the clock")
assert(nativeSeatResumeRequired == true, "eventless exact seating did not enter Resume quarantine")
assert(#nativeTestTurns.order == 0, "eventless exact seating enabled Native Turns")
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryEventlessExact.state.turnIndex, 2)
  assert.equal(nativeSeatRecoveryEventlessExact.nativeSeatResumeRequired, true)
  assert.equal(nativeSeatRecoveryEventlessExact.ui.advance, 'RESUME NATIVE TURNS')
  assert.equal(nativeSeatRecoveryEventlessExact.turns.effective, false)
  assert.deepEqual(nativeSeatRecoveryEventlessExact.physical, nativeInactiveSeatResumed.physical)

  const nativeSeatRecoveryIdentitySwap = await snapshot(
    bridge,
    'spectator identity swap invalidates the armed assignment before any private-seat grant',
    `
clearNativeTurnSafety()
nativeTestSeatColors = {"Red", "White"}
recordSeatAudit(auditSeats())
nativeTestSpectators = {{
    steam_name = "Original Observer",
    steam_id = "observer-original",
    changeColor = function() error("original observer was assigned after replacement") end,
}}
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for identity-swap checks")
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature ~= nil, "identity-swap fixture did not arm the original spectator")
nativeTestSpectators = {{
    steam_name = "Different Observer",
    steam_id = "observer-different",
    changeColor = function() error("stale assignment used the replacement spectator") end,
}}
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "identity-swap rejection moved the clock")
assert(nativeTestSpectatorChangeCalls == 0, "identity-swap rejection changed a spectator")
assert(seatRecoveryArmedSignature == nil,
    "stale confirmation click armed the replacement identity without a fresh review")
`,
    0.25,
  )
  assert.match(nativeSeatRecoveryIdentitySwap.ui.instruction, /Different Observer/)
  assert.match(nativeSeatRecoveryIdentitySwap.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)

  const nativeSeatRecoveryConfirmed = await snapshot(
    bridge,
    'freshly revalidated assignment targets the exact missing color once and blocks rapid repeats or turn callbacks',
    `
nativeTestSpectators = {{
    steam_name = "<Aravell>\\nTester",
    steam_id = "hotseat-aravell",
    changeColor = function(color)
        nativeTestSpectatorChangeCalls = nativeTestSpectatorChangeCalls + 1
        nativeTestSpectatorTarget = color
    end,
}}
nativeTestRecoveryBroadcastFallbacks = 0
nativeTestRecoveryTargetedAttempts = 0
nativeTestRecoveryThrownFallbacks = 0
nativeTestRecoveryThrownTargetedAttempts = 0
local originalBroadcastToColor = broadcastToColor
local originalBroadcastToAll = broadcastToAll
local originalPlayerAtColor = playerAtColor
broadcastToColor = function(message, color, tint)
    if string.find(message, "TTS is assigning", 1, true) then
        nativeTestRecoveryTargetedAttempts = nativeTestRecoveryTargetedAttempts + 1
        return
    end
    if string.find(message, "occupied recipient probe", 1, true) then
        nativeTestRecoveryThrownTargetedAttempts = nativeTestRecoveryThrownTargetedAttempts + 1
        error("injected occupied-recipient delivery failure")
    end
    return originalBroadcastToColor(message, color, tint)
end
broadcastToAll = function(message, tint)
    if string.find(message, "TTS is assigning", 1, true) then
        nativeTestRecoveryBroadcastFallbacks = nativeTestRecoveryBroadcastFallbacks + 1
        return
    end
    if string.find(message, "occupied recipient probe", 1, true) then
        nativeTestRecoveryThrownFallbacks = nativeTestRecoveryThrownFallbacks + 1
        return
    end
    return originalBroadcastToAll(message, tint)
end
playerAtColor = function(color)
    if color == "Blue" then return nil end
    return originalPlayerAtColor(color)
end
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local assignmentOk, assignmentError = pcall(function()
    uiAdvance(hostPlayer)
    assert(nativeTestSpectatorChangeCalls == 0,
        "changed spectator before the replacement identity was re-armed")
    local confirmingColor = hostPlayer.color == "Brown" and "Orange" or "Brown"
    assert(confirmingColor ~= hostPlayer.color, "assignment confirmer did not differ from the arming actor")
    local confirmingOperator = {color = confirmingColor, host = false, promoted = true}
    uiAdvance(confirmingOperator)
end)
playerAtColor = originalPlayerAtColor
playerAtColor = function(color)
    if color == "Blue" then return {seated = true} end
    return originalPlayerAtColor(color)
end
local occupiedOutcomeOk, occupiedOutcomeError = pcall(function()
    broadcastSeatRecoveryOutcome("occupied recipient probe", "Blue", {1, 1, 1})
end)
playerAtColor = originalPlayerAtColor
broadcastToColor = originalBroadcastToColor
broadcastToAll = originalBroadcastToAll
assert(assignmentOk, "post-assignment notification escaped its fallback: " .. tostring(assignmentError))
assert(occupiedOutcomeOk,
    "occupied-recipient notification escaped its fallback: " .. tostring(occupiedOutcomeError))
assert(clockTurnSignature() == signature, "confirmed seat recovery moved the clock")
assert(nativeTestSpectatorChangeCalls == 1, "confirmed seat recovery did not change exactly once")
assert(nativeTestSpectatorTarget == "Blue", "confirmed seat recovery targeted the wrong color")
assert(nativeTestRecoveryTargetedAttempts == 0,
    "notification targeted a missing recipient instead of using the public fallback")
assert(nativeTestRecoveryBroadcastFallbacks == 1,
    "post-assignment notification did not fall back exactly once when the destination was absent")
assert(nativeTestRecoveryThrownTargetedAttempts == 1 and nativeTestRecoveryThrownFallbacks == 1,
    "occupied-recipient delivery failure did not fall back publicly exactly once")
uiAdvance(hostPlayer)
onPlayerTurn({color = "Blue"}, {color = "Red"})
assert(clockTurnSignature() == signature, "pending seat assignment accepted a rapid click or turn callback")
assert(nativeTestSpectatorChangeCalls == 1, "pending seat assignment called changeColor more than once")
local saved = onSave()
assert(not string.find(saved, "Aravell", 1, true), "transient spectator name leaked into onSave")
assert(not string.find(saved, "hotseat%-aravell"), "transient spectator identity leaked into onSave")
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryConfirmed.state.phase, 'cabinet')
  assert.equal(nativeSeatRecoveryConfirmed.state.turnIndex, 2)
  assert.equal(nativeSeatRecoveryConfirmed.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryConfirmed.seatRecoveryPending?.color, 'Blue')
  assert.equal(nativeSeatRecoveryConfirmed.seatRefreshPending, false)
  assert.equal(nativeSeatRecoveryConfirmed.turns.effective, false)
  assert.equal(nativeSeatRecoveryConfirmed.ui.advance, 'SEAT CHANGE REQUESTED')
  assert(isFalse(nativeSeatRecoveryConfirmed.ui.advanceInteractable))
  assert.match(
    nativeSeatRecoveryConfirmed.ui.instruction,
    /Complete any TTS (?:player-name or )?hotseat handoff dialog/,
  )

  const nativeSeatRecoveryPendingIdentitySwap = await snapshot(
    bridge,
    'pending seat assignment cancels promptly when the named Grey identity changes',
    `
local signature = clockTurnSignature()
nativeTestSpectators = {{
    steam_name = "Replacement Pending Observer",
    steam_id = "observer-pending-replacement",
    changeColor = function() error("replacement pending observer was assigned without confirmation") end,
}}
scheduleSeatRefresh()
assert(clockTurnSignature() == signature, "pending spectator swap moved the clock")
`,
    0.75,
  )
  assert.equal(nativeSeatRecoveryPendingIdentitySwap.seatRecoveryPending ?? null, null)
  assert.equal(nativeSeatRecoveryPendingIdentitySwap.state.turnIndex, 2)
  assert.match(nativeSeatRecoveryPendingIdentitySwap.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)
  assert.match(nativeSeatRecoveryPendingIdentitySwap.ui.advanceTooltip, /Replacement Pending Observer/)
  assert.deepEqual(nativeSeatRecoveryPendingIdentitySwap.physical, nativeSeatRecoveryConfirmed.physical)

  const nativeEndedRefreshConsole = await snapshot(
    bridge,
    'ended Native seat refresh keeps physical Undo candidly unavailable',
    `
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 3,
    phase = "ended",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
    outcome = "signed",
    endFromPhase = "summit",
    endFromTurn = 2,
}
clearNativeTurnSafety()
nativeSeatResumeRequired = true
seatRefreshPending = true
nativeTestSeatColors = {"Blue", "Red", "White"}
updateAll()
syncingTurns = false
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
controllerBack({color = hostPlayer.color})
assert(clockTurnSignature() == signature and state.phase == "ended",
    "physical console bypassed ended-state seat refresh")
`,
    0.25,
  )
  assert.equal(nativeEndedRefreshConsole.controller.advance, 'SEATING SETTLING')
  assert.equal(nativeEndedRefreshConsole.controller.back, 'BACK')
  assert.match(nativeEndedRefreshConsole.status, /SEATING PAUSED/)
  assert.doesNotMatch(nativeEndedRefreshConsole.status, /UNDO TO RESUME NATIVE/)
  assert.match(nativeEndedRefreshConsole.controller.status, /SEATING PAUSED/)
  assert.doesNotMatch(nativeEndedRefreshConsole.controller.status, /UNDO TO RESUME NATIVE/)
  assert.equal(
    nativeEndedRefreshConsole.controller.backTooltip,
    'Step the clock back once. This does not undo moved pieces.',
  )
  assert.equal(nativeEndedRefreshConsole.nativeSeatResumeRequired, true)
  assert.equal(nativeEndedRefreshConsole.seatRefreshPending, true)

const nativeRunningRefreshResume = await snapshot(
    bridge,
    'running exact-seat refresh keeps Resume candidly unavailable',
    `
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 3,
    phase = "cabinet",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
clearNativeTurnSafety()
nativeSeatResumeRequired = true
seatRefreshPending = true
nativeTestSeatColors = {"Blue", "Red", "White"}
updateAll()
syncingTurns = false
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for running refresh checks")
uiAdvance(hostPlayer)
controllerAdvance({color = hostPlayer.color})
controllerBack({color = hostPlayer.color})
assert(clockTurnSignature() == signature,
    "running refresh presentation allowed a Resume or clock mutation")
`,
    0.25,
  )
  assert.equal(nativeRunningRefreshResume.ui.advance, 'SEATING SETTLING')
  assert(isFalse(nativeRunningRefreshResume.ui.advanceInteractable))
  assert(isFalse(nativeRunningRefreshResume.ui.backInteractable))
  assert.match(nativeRunningRefreshResume.ui.instruction, /TTS seating is settling/)
  assert.match(nativeRunningRefreshResume.status, /SEATING PAUSED/)
  assert.doesNotMatch(nativeRunningRefreshResume.status, /RESUME REQUIRED/)
  assert.match(nativeRunningRefreshResume.controller.status, /SEATING PAUSED/)
  assert.doesNotMatch(nativeRunningRefreshResume.controller.status, /RESUME REQUIRED/)
  assert.equal(nativeRunningRefreshResume.controller.advance, 'SEATING SETTLING')
  assert.equal(nativeRunningRefreshResume.controller.back, 'BACK')
  assert.equal(nativeRunningRefreshResume.nativeSeatResumeRequired, true)
  assert.equal(nativeRunningRefreshResume.seatRefreshPending, true)

  const nativeRunningRefreshSettled = await snapshot(
    bridge,
    'settled exact-seat refresh candidly exposes docket Resume',
    `
seatRefreshPending = false
recordSeatAudit(auditSeats())
updateAll()
assert(nativeSeatResumeRequired == true,
    "settled running refresh cleared the required same-clock Resume")
`,
    0.25,
  )
  assert.equal(nativeRunningRefreshSettled.ui.advance, 'RESUME NATIVE TURNS')
  assert(isTrue(nativeRunningRefreshSettled.ui.advanceInteractable))
  assert.match(nativeRunningRefreshSettled.ui.instruction, /Exact seating restored/)
  assert.match(nativeRunningRefreshSettled.status, /RESUME REQUIRED/)
  assert.doesNotMatch(nativeRunningRefreshSettled.status, /SEATING PAUSED/)
  assert.match(nativeRunningRefreshSettled.controller.status, /RESUME REQUIRED/)
  assert.doesNotMatch(nativeRunningRefreshSettled.controller.status, /SEATING PAUSED/)
  assert.equal(nativeRunningRefreshSettled.controller.advance, 'RESUME IN DOCKET')
  assert.equal(nativeRunningRefreshSettled.nativeSeatResumeRequired, true)
  assert.equal(nativeRunningRefreshSettled.seatRefreshPending, false)

  const nativeExactTransientGates = await snapshot(
    bridge,
    'exact audits cannot bypass pending, refresh, or resume quarantine on any clock adapter',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for exact transient-gate checks")
local function resetExactTransient(kind, phase)
    state = {
        started = true,
        playerCount = 2,
        dispatchCode = 148802,
        round = 3,
        phase = phase or "cabinet",
        chairIndex = 1,
        turnIndex = 1,
        turnMode = TURN_MODE_NATIVE,
    }
    disarmFinish()
    clearNativeTurnSafety()
    seatRefreshPending = false
    nativeSeatResumeRequired = false
    nativeTestSeatColors = {"Blue", "Red", "White"}
    if kind == "pending" then
        seatRecoveryPending = {
            contextSignature = "synthetic-pending",
            playerName = "Pending Observer",
            countryName = "Aravell",
            color = "Blue",
        }
    elseif kind == "refresh" then
        seatRefreshPending = true
    elseif kind == "settling" then
        nativeResumeSettling = true
        nativeResumeClockSignature = clockTurnSignature()
    elseif kind == "resume" then
        nativeSeatResumeRequired = true
    end
    updateAll()
    syncingTurns = false
end
resetExactTransient("refresh", "cabinet")
nativeTestSeatColors = {"Red", "White"}
lastSeatCountryFingerprint = auditSeats().countryFingerprint
lastSeatExactActive = false
nativeTestSeatColors = {"Blue", "Red", "White"}
local pendingExactSignature = clockTurnSignature()
advanceClock(hostPlayer.color)
assert(clockTurnSignature() == pendingExactSignature,
    "adapter during pending exact settlement advanced the clock")
assert(nativeSeatResumeRequired == true,
    "adapter update swallowed the inexact-to-exact Resume transition")
seatRefreshPending = false
recordSeatAudit(auditSeats())
updateAll()
assert(nativeSeatResumeRequired == true and #nativeTestTurns.order == 0,
    "settled audit cleared the Resume latch created during a blocked adapter")
local clockSurfaces = {
    function() uiAdvance(hostPlayer) end,
    function() uiBack(hostPlayer) end,
    function() advanceClock(hostPlayer.color) end,
    function() stepBack(hostPlayer.color) end,
    function() controllerAdvance({color = hostPlayer.color}) end,
    function() controllerBack({color = hostPlayer.color}) end,
    function() hotkeyNext(hostPlayer.color) end,
    function() hotkeyBack(hostPlayer.color) end,
    function() onChat("!owe next", hostPlayer) end,
    function() onChat("!owe back", hostPlayer) end,
    function() onPlayerTurn({color = "Red"}, {color = "Blue"}) end,
}
for _, kind in ipairs({"pending", "refresh", "settling"}) do
    resetExactTransient(kind, "cabinet")
    local signature = clockTurnSignature()
    for index, surface in ipairs(clockSurfaces) do
        surface()
        assert(clockTurnSignature() == signature,
            kind .. " exact-audit surface advanced the clock at index " .. tostring(index))
    end
    assert(#nativeTestTurns.order == 0, kind .. " exact-audit gate enabled Native Turns")
    uiStatus(hostPlayer)
    controllerStatus({color = hostPlayer.color})
    hotkeyStatus(hostPlayer.color)
    onChat("!owe status", hostPlayer)
    uiOverview(hostPlayer)
    onChat("!owe view", hostPlayer)
    assert(clockTurnSignature() == signature,
        kind .. " read-only Status or Overview changed the clock")
end
resetExactTransient("resume", "cabinet")
local resumeSignature = clockTurnSignature()
for index = 2, #clockSurfaces do
    clockSurfaces[index]()
    assert(clockTurnSignature() == resumeSignature,
        "resume exact-audit surface advanced the clock at index " .. tostring(index))
    assert(nativeSeatResumeRequired == true,
        "resume exact-audit surface cleared the latch at index " .. tostring(index))
end
assert(#nativeTestTurns.order == 0, "resume exact-audit gate enabled Native Turns")
uiStatus(hostPlayer)
controllerStatus({color = hostPlayer.color})
hotkeyStatus(hostPlayer.color)
onChat("!owe status", hostPlayer)
uiOverview(hostPlayer)
onChat("!owe view", hostPlayer)
assert(clockTurnSignature() == resumeSignature and nativeSeatResumeRequired == true,
    "resume read-only Status or Overview changed clock or latch")

for _, kind in ipairs({"pending", "refresh", "settling", "resume"}) do
    resetExactTransient(kind, "summit")
    local signature = clockTurnSignature()
    uiFinishConference(hostPlayer)
    finishConference(hostPlayer.color)
    finishConference(hostPlayer.color)
    onChat("!owe finish", hostPlayer)
    assert(clockTurnSignature() == signature and state.phase == "summit" and state.outcome == nil,
        kind .. " exact-audit finish surface closed or advanced the conference")
    assert(finishArmed == false, kind .. " exact-audit finish surface armed confirmation")
    assert(string.lower(tostring(UI.getAttribute("finishButton", "interactable"))) == "false",
        kind .. " exact-audit finish button remained interactable")
end

resetExactTransient("refresh", "ended")
state.outcome = "signed"
state.endFromPhase = "summit"
state.endFromTurn = 2
updateAll()
syncingTurns = false
stepBack(hostPlayer.color)
assert(state.phase == "ended" and state.outcome == "signed",
    "ended-state Back bypassed the seat-refresh quarantine")

seatRefreshPending = false
nativeTestSeatColors = {"Blue", "White"}
updateAll()
syncingTurns = false
stepBack(hostPlayer.color)
assert(state.phase == "ended" and state.outcome == "signed",
    "ended-state Back reopened with a missing active seat")

nativeTestSeatColors = {"Blue", "Red", "White"}
recordSeatAudit(auditSeats())
updateAll()
syncingTurns = false
assert(nativeSeatResumeRequired == true,
    "ended-state exact restoration did not preserve a Resume requirement")
`,
    0.25,
  )
  assert.equal(nativeExactTransientGates.state.phase, 'ended')
  assert.equal(nativeExactTransientGates.state.outcome, 'signed')
  assert.equal(nativeExactTransientGates.state.endFromPhase, 'summit')
  assert.equal(nativeExactTransientGates.state.endFromTurn, 2)
  assert.equal(nativeExactTransientGates.nativeSeatResumeRequired, true)
  assert.match(nativeExactTransientGates.ui.instruction, /UNDO CLOCK/)
  assert.match(nativeExactTransientGates.status, /UNDO TO RESUME NATIVE/)
  assert.doesNotMatch(nativeExactTransientGates.status, /SEATING PAUSED/)
  assert.match(nativeExactTransientGates.controller.status, /UNDO TO RESUME NATIVE/)
  assert.doesNotMatch(nativeExactTransientGates.controller.status, /SEATING PAUSED/)
  assert.equal(nativeExactTransientGates.controller.advance, 'CONFERENCE CLOSED')
  assert.equal(nativeExactTransientGates.controller.back, 'UNDO\nTO RESUME')
  assert.equal(
    nativeExactTransientGates.controller.backTooltip,
    'Reopen the recorded ended-state clock. Native Turns stay paused until docket Resume.',
  )
  assert(isTrue(nativeExactTransientGates.ui.backInteractable))
  assert(isFalse(nativeExactTransientGates.ui.advanceActive))

  const nativeExactEndedUndo = await snapshot(
    bridge,
    'exact ended-state Undo restores its source turn and retains docket Resume',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
assert(hostPlayer ~= nil, "host player was not available for exact ended-state Undo")
controllerBack({color = hostPlayer.color})
assert(state.phase == "summit" and state.outcome == nil,
    "physical-console Undo did not reopen the recorded source state")
assert(state.turnIndex == 2 and state.endFromPhase == nil and state.endFromTurn == 1,
    "ended-state Undo did not restore the exact source turn and consume its metadata")
assert(nativeSeatResumeRequired == true and #nativeTestTurns.order == 0,
    "ended-state Undo cleared the restoration latch or enabled Native Turns")
`,
    0.25,
  )
  assert.equal(nativeExactEndedUndo.state.phase, 'summit')
  assert.equal(nativeExactEndedUndo.state.turnIndex, 2)
  assert.equal(nativeExactEndedUndo.state.outcome ?? null, null)
  assert.equal(nativeExactEndedUndo.state.endFromPhase ?? null, null)
  assert.equal(nativeExactEndedUndo.state.endFromTurn, 1)
  assert.equal(nativeExactEndedUndo.nativeSeatResumeRequired, true)
  assert.equal(nativeExactEndedUndo.turns.effective, false)
  assert.equal(nativeExactEndedUndo.ui.advance, 'RESUME NATIVE TURNS')
  assert(isTrue(nativeExactEndedUndo.ui.advanceInteractable))
  assert.equal(nativeExactEndedUndo.controller.back, 'BACK')
  assert.equal(
    nativeExactEndedUndo.controller.backTooltip,
    'Step the clock back once. This does not undo moved pieces.',
  )

  const nativeExactTransientCleanup = await snapshot(
    bridge,
    'restore the missing-seat Cabinet fixture after exact transient-gate checks',
    `
clearNativeTurnSafety()
seatRefreshPending = false
nativeTestSeatColors = {"Red", "White"}
state.phase = "cabinet"
state.turnIndex = 2
state.outcome = nil
state.endFromPhase = nil
state.endFromTurn = 1
updateAll()
`,
    0.75,
  )
  assert.equal(nativeExactTransientCleanup.state.phase, 'cabinet')
  assert.equal(nativeExactTransientCleanup.state.turnIndex, 2)
  assert.equal(nativeExactTransientCleanup.nativeSeatResumeRequired, false)
  assert.equal(nativeExactTransientCleanup.nativeResumeSettling, false)
  assert.equal(nativeExactTransientCleanup.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeExactTransientCleanup.seatRecoveryPending ?? null, null)
  assert.equal(nativeExactTransientCleanup.seatRefreshPending, false)
  assert.equal(nativeExactTransientCleanup.nativeTurnResyncSignature ?? null, null)
  assert.equal(nativeExactTransientCleanup.nativeTurnFaultSignature ?? null, null)
  assert.equal(nativeExactTransientCleanup.syncingTurns, false)
  assert.equal(nativeExactTransientCleanup.turns.effective, false)
  assert.deepEqual(nativeExactTransientCleanup.turns.order, [])
  assertPhysicalEquivalent(
    nativeExactTransientCleanup.physical,
    nativeSeatRecoveryConfirmed.physical,
    'Exact transient-gate checks mutated counters, hands, deck order, or marker transforms.',
  )

  const nativeSeatRecoveryAmbiguous = await snapshot(
    bridge,
    'zero, multiple, two-missing, and unavailable-seat recovery contexts remain fail-closed',
    `
clearSeatRecoveryPending()
local function settleSyntheticSeatAudit()
    seatRefreshGeneration = seatRefreshGeneration + 1
    seatRefreshPending = false
    recordSeatAudit(auditSeats())
    updateAll()
    syncingTurns = false
    assert(seatRefreshPending == false, "synthetic seat audit remained behind refresh")
end
nativeTestSpectators = {
    {steam_name = "Observer One", steam_id = "observer-1", changeColor = function() error("wrong spectator") end},
    {steam_name = "Observer Two", steam_id = "observer-2", changeColor = function() error("wrong spectator") end},
}
assert(playerAtColor("Grey") == nil, "ambiguous Grey spectators resolved to a privileged adapter actor")
settleSyntheticSeatAudit()
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "ambiguous recovery moved the clock")
assert(nativeTestSpectatorChangeCalls == 1, "ambiguous recovery reassigned a spectator")
assert(seatRecoveryArmedSignature == nil, "multiple-spectator recovery armed a private-seat grant")
nativeTestSpectators = {}
assert(playerAtColor("Grey") == nil, "zero Grey spectators resolved to a privileged adapter actor")
settleSyntheticSeatAudit()
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature == nil, "zero-spectator recovery armed")
nativeTestSpectators = {{steam_name = "Only Observer", steam_id = "observer-only"}}
nativeTestSeatColors = {"White"}
settleSyntheticSeatAudit()
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature == nil, "two-missing-seat recovery armed")
nativeTestSeatColors = {"Red", "White"}
nativeTestAvailableSeatColors = {"Red"}
settleSyntheticSeatAudit()
uiAdvance(hostPlayer)
assert(seatRecoveryArmedSignature == nil, "unavailable target color armed")
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryAmbiguous.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryAmbiguous.turns.effective, false)
  assert.equal(nativeSeatRecoveryAmbiguous.ui.advance, 'SEATING PAUSED')
  assert(isFalse(nativeSeatRecoveryAmbiguous.ui.advanceInteractable))
  assert.match(
    nativeSeatRecoveryAmbiguous.ui.instruction,
    /ASSIGN needs one named Grey with a Steam account\..*TTS Change Color/,
  )

  const nativeSeatRecoveryThrownReady = await snapshot(
    bridge,
    'fresh seat audit exposes the throwing assignment fixture',
    `
nativeTestAvailableSeatColors = {"Blue", "Red"}
nativeTestSeatColors = {"Red", "White"}
nativeTestThrowCalls = 0
nativeTestSpectators = {{
    steam_name = "Throwing Observer",
    steam_id = "observer-throw",
    changeColor = function()
        nativeTestThrowCalls = nativeTestThrowCalls + 1
        error("injected changeColor failure")
    end,
}}
scheduleSeatRefresh()
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryThrownReady.seatRefreshPending, false)
  assert.match(nativeSeatRecoveryThrownReady.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)

  const nativeSeatRecoveryThrown = await snapshot(
    bridge,
    'thrown seat assignment clears its transient state and leaves the clock safely paused',
    `
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
uiAdvance(hostPlayer)
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "thrown seat assignment moved the clock")
assert(nativeTestThrowCalls == 1, "thrown seat assignment did not execute exactly once")
`,
    0.25,
  )
  assert.equal(nativeSeatRecoveryThrown.seatRecoveryPending ?? null, null)
  assert.equal(nativeSeatRecoveryThrown.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryThrown.turns.effective, false)
  assert.match(nativeSeatRecoveryThrown.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)

  const nativeSeatRecoveryStalePendingTimer = await snapshot(
    bridge,
    'expired pending-assignment timer cannot clear a newer recovery context',
    `
local recovery = nativeSeatRecoveryOpportunity(auditSeats())
assert(recovery ~= nil, "eligible recovery context was unavailable for generation test")
SEAT_RECOVERY_SETTLE_SECONDS = 0.05
beginSeatRecoveryPending(recovery)
local staleGeneration = seatRecoveryPendingGeneration
clearSeatRecoveryPending()
SEAT_RECOVERY_SETTLE_SECONDS = 10
beginSeatRecoveryPending(recovery)
assert(seatRecoveryPendingGeneration > staleGeneration,
    "replacement pending assignment did not receive a fresh generation")
`,
    0.3,
  )
  assert(
    nativeSeatRecoveryStalePendingTimer.seatRecoveryPending,
    'Replacement pending assignment was cleared.',
  )
  assert.equal(nativeSeatRecoveryStalePendingTimer.seatRecoveryPending.color, 'Blue')
  assert.equal(nativeSeatRecoveryStalePendingTimer.turns.effective, false)

  const nativeSeatRecoveryTimeout = await snapshot(
    bridge,
    'silent no-seat-change assignment times out and permits a deliberate retry without moving the clock',
    `
clearSeatRecoveryPending()
nativeTestSilentCalls = 0
nativeTestSpectators = {{
    steam_name = "Silent Observer",
    steam_id = "observer-silent",
    changeColor = function()
        nativeTestSilentCalls = nativeTestSilentCalls + 1
    end,
}}
SEAT_RECOVERY_SETTLE_SECONDS = 0.05
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
uiAdvance(hostPlayer)
uiAdvance(hostPlayer)
SEAT_RECOVERY_SETTLE_SECONDS = 10
assert(clockTurnSignature() == signature, "silent seat assignment moved the clock")
assert(nativeTestSilentCalls == 1, "silent seat assignment did not execute exactly once")
`,
    0.75,
  )
  assert.equal(nativeSeatRecoveryTimeout.seatRecoveryPending ?? null, null)
  assert.equal(nativeSeatRecoveryTimeout.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoveryTimeout.seatRefreshPending, false)
  assert.equal(nativeSeatRecoveryTimeout.turns.effective, false)
  assert.match(nativeSeatRecoveryTimeout.ui.advance, /^ASSIGN\s+ARAVELL \/ BLUE$/)
  assert(isTrue(nativeSeatRecoveryTimeout.ui.advanceInteractable))

  const nativeSeatRecoveryLateExactPending = await snapshot(
    bridge,
    'late assignment remains pending after its first settled audit still reports the missing seat',
    `
nativeTestLateExactCalls = 0
nativeTestSeatColors = {"Red", "White"}
nativeTestSpectators = {{
    steam_name = "Late Exact Observer",
    steam_id = "observer-late-exact",
    changeColor = function()
        nativeTestLateExactCalls = nativeTestLateExactCalls + 1
    end,
}}
SEAT_RECOVERY_SETTLE_SECONDS = 2
local signature = clockTurnSignature()
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
uiAdvance(hostPlayer)
uiAdvance(hostPlayer)
SEAT_RECOVERY_SETTLE_SECONDS = 10
assert(clockTurnSignature() == signature, "late exact assignment moved the clock")
assert(nativeTestLateExactCalls == 1, "late exact assignment did not execute exactly once")
`,
    0.25,
  )
  assert(nativeSeatRecoveryLateExactPending.seatRecoveryPending, 'Late assignment did not remain pending.')
  assert.equal(nativeSeatRecoveryLateExactPending.seatRefreshPending, false)
  assert.equal(nativeSeatRecoveryLateExactPending.seatAudit.exactActiveSeats, false)
  assert.equal(nativeSeatRecoveryLateExactPending.nativeSeatResumeRequired, true)
  assert.equal(nativeSeatRecoveryLateExactPending.turns.effective, false)
  assert.equal(nativeSeatRecoveryLateExactPending.ui.advance, 'SEAT CHANGE REQUESTED')
  assert(isFalse(nativeSeatRecoveryLateExactPending.ui.advanceInteractable))

  const nativeSeatRecoveryLateExactBeforeTimeout = await snapshot(
    bridge,
    'eventless exact seating cannot bypass the pending assignment timeout boundary',
    `
nativeTestSpectators = {}
nativeTestSeatColors = {"Blue", "Red", "White"}
assert(seatRecoveryPending ~= nil, "pending assignment cleared before eventless exact seating")
`,
    0.25,
  )
  assert(
    nativeSeatRecoveryLateExactBeforeTimeout.seatRecoveryPending,
    'Eventless exact seating cleared pending state before its timeout audit.',
  )
  assert.equal(nativeSeatRecoveryLateExactBeforeTimeout.seatAudit.exactActiveSeats, true)
  assert.equal(nativeSeatRecoveryLateExactBeforeTimeout.nativeSeatResumeRequired, true)
  assert.equal(nativeSeatRecoveryLateExactBeforeTimeout.turns.effective, false)
  assert.deepEqual(nativeSeatRecoveryLateExactBeforeTimeout.turns.order, [])
  assert.equal(nativeSeatRecoveryLateExactBeforeTimeout.ui.advance, 'SEAT CHANGE REQUESTED')
  assert(isFalse(nativeSeatRecoveryLateExactBeforeTimeout.ui.advanceInteractable))

  const nativeSeatRecoveryLateExact = await snapshot(
    bridge,
    'pending-assignment timeout catches eventless exact seating behind explicit Resume',
    '',
    2.1,
  )
  assert.equal(nativeSeatRecoveryLateExact.state.phase, 'cabinet')
  assert.equal(nativeSeatRecoveryLateExact.state.turnIndex, 2)
  assert.equal(nativeSeatRecoveryLateExact.seatRecoveryPending ?? null, null)
  assert.equal(nativeSeatRecoveryLateExact.seatRefreshPending, false)
  assert.equal(nativeSeatRecoveryLateExact.nativeSeatResumeRequired, true)
  assert.equal(nativeSeatRecoveryLateExact.turns.effective, false)
  assert.deepEqual(nativeSeatRecoveryLateExact.turns.order, [])
  assert.equal(nativeSeatRecoveryLateExact.ui.advance, 'RESUME NATIVE TURNS')
  assert(isTrue(nativeSeatRecoveryLateExact.ui.advanceInteractable))

  const nativeSeatRecoverySettled = await snapshot(
    bridge,
    'authorized docket Resume completes recovered-seat settlement without moving the clock',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
local signature = clockTurnSignature()
uiAdvance(hostPlayer)
assert(clockTurnSignature() == signature, "recovered-seat Resume moved the clock")
`,
    1.25,
  )
  assert.equal(nativeSeatRecoverySettled.state.phase, 'cabinet')
  assert.equal(nativeSeatRecoverySettled.state.turnIndex, 2)
  assert.equal(nativeSeatRecoverySettled.seatRecoveryArmedSignature ?? null, null)
  assert.equal(nativeSeatRecoverySettled.nativeSeatResumeRequired, false)
  assert.equal(nativeSeatRecoverySettled.turns.enable, true)
  assert.equal(nativeSeatRecoverySettled.turns.turnColor, 'Red')
  assert.equal(nativeSeatRecoverySettled.ui.advance, 'END CABINET TURN')
  assert.deepEqual(nativeSeatRecoverySettled.state, nativeSeatRecoveryLateExact.state)
  assert.deepEqual(nativeSeatRecoverySettled.physical, nativeSeatRecoveryLateExact.physical)

  const nativeNeutralChurn = await snapshot(
    bridge,
    'ambiguous exact-to-exact neutral observer event conservatively requires same-clock Resume',
    `
nativeTestSeatColors = {"Blue", "Red", "Grey", "White"}
scheduleSeatRefresh()
`,
    0.75,
  )
  assert.equal(nativeNeutralChurn.nativeSeatResumeRequired, true)
  assert.equal(nativeNeutralChurn.state.turnIndex, 2)
  assert.equal(nativeNeutralChurn.turns.enable, false)
  assert.equal(nativeNeutralChurn.turns.effective, false)
  assert.equal(nativeNeutralChurn.ui.advance, 'RESUME NATIVE TURNS')

  const nativeResumePhaseMatrix = await snapshot(
    bridge,
    'every running phase requires the same no-clock-change docket Resume after seat restoration',
    `
local hostPlayer = nil
for _, player in ipairs(Player.getPlayers()) do
    if player.host then hostPlayer = player end
end
for _, phase in ipairs({"briefing", "cabinet", "crisis", "summit", "aftermath"}) do
    state.phase = phase
    state.turnIndex = 1
    clearNativeTurnSafety()
    lastSeatExactActive = true
    recordSeatAudit(classifySeats({"Blue", "White"}, 2))
    recordSeatAudit(classifySeats({"Blue", "Red", "White"}, 2))
    nativeTestSeatColors = {"Blue", "Red", "White"}
    updateAll()
    assert(nativeSeatResumeRequired == true,
        phase .. " restoration did not require explicit Native resume")
    assert(#nativeTestTurns.order == 0,
        phase .. " restoration exposed Native Turns before Resume")
    local signature = clockTurnSignature()
    uiAdvance(hostPlayer)
    assert(clockTurnSignature() == signature,
        phase .. " docket Resume moved the conference clock")
    assert(nativeSeatResumeRequired == false,
        phase .. " docket Resume did not clear its latch")
    assert(nativeResumeSettling == true,
        phase .. " docket Resume skipped its callback-free quiet period")
    assert(finishNativeResumeSettlement(nativeResumeGeneration) == true,
        phase .. " settled Resume did not complete")
    assert(nativeResumeSettling == false,
        phase .. " settled Resume left the clock quarantined")
    if phase == "cabinet" or phase == "crisis" or phase == "summit" then
        assert(#nativeTestTurns.order == 2,
            phase .. " settled Resume did not restore the exact Native order")
    else
        assert(#nativeTestTurns.order == 0,
            phase .. " table step exposed Native Turns after Resume")
    end
end
`,
    0.25,
  )
  assert.equal(nativeResumePhaseMatrix.state.phase, 'aftermath')
  assert.equal(nativeResumePhaseMatrix.state.turnIndex, 1)
  assert.equal(nativeResumePhaseMatrix.nativeSeatResumeRequired, false)
  assert.equal(nativeResumePhaseMatrix.turns.effective, false)

  await snapshot(
    bridge,
    'restore real seat audits after synthetic native runtime regressions',
    `
auditSeats = nativeTestOriginalAuditSeats
broadcastToAll = nativeTestOriginalBroadcastToAll
updateTurns = nativeTestOriginalUpdateTurns
disableTurnsSafely = nativeTestOriginalDisableTurnsSafely
spectatorPlayers = nativeTestOriginalSpectatorPlayers
availableSeatColors = nativeTestOriginalAvailableSeatColors
nativeTestOriginalAuditSeats = nil
nativeTestOriginalBroadcastToAll = nil
nativeTestOriginalUpdateTurns = nil
nativeTestOriginalDisableTurnsSafely = nil
nativeTestOriginalSpectatorPlayers = nil
nativeTestOriginalAvailableSeatColors = nil
nativeTestSeatColors = nil
nativeTestSpectators = nil
nativeTestAvailableSeatColors = nil
nativeTestSpectatorChangeCalls = nil
nativeTestSpectatorTarget = nil
nativeTestThrowCalls = nil
nativeTestSilentCalls = nil
nativeTestLateExactCalls = nil
nativeTestUnicodeLabel = nil
nativeTestEmojiLabel = nil
nativeTestEmojiScalarSafe = nil
nativeTestMalformedLabel = nil
nativeTestHiddenFormatLabel = nil
nativeTestBlankUnicodeSpaceLabel = nil
nativeTestBlankDefaultIgnorableLabel = nil
nativeTestMarkupLabel = nil
nativeTestFaultBroadcasts = nil
nativeTestTurns = nil
state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
updateAll()
`,
    0.75,
  )

  const endedNativeMissingStatus = await snapshot(
    bridge,
    'ended native conference requires exact seating before Undo',
    `
state = {
    started = true,
    playerCount = 2,
    dispatchCode = 148802,
    round = 6,
    phase = "ended",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
    outcome = "rounds",
    endFromPhase = "aftermath",
    endFromTurn = 1,
}
clearNativeTurnSafety()
updateAll()
syncingTurns = false
broadcastStatus(liveTestHostColor)
`,
    0.75,
  )
  assert.equal(endedNativeMissingStatus.state.phase, 'ended')
  assert.match(
    endedNativeMissingStatus.ui.instruction,
    /Missing active seats: .*Restore exact seating before Undo/,
  )
  assert.equal(endedNativeMissingStatus.controller.advance, 'SEATING PAUSED')
  assert.equal(endedNativeMissingStatus.controller.back, 'BACK')
  assert.equal(
    endedNativeMissingStatus.controller.backTooltip,
    'Step the clock back once. This does not undo moved pieces.',
  )
  assert(isFalse(endedNativeMissingStatus.ui.backInteractable))
  assert.equal(endedNativeMissingStatus.turns.effective, false)
  assert.deepEqual(endedNativeMissingStatus.turns.order, [])

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
    turnMode = TURN_MODE_MANUAL,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
updateAll()
syncingTurns = false
for _, player in ipairs(Player.getPlayers()) do
    if player.host then controllerAdvance({color = player.color}) end
end
`,
  )
  assert.equal(roundLimit.state.phase, 'ended')
  assert.equal(roundLimit.state.outcome, 'rounds')
  assert.equal(roundLimit.turns.effective, false)
  assert.deepEqual(roundLimit.turns.order, [])
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
state = {
    started = false,
    playerCount = 2,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
    turnMode = TURN_MODE_NATIVE,
}
disarmFinish()
disarmManualOpen()
clearNativeTurnSafety()
panelCollapsed = false
updateAll()
uiStartConference(Player[liveTestHostColor])
uiStartConference(Player[liveTestHostColor])
`,
    1.2,
  )
  assert.equal(twoPlayerSetup.state.playerCount, 2)
  assert.equal(twoPlayerSetup.state.chairIndex, 1)
  assert.equal(twoPlayerSetup.refugee, 4)
  assert.match(twoPlayerSetup.ui.roster, /0 \/ 2 SEATED · 2 ACTIVE/)

  const twoPlayerCabinet = await snapshot(
    bridge,
    'two-country manual Cabinet deals only active-country decks and keeps native Turns off',
    'advanceClock()',
    2.5,
  )
  assert.deepEqual(twoPlayerCabinet.turns.order, [])
  assert.equal(twoPlayerCabinet.turns.effective, false)
  assert.equal(twoPlayerCabinet.state.turnMode, 'manual')
  assert.match(twoPlayerCabinet.ui.roster, /0 \/ 2 SEATED · 2 ACTIVE · MANUAL/)
  for (const country of ['aravell', 'tomerin']) {
    assert.equal(twoPlayerCabinet.handPolicies[country], 3)
    assert.equal(twoPlayerCabinet.decks[country], 13)
  }
  for (const country of ['veyra', 'karsk', 'belovar', 'namarra']) {
    assert.equal(twoPlayerCabinet.handPolicies[country], 0)
    assert.equal(twoPlayerCabinet.decks[country], 16)
  }

  await runDelayedCommand(
    bridge,
    'restore the untouched setup surface',
    `
local function restoreTestSetupState()
    state = {
        started = false,
        playerCount = 6,
        dispatchCode = 148802,
        round = 1,
        phase = "briefing",
        chairIndex = 1,
        turnIndex = 1,
        turnMode = TURN_MODE_NATIVE,
    }
    disarmFinish()
    disarmManualOpen()
    clearNativeTurnSafety()
    lastSeatBlockReason = nil
    panelCollapsed = false
end
disableTurnsSafely()
restoreTestSetupState()
for _, country in ipairs(COUNTRIES) do
    local deck = getObjectFromGUID(POLICY_DECKS[country])
    if deck then
        local tag = "Policy_" .. country
        for _, object in ipairs(getAllObjects()) do
            if object ~= deck and object.hasTag(tag) then deck.putObject(object) end
        end
    end
end
`,
    `
    restoreTestSetupState()
    resetCounters()
    auditSeats = liveTestOriginalAuditSeats
    liveTestOriginalAuditSeats = nil
    liveTestSeatColors = nil
    updateAll()
    frameOverview(Player[liveTestHostColor])
    liveTestHostColor = nil
`,
    0.75,
  )
  const reset = await snapshot(
    bridge,
    'test session restores the untouched setup surface',
    '',
    0.4,
  )
  assert.equal(reset.state.started, false)
  assert(isTrue(reset.ui.bodyActive))
  assert(isTrue(reset.ui.toolsActive), 'Overview and Status must remain available during setup.')
  assert.equal(String(reset.ui.panelHeight), '504')
  assert.equal(reset.ui.collapseLabel, '−')
  assert.match(reset.ui.roster, /\d \/ 6 SEATED · 6 ACTIVE/)
  assert.equal(reset.refugee, 12, 'Cleanup must restore the six-player refugee counter.')

  console.log('Live TTS verification passed: complete seat-classifier identities, physical no-mutation Manual Hotseat confirmation, inactive-seat blocking, serialized state and synthetic chat authorization, chat/hotkeys, all 2–6-player rosters, manual deals/clock controls, synthetic native event/fault/race/seat regressions, signed-victory and Round-6 ending/undo paths, chair rotation, overview, and collapse. Genuine exact-seat native End Turn and real Save & Load remain separate player-driven gates.')
} catch (error) {
  failure = error
  console.error(`Live TTS verification failed:\n${error.stack ?? error.message}`)
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
