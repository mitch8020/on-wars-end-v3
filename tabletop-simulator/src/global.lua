COUNTRIES = {"aravell", "tomerin", "veyra", "karsk", "belovar", "namarra"}
COUNTRY_NAMES = {
    aravell = "Aravell",
    tomerin = "Tomerin",
    veyra = "Veyra",
    karsk = "Karsk",
    belovar = "Belovar",
    namarra = "Namarra",
}
SEAT_COLORS = {
    aravell = "Blue",
    tomerin = "Red",
    veyra = "Green",
    karsk = "Yellow",
    belovar = "Purple",
    namarra = "Teal",
}
PHASES = {"briefing", "cabinet", "crisis", "summit", "aftermath", "ended"}
PHASE_NAMES = {
    briefing = "Briefing",
    cabinet = "Cabinet",
    crisis = "Crisis Council",
    summit = "Peace Summit",
    aftermath = "Aftermath",
    ended = "Conference Ended",
}
INSTRUCTIONS = {
    briefing = "Reveal the next Crisis, read it aloud, then begin Cabinet.",
    cabinet = "Play one legal policy or Conserve Resources for +1 Capital.",
    crisis = "Seal one whole-number commitment. Zero is legal.",
    summit = "Sign, accept/post an exchange, open a backchannel, or pass.",
    aftermath = "Resolve the communiqué, clear proposals, and prepare the next round.",
    ended = "All countries signed, or Round 6 ended. Read the final communiqué.",
}
ADVANCE_LABELS = {
    briefing = "BEGIN CABINET",
    cabinet = "END CABINET TURN",
    crisis = "SEAL COMMITMENT",
    summit = "END SUMMIT TURN",
    aftermath = "NEXT ROUND",
    ended = "ENDED",
}

GUIDS = __GUIDS__
TURN_MARKER_POSITIONS = __TURN_MARKER_POSITIONS__
PHASE_MARKER_POSITIONS = __PHASE_MARKER_POSITIONS__
POLICY_DECKS = __POLICY_DECKS__
COUNTER_STARTS = __COUNTER_STARTS__

state = {
    started = false,
    playerCount = 6,
    dispatchCode = 148802,
    round = 1,
    phase = "briefing",
    chairIndex = 1,
    turnIndex = 1,
}

syncingTurns = false

function onLoad(saved_data)
    if saved_data and saved_data ~= "" then
        local ok, loaded = pcall(JSON.decode, saved_data)
        if ok and type(loaded) == "table" then
            state = loaded
        end
    end
    normalizeState()
    addHotkey("On War's End: next", hotkeyNext, false)
    addHotkey("On War's End: back", hotkeyBack, false)
    addHotkey("On War's End: status", hotkeyStatus, false)
    Wait.frames(function()
        updateAll()
        printToAll("[On War's End] Conference clock ready. Type !owe help for commands.", {0.89, 0.76, 0.45})
    end, 3)
end

function onSave()
    return JSON.encode(state)
end

function normalizeState()
    state.playerCount = math.max(2, math.min(6, tonumber(state.playerCount) or 6))
    state.dispatchCode = math.max(1, math.floor(math.abs(tonumber(state.dispatchCode) or 148802)))
    state.round = math.max(1, math.min(6, tonumber(state.round) or 1))
    state.chairIndex = math.max(1, math.min(state.playerCount, tonumber(state.chairIndex) or 1))
    state.turnIndex = math.max(1, math.min(state.playerCount, tonumber(state.turnIndex) or 1))
    if not tableContains(PHASES, state.phase) then state.phase = "briefing" end
    state.started = state.started == true
end

function tableContains(values, target)
    for _, value in ipairs(values) do
        if value == target then return true end
    end
    return false
end

function phaseIndex()
    for index, phase in ipairs(PHASES) do
        if phase == state.phase then return index end
    end
    return 1
end

function actionPhase()
    return state.phase == "cabinet" or state.phase == "crisis" or state.phase == "summit"
end

function rosterIndexAtTurn(turn_index)
    return ((state.chairIndex + turn_index - 2) % state.playerCount) + 1
end

function activeCountry()
    return COUNTRIES[rosterIndexAtTurn(state.turnIndex)]
end

function chairCountry()
    return COUNTRIES[state.chairIndex]
