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
SETUP_INSTRUCTION = "Sit in the matching color seats. Choose the active roster and dispatch, then open the conference."
ADVANCE_LABELS = {
    briefing = "BEGIN CABINET",
    cabinet = "END CABINET TURN",
    crisis = "SEAL COMMITMENT",
    summit = "END SUMMIT TURN",
    aftermath = "NEXT ROUND",
    ended = "CONFERENCE CLOSED",
}
RAIL_PHASES = {"briefing", "cabinet", "crisis", "summit", "aftermath"}
RAIL_IDS = {
    briefing = "railBriefing",
    cabinet = "railCabinet",
    crisis = "railCrisis",
    summit = "railSummit",
    aftermath = "railAftermath",
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
panelCollapsed = false
finishArmed = false
finishArmGeneration = 0

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
    if state.outcome ~= "signed" and state.outcome ~= "rounds" then state.outcome = nil end
    if not tableContains(PHASES, state.endFromPhase) or state.endFromPhase == "ended" then
        state.endFromPhase = nil
    end
    state.endFromTurn = math.max(1, math.min(state.playerCount, tonumber(state.endFromTurn) or 1))
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

function activeRosterNames()
    local names = {}
    for index = 1, state.playerCount do
        table.insert(names, string.upper(COUNTRY_NAMES[COUNTRIES[index]]))
    end
    if #names > 3 then
        local first_row = {}
        local second_row = {}
        for index, name in ipairs(names) do
            table.insert(index <= 3 and first_row or second_row, name)
        end
        return table.concat(first_row, " · ") .. "\n" .. table.concat(second_row, " · ")
    end
    return table.concat(names, " · ")
end

function seatedDelegationCount()
    local count = 0
    for index = 1, state.playerCount do
        local player = Player[SEAT_COLORS[COUNTRIES[index]]]
        if player and player.seated then count = count + 1 end
    end
    return count
end

function statusLine()
    if not state.started then
        return "Waiting for setup · " .. tostring(state.playerCount) .. " countries · dispatch " .. tostring(state.dispatchCode)
    end
    if state.phase == "ended" then
        local ending = state.outcome == "signed" and "All delegations signed" or "Six rounds complete"
        return "Round " .. tostring(state.round) .. "/6 · Conference ended · " .. ending
    end
    if not actionPhase() then
        return "Round " .. tostring(state.round) .. "/6 · " .. PHASE_NAMES[state.phase] ..
            " · Chair " .. COUNTRY_NAMES[chairCountry()] .. " · Table step"
    end
    return "Round " .. tostring(state.round) .. "/6 · " .. PHASE_NAMES[state.phase] ..
        " · Chair " .. COUNTRY_NAMES[chairCountry()] .. " · Active " .. COUNTRY_NAMES[activeCountry()]
end

function currentInstruction()
    if not state.started then return SETUP_INSTRUCTION end
    return INSTRUCTIONS[state.phase]
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
    disarmFinish()
    state.started = true
    state.round = 1
    state.phase = "briefing"
    state.turnIndex = 1
    state.chairIndex = chooseFirstChair(state.dispatchCode, state.playerCount)
    state.outcome = nil
    state.endFromPhase = nil
    state.endFromTurn = 1
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

function uiStatus(player)
    broadcastStatus(player and player.color or nil)
end

function uiOverview(player)
    frameOverview(player)
end

function uiTogglePanel(player)
    panelCollapsed = not panelCollapsed
    applyPanelState()
end

function frameOverview(player)
    if not player then return end
    player.lookAt({
        position = {x = 0, y = 0, z = 0},
        pitch = 62,
        yaw = 180,
        distance = 55,
    })
end

function scheduleSeatRefresh()
    Wait.frames(function() updateUI() end, 2)
end

function onPlayerChangeColor(player_color)
    scheduleSeatRefresh()
end

function onPlayerConnect(player)
    scheduleSeatRefresh()
end

function onPlayerDisconnect(player)
    scheduleSeatRefresh()
end

function uiFinishConference(player)
    if not requireControl(player) then return end
    finishConference(player and player.color or nil)
end

function disarmFinish()
    finishArmed = false
    finishArmGeneration = finishArmGeneration + 1
end

function finishConference(target_color)
    if not state.started or (state.phase ~= "summit" and state.phase ~= "aftermath") then
        local message = "All signatures may be confirmed during the Peace Summit or Aftermath."
        if target_color then
            broadcastToColor(message, target_color, {0.93, 0.42, 0.36})
        else
            printToAll("[On War's End] " .. message, {0.93, 0.42, 0.36})
        end
        return
    end
    if not finishArmed then
        finishArmed = true
        finishArmGeneration = finishArmGeneration + 1
        local generation = finishArmGeneration
        updateUI()
        if target_color then
            broadcastToColor("Confirm ALL SIGNED within 5 seconds to close the conference.", target_color, {0.89, 0.76, 0.45})
        end
        Wait.time(function()
            if finishArmed and finishArmGeneration == generation then
                disarmFinish()
                updateUI()
            end
        end, 5)
        return
    end
    state.endFromPhase = state.phase
    state.endFromTurn = state.turnIndex
    state.outcome = "signed"
    state.phase = "ended"
    state.turnIndex = 1
    disarmFinish()
    updateAll()
    broadcastToAll("[On War's End] Every active delegation has signed. The Vellan Accord is complete.", {0.55, 0.78, 0.70})
end

function advanceClock()
    if not state.started then
        printToAll("[On War's End] Choose countries and a dispatch code, then Start conference.", {0.89, 0.76, 0.45})
        return
    end
    if state.phase == "ended" then return end
    disarmFinish()
    if state.phase == "briefing" then
        state.phase = "cabinet"
        state.turnIndex = 1
        dealPolicyHands()
    elseif state.phase == "aftermath" then
        if state.round >= 6 then
            state.endFromPhase = "aftermath"
            state.endFromTurn = 1
            state.outcome = "rounds"
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
    disarmFinish()
    if state.phase == "briefing" then
        if state.round <= 1 then return end
        state.round = state.round - 1
        state.chairIndex = ((state.chairIndex - 2) % state.playerCount) + 1
        state.phase = "aftermath"
        state.turnIndex = 1
    elseif state.phase == "ended" then
        state.phase = state.endFromPhase or "aftermath"
        state.turnIndex = state.endFromTurn or 1
        state.outcome = nil
        state.endFromPhase = nil
        state.endFromTurn = 1
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
    local is_setup = not state.started
    local is_running = state.started and state.phase ~= "ended"
    local can_finish = state.started and (state.phase == "summit" or state.phase == "aftermath")
    local seated = seatedDelegationCount()
    UI.setValue("roundText", state.started and ("ROUND " .. tostring(state.round) .. " / 6") or "CONFERENCE SETUP")
    UI.setValue("rosterText", tostring(seated) .. " / " .. tostring(state.playerCount) .. " SEATED · " ..
        tostring(state.playerCount) .. " ACTIVE")
    UI.setValue("phaseText", state.started and PHASE_NAMES[state.phase] or "Choose the delegation roster")
    if is_setup then
        UI.setValue("activeText", activeRosterNames())
    elseif actionPhase() then
        UI.setValue("activeText", "CHAIR  " .. COUNTRY_NAMES[chairCountry()] ..
            "    /    ACTING  " .. COUNTRY_NAMES[activeCountry()])
    elseif state.phase == "ended" then
        UI.setValue("activeText", state.outcome == "signed" and
            "ACCORD COMPLETE  /  ALL ACTIVE DELEGATIONS SIGNED" or
            "CONFERENCE CLOSED  /  SIX ROUNDS COMPLETE")
    else
        UI.setValue("activeText", "CHAIR  " .. COUNTRY_NAMES[chairCountry()] .. "    /    TABLE STEP")
    end
    UI.setValue("instructionText", currentInstruction())
    UI.setValue("advanceButton", state.started and ADVANCE_LABELS[state.phase] or "Start first")
    UI.setAttribute("playerCount", "value", state.playerCount - 2)
    UI.setAttribute("playerCount", "interactable", is_setup)
    UI.setValue("dispatchCode", tostring(state.dispatchCode))
    UI.setAttribute("dispatchCode", "interactable", is_setup)
    UI.setAttribute("setupControls", "active", is_setup)
    UI.setAttribute("startButton", "active", is_setup)
    UI.setAttribute("advanceButton", "active", is_running)
    UI.setAttribute("clockTools", "active", true)
    UI.setAttribute("advanceButton", "interactable", is_running)
    UI.setAttribute("backButton", "interactable", state.started)
    UI.setAttribute("finishButton", "active", can_finish)
    UI.setValue("finishButton", finishArmed and "CONFIRM ALL SIGNED  /  CLOSE NOW" or
        "ALL SIGNED  /  END CONFERENCE")
    UI.setAttribute("finishButton", "colors", finishArmed and
        "#B25345|#CD6959|#803B32|#666860" or "#704037|#925348|#522E28|#666860")
    updatePhaseRail()
    applyPanelState()
end

function updatePhaseRail()
    local current = phaseIndex()
    for index, phase in ipairs(RAIL_PHASES) do
        local color = "#777A72"
        if index < current then color = "#8FC0B6" end
        if index == current then color = "#C59A4A" end
        UI.setAttribute(RAIL_IDS[phase], "color", color)
        UI.setAttribute(RAIL_IDS[phase], "fontStyle", index == current and "Bold" or "Normal")
    end
end

function applyPanelState()
    UI.setAttribute("clockBody", "active", not panelCollapsed)
    UI.setAttribute("clockPanel", "height", panelCollapsed and "70" or "492")
    UI.setValue("collapseButton", panelCollapsed and "+" or "−")
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
    local message = "[On War's End] " .. statusLine() .. ". " .. currentInstruction()
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
        broadcastToColor("!owe status · !owe next · !owe back · !owe finish · !owe view. Host/promoted players control the clock; reload the save to reset the physical table.", sender.color, {0.89, 0.76, 0.45})
    elseif command == "!owe status" then
        broadcastStatus(sender.color)
    elseif command == "!owe next" then
        if requireControl(sender) then advanceClock() end
    elseif command == "!owe back" then
        if requireControl(sender) then stepBack() end
    elseif command == "!owe finish" then
        if requireControl(sender) then finishConference(sender.color) end
    elseif command == "!owe view" then
        frameOverview(sender)
    else
        broadcastToColor("Unknown command. Type !owe help.", sender.color, {0.93, 0.42, 0.36})
    end
    return false
end