end

function activeOrder()
    local order = {}
    for turn_index = 1, state.playerCount do
        table.insert(order, COUNTRIES[rosterIndexAtTurn(turn_index)])
    end
    return order
end

function statusLine()
    if not state.started then
        return "Waiting for setup · " .. tostring(state.playerCount) .. " countries · dispatch " .. tostring(state.dispatchCode)
    end
    if state.phase == "ended" then
        return "Round " .. tostring(state.round) .. " · Conference ended"
    end
    return "Round " .. tostring(state.round) .. "/6 · " .. PHASE_NAMES[state.phase] ..
        " · Chair " .. COUNTRY_NAMES[chairCountry()] .. " · Active " .. COUNTRY_NAMES[activeCountry()]
end

function isHostOrPromoted(player)
    if not player then return true end
    return player.host == true or player.promoted == true
end

function requireControl(player)
    if isHostOrPromoted(player) then return true end
    broadcastToColor("Only the host or a promoted player may operate the conference clock.", player.color, {0.93, 0.42, 0.36})
    return false
end

function uiPlayerCount(player, value)
    if state.started or not requireControl(player) then
        updateAll()
        return
    end
    state.playerCount = math.max(2, math.min(6, tonumber(value) or 6))
    state.chairIndex = math.min(state.chairIndex, state.playerCount)
    updateAll()
end

function uiDispatch(player, value)
    if state.started or not requireControl(player) then
        updateAll()
        return
    end
    state.dispatchCode = math.max(1, math.floor(math.abs(tonumber(value) or 148802)))
    updateAll()
end

function uiStartConference(player)
    if state.started then
        if player then
            broadcastToColor("The conference is already underway. Reload this save to reset every physical component.", player.color, {0.93, 0.76, 0.36})
        end
        return
    end
    if not requireControl(player) then return end
    startConference()
end

function startConference()
    state.started = true
    state.round = 1
    state.phase = "briefing"
    state.turnIndex = 1
    state.chairIndex = chooseFirstChair(state.dispatchCode, state.playerCount)
    resetCounters()
    shufflePolicyDecks()
    local crisis_deck = getObjectFromGUID(GUIDS.crisisDeck)
    if crisis_deck then crisis_deck.shuffle() end
    updateAll()
    broadcastToAll("[On War's End] Dispatch " .. tostring(state.dispatchCode) .. " opens a " ..
        tostring(state.playerCount) .. "-country conference. " .. COUNTRY_NAMES[chairCountry()] ..
        " holds the first chair.", {0.89, 0.76, 0.45})
end

function chooseFirstChair(seed, player_count)
    if player_count <= 2 then return 1 end
    local rng = seed % 4294967296
    local crisis_count = 6
    for index = crisis_count, 2, -1 do
        rng = nextRng(rng)
    end
    rng = nextRng(rng)
    return math.floor((rng / 4294967296) * player_count) + 1
end

function nextRng(value)
    local next_value = bit32.bxor(value, bit32.lshift(value, 13))
    next_value = bit32.bxor(next_value, bit32.rshift(next_value, 17))
    next_value = bit32.bxor(next_value, bit32.lshift(next_value, 5))
    next_value = next_value % 4294967296
    if next_value == 0 then next_value = 1831565813 end
    return next_value
end

function uiAdvance(player)
    if not requireControl(player) then return end
    advanceClock()
end

function uiBack(player)
    if not requireControl(player) then return end
    stepBack()
end

function advanceClock()
    if not state.started then
        printToAll("[On War's End] Choose countries and a dispatch code, then Start conference.", {0.89, 0.76, 0.45})
        return
    end
    if state.phase == "ended" then return end
    if state.phase == "briefing" then
        state.phase = "cabinet"
        state.turnIndex = 1
        dealPolicyHands()
    elseif state.phase == "aftermath" then
        if state.round >= 6 then
            state.phase = "ended"
        else
            state.round = state.round + 1
            state.chairIndex = (state.chairIndex % state.playerCount) + 1
            state.turnIndex = 1
            state.phase = "briefing"
        end
    elseif actionPhase() then
        if state.turnIndex < state.playerCount then
            state.turnIndex = state.turnIndex + 1
        elseif state.phase == "cabinet" then
            state.phase = "crisis"
            state.turnIndex = 1
        elseif state.phase == "crisis" then
            state.phase = "summit"
            state.turnIndex = 1
        elseif state.phase == "summit" then
            state.phase = "aftermath"
            state.turnIndex = 1
        end
    end
    updateAll()
    broadcastStatus()
end

function stepBack()
    if not state.started then return end
    if state.phase == "briefing" then
        if state.round <= 1 then return end
        state.round = state.round - 1
        state.chairIndex = ((state.chairIndex - 2) % state.playerCount) + 1
        state.phase = "aftermath"
        state.turnIndex = 1
    elseif state.phase == "ended" then
        state.phase = "aftermath"
        state.turnIndex = 1
    elseif state.phase == "aftermath" then
        state.phase = "summit"
        state.turnIndex = state.playerCount
    elseif actionPhase() and state.turnIndex > 1 then
        state.turnIndex = state.turnIndex - 1
    elseif state.phase == "summit" then
        state.phase = "crisis"
        state.turnIndex = state.playerCount
    elseif state.phase == "crisis" then
        state.phase = "cabinet"
        state.turnIndex = state.playerCount
    elseif state.phase == "cabinet" then
        state.phase = "briefing"
        state.turnIndex = 1
    end
    updateAll()
    broadcastStatus()
end

function updateAll()
    normalizeState()
    updateUI()
    updateMarkers()
    updateTurns()
    updateController()
end

function updateUI()
    UI.setValue("roundText", state.started and ("Round " .. tostring(state.round) .. " of 6") or "Conference setup")
    UI.setValue("phaseText", state.started and PHASE_NAMES[state.phase] or "Choose the delegation roster")
    UI.setValue("activeText", state.started and
        ("Chair: " .. COUNTRY_NAMES[chairCountry()] .. " · Active: " .. COUNTRY_NAMES[activeCountry()]) or
        ("First " .. tostring(state.playerCount) .. " countries in the roster will play."))
    UI.setValue("instructionText", state.started and INSTRUCTIONS[state.phase] or
        "The clock automates chair order and phase cadence. Pieces and rule outcomes stay tactile.")
    UI.setValue("advanceButton", state.started and ADVANCE_LABELS[state.phase] or "Start first")
    UI.setAttribute("playerCount", "value", state.playerCount - 2)
    UI.setAttribute("playerCount", "interactable", not state.started)
    UI.setValue("dispatchCode", tostring(state.dispatchCode))
    UI.setAttribute("dispatchCode", "interactable", not state.started)
    UI.setValue("startButton", state.started and "Conference underway" or "Start conference")
    UI.setAttribute("startButton", "interactable", not state.started)
    UI.setAttribute("advanceButton", "interactable", state.started and state.phase ~= "ended")
    UI.setAttribute("backButton", "interactable", state.started)
end

function updateMarkers()
    local turn_marker = getObjectFromGUID(GUIDS.turnMarker)
    if turn_marker then
        local position = TURN_MARKER_POSITIONS[activeCountry()]
        if position then turn_marker.setPositionSmooth(position, false, true) end
    end
    local phase_marker = getObjectFromGUID(GUIDS.phaseMarker)
    if phase_marker then
        local position = PHASE_MARKER_POSITIONS[state.phase]
        if position then phase_marker.setPositionSmooth(position, false, true) end
    end
    local round_counter = getObjectFromGUID(GUIDS.roundCounter)
    if round_counter then round_counter.setValue(state.round) end
end

function updateTurns()
    syncingTurns = true
    if state.started and actionPhase() then
        local colors = {}
        for _, country in ipairs(activeOrder()) do table.insert(colors, SEAT_COLORS[country]) end
        Turns.enable = false
        Turns.type = 2
        Turns.order = colors
        Turns.reverse_order = false
        Turns.skip_empty_hands = false
        Turns.disable_interactations = false
        Turns.pass_turns = false
        Turns.turn_color = SEAT_COLORS[activeCountry()]
        Turns.enable = true
    else
        Turns.enable = false
    end
    Wait.frames(function() syncingTurns = false end, 2)
end

function onPlayerTurn(player, previous_player)
    if syncingTurns or not state.started or not actionPhase() or not player then return end
    local expected_next = state.turnIndex < state.playerCount and state.turnIndex + 1 or 1
    local expected_country = COUNTRIES[rosterIndexAtTurn(expected_next)]
    if player.color ~= SEAT_COLORS[expected_country] then
        updateTurns()
        return
    end
    if state.turnIndex < state.playerCount then
        state.turnIndex = state.turnIndex + 1
    elseif state.phase == "cabinet" then
        state.phase = "crisis"
        state.turnIndex = 1
    elseif state.phase == "crisis" then
        state.phase = "summit"
        state.turnIndex = 1
    elseif state.phase == "summit" then
        state.phase = "aftermath"
        state.turnIndex = 1
    end
    updateAll()
    broadcastStatus()
end

function updateController()
    local controller = getObjectFromGUID(GUIDS.controller)
    if not controller then return end
    controller.call("setStatus", {
        label = "CONFERENCE CLOCK\n" .. statusLine(),
        advance = state.started and ADVANCE_LABELS[state.phase] or "SET UP IN PANEL",
    })
end

function resetCounters()
    for guid, value in pairs(COUNTER_STARTS) do
        local counter = getObjectFromGUID(guid)
        if counter then counter.setValue(value) end
    end
    local refugee_counter = getObjectFromGUID(GUIDS.refugeeCounter)
    if refugee_counter then refugee_counter.setValue(2 * state.playerCount) end
    local round_counter = getObjectFromGUID(GUIDS.roundCounter)
    if round_counter then round_counter.setValue(1) end
end

function shufflePolicyDecks()
    for index = 1, state.playerCount do
        local country = COUNTRIES[index]
        local deck = getObjectFromGUID(POLICY_DECKS[country])
        if deck then deck.shuffle() end
    end
end

function dealPolicyHand(country)
    local current_deck = getObjectFromGUID(POLICY_DECKS[country])
    if current_deck then
        current_deck.shuffle()
        current_deck.deal(3, SEAT_COLORS[country])
    end
end

function schedulePolicyHand(country)
    Wait.time(function() dealPolicyHand(country) end, 0.8)
end

function dealPolicyHands()
    for index = 1, state.playerCount do
        local country = COUNTRIES[index]
        local deck = getObjectFromGUID(POLICY_DECKS[country])
        if deck then
            local tag = "Policy_" .. country
            for _, object in ipairs(getAllObjects()) do
                if object ~= deck and object.hasTag(tag) then
                    deck.putObject(object)
                end
            end
            schedulePolicyHand(country)
        end
    end
end

function broadcastStatus(target_color)
    local message = "[On War's End] " .. statusLine() .. ". " .. INSTRUCTIONS[state.phase]
    if target_color then
        broadcastToColor(message, target_color, {0.89, 0.76, 0.45})
    else
        broadcastToAll(message, {0.89, 0.76, 0.45})
    end
end

function controllerAdvance(params)
    local player = Player[params and params.color or "Grey"]
    if requireControl(player) then advanceClock() end
end

function controllerBack(params)
    local player = Player[params and params.color or "Grey"]
    if requireControl(player) then stepBack() end
end

function controllerStatus(params)
    broadcastStatus(params and params.color or nil)
end

function hotkeyNext(player_color)
    local player = Player[player_color]
    if requireControl(player) then advanceClock() end
end

function hotkeyBack(player_color)
    local player = Player[player_color]
    if requireControl(player) then stepBack() end
end

function hotkeyStatus(player_color)
    broadcastStatus(player_color)
end

function onChat(message, sender)
    if not message or string.sub(string.lower(message), 1, 4) ~= "!owe" then return true end
    local command = string.lower(message)
    if command == "!owe help" then
        broadcastToColor("!owe status · !owe next · !owe back. Host/promoted players control the clock; reload the save to reset the physical table.", sender.color, {0.89, 0.76, 0.45})
    elseif command == "!owe status" then
        broadcastStatus(sender.color)
    elseif command == "!owe next" then
        if requireControl(sender) then advanceClock() end
    elseif command == "!owe back" then
        if requireControl(sender) then stepBack() end
    else
        broadcastToColor("Unknown command. Type !owe help.", sender.color, {0.93, 0.42, 0.36})
    end
    return false
end
