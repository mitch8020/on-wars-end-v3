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
PANEL_HEIGHT_EXPANDED = "504"
PANEL_HEIGHT_COLLAPSED = "70"
TURN_MODE_NATIVE = "native"
TURN_MODE_MANUAL = "manual"
MANUAL_OPEN_CONFIRM_SECONDS = 5
SEAT_RECOVERY_CONFIRM_SECONDS = 5
SEAT_RECOVERY_SETTLE_SECONDS = 10
NATIVE_RESUME_QUIET_SECONDS = 1
SAVE_SCHEMA_VERSION = 1
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
SETUP_INSTRUCTION = "Choose the active roster, sit in matching color seats, take only the active delegations' private cards, then enter dispatch and open the conference."
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
    turnMode = TURN_MODE_NATIVE,
}

syncingTurns = false
turnSyncGeneration = 0
nativeTurnResyncSignature = nil
nativeTurnFaultSignature = nil
panelCollapsed = false
finishArmed = false
finishArmGeneration = 0
manualOpenArmed = false
manualOpenSignature = nil
manualOpenGeneration = 0
seatRecoveryArmedSignature = nil
seatRecoveryGeneration = 0
seatRecoveryPending = nil
seatRecoveryPendingGeneration = 0
seatRefreshPending = false
lastSeatBlockReason = nil
seatRefreshGeneration = 0
lastSeatCountryFingerprint = nil
lastSeatExactActive = nil
nativeSeatResumeRequired = false
nativeResumeSettling = false
nativeResumeGeneration = 0
nativeResumeClockSignature = nil
nativeResumeTargetColor = nil
loadFault = nil
loadFaultSavedData = nil

function onLoad(saved_data)
    loadFault = nil
    loadFaultSavedData = nil
    if saved_data and saved_data ~= "" then
        local ok, loaded = pcall(JSON.decode, saved_data)
        if ok and validateSavedState(loaded) then
            loaded.schemaVersion = nil
            state = loaded
        else
            resetStateToSafeSetup()
            loadFault = "Saved conference state is invalid or from an unsupported future version. " ..
                "No scripted mutation is available. Reload a trusted untouched save; do not OPEN over this table."
            loadFaultSavedData = saved_data
        end
    end
    normalizeState()
    -- A running Native save can deserialize a populated Turns order before
    -- delayed initialization, and a reload/hotseat handoff can emit the same
    -- onPlayerTurn colors as a real End Turn. Quarantine synchronously before
    -- any callback can progress the conference; exact seating is re-audited by
    -- the visible docket Resume.
    nativeResumeSettling = false
    nativeResumeGeneration = nativeResumeGeneration + 1
    nativeResumeClockSignature = nil
    nativeResumeTargetColor = nil
    nativeSeatResumeRequired = not loadFault and state.started and state.turnMode == TURN_MODE_NATIVE
    if loadFault or nativeSeatResumeRequired then disableTurnsSafely() end
    addHotkey("On War's End: next", hotkeyNext, false)
    addHotkey("On War's End: back", hotkeyBack, false)
    addHotkey("On War's End: status", hotkeyStatus, false)
    Wait.frames(function()
        updateAll()
        if loadFault then
            printToAll("[On War's End] LOAD BLOCKED. " .. loadFault, {0.93, 0.42, 0.36})
        else
            printToAll("[On War's End] Conference clock ready. Type !owe help for commands.", {0.89, 0.76, 0.45})
        end
    end, 3)
    Wait.time(frameSetupHost, 6)
end

function onSave()
    if loadFault and loadFaultSavedData then return loadFaultSavedData end
    local saved = {
        schemaVersion = SAVE_SCHEMA_VERSION,
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
    }
    return JSON.encode(saved)
end

function resetStateToSafeSetup()
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
end

function validSavedInteger(value, minimum, maximum)
    return type(value) == "number" and value == math.floor(value) and value >= minimum and value <= maximum
end

function validateSavedState(candidate)
    if type(candidate) ~= "table" then return false end
    local allowed = {
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
    for key, _ in pairs(candidate) do
        if type(key) ~= "string" or not allowed[key] then return false end
    end
    local schema = candidate.schemaVersion
    if schema ~= nil and schema ~= SAVE_SCHEMA_VERSION then return false end
    if type(candidate.started) ~= "boolean" or
        not validSavedInteger(candidate.playerCount, 2, 6) or
        not validSavedInteger(candidate.dispatchCode, 1, 999999999) or
        not validSavedInteger(candidate.round, 1, 6) or
        not tableContains(PHASES, candidate.phase) or
        not validSavedInteger(candidate.chairIndex, 1, candidate.playerCount) or
        not validSavedInteger(candidate.turnIndex, 1, candidate.playerCount) then
        return false
    end
    if schema == SAVE_SCHEMA_VERSION and
        candidate.turnMode ~= TURN_MODE_NATIVE and candidate.turnMode ~= TURN_MODE_MANUAL then
        return false
    end
    if schema == nil and candidate.turnMode ~= nil and
        candidate.turnMode ~= TURN_MODE_NATIVE and candidate.turnMode ~= TURN_MODE_MANUAL then
        return false
    end
    if candidate.outcome ~= nil and candidate.outcome ~= "signed" and candidate.outcome ~= "rounds" then
        return false
    end
    if candidate.endFromPhase ~= nil and
        (not tableContains(PHASES, candidate.endFromPhase) or candidate.endFromPhase == "ended") then
        return false
    end
    if candidate.endFromTurn == nil or
        not validSavedInteger(candidate.endFromTurn, 1, candidate.playerCount) then
        return false
    end
    if candidate.phase == "ended" then
        if not candidate.started or candidate.outcome == nil or
            candidate.endFromPhase == nil or candidate.endFromTurn == nil or candidate.turnIndex ~= 1 then
            return false
        end
        if candidate.outcome == "rounds" and
            (candidate.round ~= 6 or candidate.endFromPhase ~= "aftermath" or candidate.endFromTurn ~= 1) then
            return false
        end
        if candidate.outcome == "signed" and
            candidate.endFromPhase ~= "summit" and candidate.endFromPhase ~= "aftermath" then
            return false
        end
        if candidate.outcome == "signed" and
            candidate.endFromPhase == "aftermath" and candidate.endFromTurn ~= 1 then
            return false
        end
    elseif candidate.outcome ~= nil or candidate.endFromPhase ~= nil then
        return false
    end
    if not candidate.started and
        (candidate.round ~= 1 or candidate.phase ~= "briefing" or candidate.chairIndex ~= 1 or
            candidate.turnIndex ~= 1 or candidate.endFromTurn ~= 1 or
            (candidate.turnMode ~= nil and candidate.turnMode ~= TURN_MODE_NATIVE)) then
        return false
    end
    if candidate.started then
        local expected_chair = ((chooseFirstChair(candidate.dispatchCode, candidate.playerCount) +
            candidate.round - 2) % candidate.playerCount) + 1
        if candidate.chairIndex ~= expected_chair then return false end
        if (candidate.phase == "briefing" or candidate.phase == "aftermath") and
            candidate.turnIndex ~= 1 then
            return false
        end
        if candidate.phase ~= "ended" and candidate.endFromTurn ~= nil and candidate.endFromTurn ~= 1 then
            return false
        end
    end
    return true
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
    if state.turnMode ~= TURN_MODE_MANUAL then state.turnMode = TURN_MODE_NATIVE end
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

function countryAtSeatColor(color)
    for _, country in ipairs(COUNTRIES) do
        if SEAT_COLORS[country] == color then return country end
    end
    return nil
end

function classifySeats(seated_colors, player_count)
    local occupied = {}
    local neutral = {}
    for _, color in ipairs(seated_colors or {}) do
        occupied[color] = true
        if not countryAtSeatColor(color) then table.insert(neutral, color) end
    end
    table.sort(neutral)

    local result = {
        activeSeated = 0,
        missingActive = {},
        occupiedInactive = {},
        neutralObservers = neutral,
    }
    for index, country in ipairs(COUNTRIES) do
        local color = SEAT_COLORS[country]
        local item = {
            country = country,
            countryName = COUNTRY_NAMES[country],
            color = color,
        }
        if index <= player_count then
            if occupied[color] then
                result.activeSeated = result.activeSeated + 1
            else
                table.insert(result.missingActive, item)
            end
        elseif occupied[color] then
            table.insert(result.occupiedInactive, item)
        end
    end

    local fingerprint_parts = {tostring(player_count)}
    local fingerprint_colors = {}
    local country_fingerprint_colors = {}
    for color, is_occupied in pairs(occupied) do
        if is_occupied then
            table.insert(fingerprint_colors, color)
            if countryAtSeatColor(color) then table.insert(country_fingerprint_colors, color) end
        end
    end
    table.sort(fingerprint_colors)
    table.sort(country_fingerprint_colors)
    for _, color in ipairs(fingerprint_colors) do table.insert(fingerprint_parts, color) end
    result.fingerprint = table.concat(fingerprint_parts, "|")
    local country_fingerprint_parts = {tostring(player_count)}
    for _, color in ipairs(country_fingerprint_colors) do
        table.insert(country_fingerprint_parts, color)
    end
    result.countryFingerprint = table.concat(country_fingerprint_parts, "|")
    result.exactActiveSeats = #result.missingActive == 0 and #result.occupiedInactive == 0
    return result
end

function auditSeats()
    local seated_colors = {}
    for _, player in ipairs(Player.getPlayers()) do
        if player and player.seated then table.insert(seated_colors, player.color) end
    end
    return classifySeats(seated_colors, state.playerCount)
end

function seatedDelegationCount()
    return auditSeats().activeSeated
end

function spectatorPlayers()
    local ok, spectators = pcall(function() return Player.getSpectators() end)
    if not ok or type(spectators) ~= "table" then return {} end
    return spectators
end

function playerAtColor(color)
    if not color then return nil end
    if color == "Grey" then
        local spectators = spectatorPlayers()
        if #spectators == 1 then return spectators[1] end
        return nil
    end
    local ok, player = pcall(function() return Player[color] end)
    if not ok then return nil end
    return player
end

function availableSeatColors()
    local ok, colors = pcall(function() return Player.getAvailableColors() end)
    if not ok or type(colors) ~= "table" then return {} end
    return colors
end

function unicodeScalarAt(value, index)
    -- MoonSharp strings are UTF-16. Its string.byte intentionally maps code
    -- units above 255 to "?", while string.unicode exposes the real unit.
    -- Return the source-unit width, scalar value, and malformed flag. The
    -- standard-Lua fallback validates one UTF-8 scalar for local tooling.
    if string.unicode then
        local first = string.unicode(value, index)
        if not first then return 0, nil, false end
        if first >= 0xD800 and first <= 0xDBFF then
            local second = string.unicode(value, index + 1)
            if second and second >= 0xDC00 and second <= 0xDFFF then
                return 2, 0x10000 + ((first - 0xD800) * 0x400) + (second - 0xDC00), false
            end
            return 1, 0x3F, true
        end
        if first >= 0xDC00 and first <= 0xDFFF then return 1, 0x3F, true end
        return 1, first, false
    end
    local first = string.byte(value, index)
    if not first then return 0, nil, false end
    if first < 0x80 then return 1, first, false end
    local second = string.byte(value, index + 1)
    if first >= 0xC2 and first <= 0xDF and second and second >= 0x80 and second <= 0xBF then
        return 2, ((first - 0xC0) * 0x40) + (second - 0x80), false
    end
    local third = string.byte(value, index + 2)
    if first >= 0xE0 and first <= 0xEF and second and third and
        second >= 0x80 and second <= 0xBF and third >= 0x80 and third <= 0xBF and
        not (first == 0xE0 and second < 0xA0) and not (first == 0xED and second >= 0xA0) then
        return 3, ((first - 0xE0) * 0x1000) + ((second - 0x80) * 0x40) + (third - 0x80), false
    end
    local fourth = string.byte(value, index + 3)
    if first >= 0xF0 and first <= 0xF4 and second and third and fourth and
        second >= 0x80 and second <= 0xBF and third >= 0x80 and third <= 0xBF and
        fourth >= 0x80 and fourth <= 0xBF and
        not (first == 0xF0 and second < 0x90) and not (first == 0xF4 and second > 0x8F) then
        return 4, ((first - 0xF0) * 0x40000) + ((second - 0x80) * 0x1000) +
            ((third - 0x80) * 0x40) + (fourth - 0x80), false
    end
    return 1, 0x3F, true
end

function conciseUnicodeLabel(value, maximum_characters, kept_characters)
    local unit_length = #value
    local index = 1
    local character_count = 0
    local kept_unit_end = 0
    while index <= unit_length do
        character_count = character_count + 1
        local width = unicodeScalarAt(value, index)
        if width == 0 or index + width - 1 > unit_length then width = 1 end
        if character_count <= kept_characters then kept_unit_end = index + width - 1 end
        if character_count > maximum_characters then
            return string.sub(value, 1, kept_unit_end) .. "..."
        end
        index = index + width
    end
    return value
end

function playerLabelSeparator(scalar)
    return scalar <= 0x20 or (scalar >= 0x7F and scalar <= 0x9F) or
        scalar == 0x5B or scalar == 0x5D or scalar == 0x3C or scalar == 0x3E or
        scalar == 0xA0 or scalar == 0xAD or scalar == 0x34F or scalar == 0x61C or
        scalar == 0x1680 or scalar == 0x180E or
        (scalar >= 0x115F and scalar <= 0x1160) or
        (scalar >= 0x17B4 and scalar <= 0x17B5) or
        (scalar >= 0x180B and scalar <= 0x180F) or
        (scalar >= 0x1BCA0 and scalar <= 0x1BCA3) or
        (scalar >= 0x2000 and scalar <= 0x200A) or
        (scalar >= 0x200B and scalar <= 0x200F) or
        (scalar >= 0x2028 and scalar <= 0x202E) or
        scalar == 0x202F or scalar == 0x205F or
        (scalar >= 0x2060 and scalar <= 0x206F) or scalar == 0x3000 or
        scalar == 0x3164 or scalar == 0xFFA0 or
        (scalar >= 0xFE00 and scalar <= 0xFE0F) or scalar == 0xFEFF or
        (scalar >= 0xFFF0 and scalar <= 0xFFF8) or
        (scalar >= 0x1D173 and scalar <= 0x1D17A) or
        (scalar >= 0xE0000 and scalar <= 0xE0FFF)
end

function sanitizePlayerLabel(value)
    local pieces = {}
    local pending_space = false
    local index = 1
    while index <= #value do
        local width, scalar, malformed = unicodeScalarAt(value, index)
        if index + width - 1 > #value then width = 1 end
        if malformed then
            if pending_space then
                table.insert(pieces, " ")
                pending_space = false
            end
            table.insert(pieces, "?")
        elseif playerLabelSeparator(scalar) then
            if #pieces > 0 then pending_space = true end
        else
            if pending_space then
                table.insert(pieces, " ")
                pending_space = false
            end
            table.insert(pieces, string.sub(value, index, index + width - 1))
        end
        index = index + width
    end
    return table.concat(pieces)
end

function concisePlayerName(player)
    local label = tostring(player and player.steam_name or "Grey spectator")
    label = sanitizePlayerLabel(label)
    if label == "" then label = "Grey spectator" end
    return conciseUnicodeLabel(label, 28, 25)
end

function nativeSeatRecoveryIdentity(player)
    local steam_id = tostring(player and player.steam_id or "")
    local steam_name = tostring(player and player.steam_name or "")
    if steam_id == "" or sanitizePlayerLabel(steam_name) == "" then return nil end
    -- Player instances returned by TTS are transient wrappers and do not compare
    -- equal across repeated spectator queries. Bind the grant to the
    -- stable account/name tuple instead, with lengths so delimiters cannot collide.
    return tostring(#steam_id) .. ":" .. steam_id .. "|" ..
        tostring(#steam_name) .. ":" .. steam_name
end

function seatColorAvailable(color)
    for _, available in ipairs(availableSeatColors()) do
        if available == color then return true end
    end
    return false
end

function nativeSeatRecoveryContext(audit)
    if not state.started or state.phase == "ended" or state.turnMode ~= TURN_MODE_NATIVE then return nil end
    audit = audit or auditSeats()
    if #audit.occupiedInactive > 0 or #audit.missingActive ~= 1 then return nil end
    local spectators = spectatorPlayers()
    if #spectators ~= 1 or not spectators[1] then return nil end
    local missing = audit.missingActive[1]
    if not seatColorAvailable(missing.color) then return nil end
    local spectator = spectators[1]
    local player_name = concisePlayerName(spectator)
    local identity = nativeSeatRecoveryIdentity(spectator)
    if not identity then return nil end
    local context_signature = clockTurnSignature() .. "|" .. audit.fingerprint .. "|" ..
        missing.country .. "|" .. missing.color .. "|" .. identity
    return {
        player = spectator,
        playerName = player_name,
        missing = missing,
        contextSignature = context_signature,
        signature = context_signature .. "|" .. tostring(seatRefreshGeneration),
    }
end

function nativeSeatRecoveryOpportunity(audit)
    if seatRefreshPending or seatRecoveryPending or nativeResumeSettling then return nil end
    return nativeSeatRecoveryContext(audit)
end

function seatItemList(items)
    local labels = {}
    for _, item in ipairs(items) do
        table.insert(labels, item.color .. " (" .. item.countryName .. ")")
    end
    return table.concat(labels, ", ")
end

function manualOpenWarning(audit)
    return "Missing active seats: " .. seatItemList(audit.missingActive) ..
        ". Press CONFIRM MANUAL HOTSEAT within 5 seconds. Native End Turn will remain disabled; " ..
        "use the conference clock controls. Pass control before viewing each private hand. " ..
        "One operator controlling multiple countries is open information."
end

function manualOpenInstruction(audit)
    local count = #audit.missingActive
    local noun = count == 1 and "seat is" or "seats are"
    return "Manual hotseat confirmation armed: " .. tostring(count) .. " active " .. noun ..
        " missing. Press again within 5 seconds; native End Turn will stay off."
end

function inactiveSeatBlockMessage(audit)
    return "Inactive country seats occupied: " .. seatItemList(audit.occupiedInactive) ..
        ". Move those players to active country or neutral observer seats before continuing."
end

function seatBlockInstruction(audit)
    if state.started and state.phase == "ended" then return nil end
    if #audit.occupiedInactive > 0 then
        local noun = #audit.occupiedInactive == 1 and "seat is" or "seats are"
        local prefix = state.started and "Seating paused" or "Opening blocked"
        return prefix .. ": " .. tostring(#audit.occupiedInactive) .. " inactive country " .. noun ..
            " occupied. Move those players to active or neutral seats."
    end
    if state.started and state.turnMode == TURN_MODE_NATIVE and #audit.missingActive > 0 then
        local noun = #audit.missingActive == 1 and "seat is" or "seats are"
        local prefix = "Native Turns paused: " .. tostring(#audit.missingActive) .. " active " .. noun ..
            " missing."
        if seatRecoveryPending and seatRecoveryPending.color == audit.missingActive[1].color then
            return prefix .. " Seat assignment requested for " .. seatRecoveryPending.playerName .. " as " ..
                seatRecoveryPending.color .. " (" .. seatRecoveryPending.countryName ..
                "). Complete any TTS hotseat handoff dialog; the conference clock has not moved."
        end
        local recovery = nativeSeatRecoveryOpportunity(audit)
        if recovery then
            if seatRecoveryArmedSignature == recovery.signature then
                return prefix .. " Confirm assigning " .. recovery.playerName .. " as " ..
                    recovery.missing.color .. " (" .. recovery.missing.countryName ..
                    "). The conference clock will not move."
            end
            return prefix .. " A host or promoted player may assign the only Grey spectator, " ..
                recovery.playerName .. ", as " .. recovery.missing.color .. " (" ..
                recovery.missing.countryName .. "). The conference clock has not moved."
        end
        return prefix .. " ASSIGN needs one named Grey with a Steam account. Use TTS Change Color, " ..
            "finish any prompt, then Resume here; clock unchanged."
    end
    return nil
end

function disarmManualOpen()
    manualOpenArmed = false
    manualOpenSignature = nil
    manualOpenGeneration = manualOpenGeneration + 1
end

function armManualOpen(audit, target_color)
    manualOpenArmed = true
    manualOpenSignature = audit.fingerprint
    manualOpenGeneration = manualOpenGeneration + 1
    local generation = manualOpenGeneration
    local warning = manualOpenWarning(audit)
    updateUI()
    if target_color then
        broadcastToColor(warning, target_color, {0.93, 0.76, 0.36})
    else
        printToAll("[On War's End] " .. warning, {0.93, 0.76, 0.36})
    end
    Wait.time(function()
        if manualOpenArmed and manualOpenGeneration == generation then
            disarmManualOpen()
            updateUI()
        end
    end, MANUAL_OPEN_CONFIRM_SECONDS)
end

function disarmSeatRecovery()
    seatRecoveryArmedSignature = nil
    seatRecoveryGeneration = seatRecoveryGeneration + 1
end

function clearSeatRecoveryPending()
    seatRecoveryPending = nil
    seatRecoveryPendingGeneration = seatRecoveryPendingGeneration + 1
end

function armSeatRecovery(recovery, target_color)
    seatRecoveryArmedSignature = recovery.signature
    seatRecoveryGeneration = seatRecoveryGeneration + 1
    local generation = seatRecoveryGeneration
    updateUI()
    local message = "Confirm assigning the only Grey spectator, " .. recovery.playerName .. ", as " ..
        recovery.missing.color .. " (" .. recovery.missing.countryName ..
        ") within 5 seconds. TTS may show a player-name or hotseat handoff dialog. Complete it, then resume " ..
        "Native Turns from the docket; the conference clock will remain paused."
    if target_color then
        broadcastToColor(message, target_color, {0.93, 0.76, 0.36})
    else
        printToAll("[On War's End] " .. message, {0.93, 0.76, 0.36})
    end
    Wait.time(function()
        if seatRecoveryArmedSignature == recovery.signature and seatRecoveryGeneration == generation then
            disarmSeatRecovery()
            updateUI()
        end
    end, SEAT_RECOVERY_CONFIRM_SECONDS)
end

function beginSeatRecoveryPending(recovery)
    seatRecoveryPending = {
        contextSignature = recovery.contextSignature,
        playerName = recovery.playerName,
        countryName = recovery.missing.countryName,
        color = recovery.missing.color,
    }
    seatRecoveryPendingGeneration = seatRecoveryPendingGeneration + 1
    local generation = seatRecoveryPendingGeneration
    updateUI()
    Wait.time(function()
        if seatRecoveryPending and seatRecoveryPendingGeneration == generation then
            clearSeatRecoveryPending()
            -- A platform handoff may settle without emitting another color
            -- event. Always perform a fresh generation-guarded audit instead
            -- of leaving native Turns empty behind apparently normal controls.
            scheduleSeatRefresh()
        end
    end, SEAT_RECOVERY_SETTLE_SECONDS)
end

function broadcastSeatRecoveryOutcome(message, preferred_color, tint)
    local delivered = false
    if preferred_color then
        local recipient = playerAtColor(preferred_color)
        if recipient and recipient.seated then
            delivered = pcall(function()
                broadcastToColor(message, preferred_color, tint)
            end)
        end
    end
    if not delivered then
        broadcastToAll("[On War's End] " .. message, tint)
    end
end

function restoreNativeSeat(player, target_color)
    if not player or not isHostOrPromoted(player) then
        disarmSeatRecovery()
        broadcastSeatBlock("Seat assignment must be confirmed from the docket by a current host or promoted player.",
            target_color)
        updateUI()
        return false
    end
    local recovery = nativeSeatRecoveryOpportunity(auditSeats())
    if not recovery or seatRecoveryArmedSignature ~= recovery.signature then
        disarmSeatRecovery()
        broadcastSeatBlock("Seat assignment conditions changed. Review the named Grey spectator and target seat, then arm it again.",
            target_color)
        updateUI()
        return false
    end
    disarmSeatRecovery()
    beginSeatRecoveryPending(recovery)
    local ok = pcall(function()
        return recovery.player.changeColor(recovery.missing.color)
    end)
    if not ok then
        clearSeatRecoveryPending()
        updateUI()
        broadcastSeatBlock("TTS could not assign " .. recovery.playerName .. " as " ..
            recovery.missing.color .. " (" .. recovery.missing.countryName ..
            "). Use Change Color or resolve the Grey-spectator ambiguity; the conference clock remains paused.",
            target_color)
        return false
    end
    scheduleSeatRefresh()
    local message = "TTS is assigning " .. recovery.playerName .. " as " .. recovery.missing.color ..
        " (" .. recovery.missing.countryName ..
        "). Complete any TTS hotseat handoff dialog. When exact seating settles, press RESUME NATIVE TURNS " ..
        "in the docket; the conference clock remains unchanged."
    -- The confirming actor may have moved from Grey to the private seat before
    -- this notice runs. Target the newly assigned color and fall back to a
    -- public notice if TTS has not finished registering that seat yet.
    broadcastSeatRecoveryOutcome(message, recovery.missing.color, {0.89, 0.76, 0.45})
    return true
end

function turnModeLabel()
    return state.turnMode == TURN_MODE_MANUAL and "MANUAL HOTSEAT" or "NATIVE TURNS"
end

function nativeSeatResumeMessage()
    return "Exact seating restored. Finish any TTS handoff, then press RESUME NATIVE TURNS. " ..
        "The clock stays fixed; native End Turn remains paused."
end

function nativeResumeSettlingMessage()
    return "Native seating is resuming at the unchanged clock state. Wait for one quiet second while delayed " ..
        "TTS handoff callbacks drain; every mutating conference clock control remains paused."
end

function endedNativeResumeMessage()
    return "Exact seating is restored. Select UNDO CLOCK to reopen the recorded conference state; the docket " ..
        "will then require RESUME NATIVE TURNS without moving the clock."
end

function forwardSeatBlockReason()
    if not state.started then return nil end
    if seatRecoveryPending then
        return "A seat assignment is pending. Complete any TTS player-name or hotseat handoff dialog, or wait " ..
            "for the retry audit. Every mutating conference clock control remains paused."
    end
    if seatRefreshPending then
        return "TTS seating is settling. Wait for the fresh seat audit; every mutating conference clock control remains paused."
    end
    local audit = auditSeats()
    recordSeatAudit(audit)
    if state.phase == "ended" then
        if #audit.occupiedInactive > 0 then return inactiveSeatBlockMessage(audit) end
        if state.turnMode == TURN_MODE_NATIVE and #audit.missingActive > 0 then
            return "Missing active seats: " .. seatItemList(audit.missingActive) ..
                ". Restore exact seating before Undo can reopen this ended Native conference."
        end
        -- A latch created while ended is preserved across Undo, then cleared
        -- only by the visible docket Resume in the restored running state.
        return nil
    end
    if #audit.occupiedInactive > 0 then return inactiveSeatBlockMessage(audit) end
    if state.turnMode == TURN_MODE_NATIVE and #audit.missingActive > 0 then
        return "Missing active seats: " .. seatItemList(audit.missingActive) ..
            ". Native turn play is paused at the current clock state until exact seating is restored."
    end
    if nativeResumeSettling then return nativeResumeSettlingMessage() end
    if nativeSeatResumeRequired then return nativeSeatResumeMessage() end
    return nil
end

function nativeTurnsAllowed()
    if not state.started or state.turnMode ~= TURN_MODE_NATIVE or not actionPhase() then return false end
    if seatRefreshPending or seatRecoveryPending or nativeSeatResumeRequired or nativeResumeSettling then return false end
    if nativeTurnFaultSignature == clockTurnSignature() then return false end
    return auditSeats().exactActiveSeats
end

function clockTurnSignature()
    return tostring(state.round) .. "|" .. tostring(state.phase) .. "|" ..
        tostring(state.chairIndex) .. "|" .. tostring(state.turnIndex)
end

function clearNativeTurnSafety()
    disarmSeatRecovery()
    clearSeatRecoveryPending()
    nativeSeatResumeRequired = false
    nativeResumeSettling = false
    nativeResumeGeneration = nativeResumeGeneration + 1
    nativeResumeClockSignature = nil
    nativeResumeTargetColor = nil
    nativeTurnResyncSignature = nil
    nativeTurnFaultSignature = nil
end

function broadcastSeatBlock(reason, target_color)
    if target_color then
        broadcastToColor(reason, target_color, {0.93, 0.42, 0.36})
    else
        printToAll("[On War's End] " .. reason, {0.93, 0.42, 0.36})
    end
end

function statusLine()
    if loadFault then
        return "LOAD BLOCKED · trusted untouched save required · scripted mutation quarantined"
    end
    if not state.started then
        return "Waiting for setup · " .. tostring(state.playerCount) .. " countries · dispatch " .. tostring(state.dispatchCode)
    end
    local mode = " · " .. turnModeLabel()
    local seat_block = forwardSeatBlockReason()
    local audit = auditSeats()
    local repair_required = #audit.occupiedInactive > 0 or
        (state.turnMode == TURN_MODE_NATIVE and #audit.missingActive > 0)
    local higher_priority_pause = repair_required or seatRefreshPending or seatRecoveryPending
    local pause = nativeResumeSettling and " · RESUMING NATIVE" or
        (higher_priority_pause and " · SEATING PAUSED" or
            (nativeSeatResumeRequired and " · RESUME REQUIRED" or
                (seat_block and " · SEATING PAUSED" or "")))
    local turn_fault = nativeTurnFaultSignature == clockTurnSignature() and " · NATIVE TURN UI PAUSED" or ""
    if state.phase == "ended" then
        local ending = state.outcome == "signed" and "All delegations signed" or "Six rounds complete"
        local ended_resume = nativeSeatResumeRequired and not repair_required and not seat_block and
            " · UNDO TO RESUME NATIVE" or ""
        local ended_pause = seat_block and " · SEATING PAUSED" or ""
        return "Round " .. tostring(state.round) .. "/6 · Conference ended · " .. ending ..
            mode .. ended_pause .. ended_resume
    end
    if not actionPhase() then
        return "Round " .. tostring(state.round) .. "/6 · " .. PHASE_NAMES[state.phase] ..
            " · Chair " .. COUNTRY_NAMES[chairCountry()] .. " · Table step" .. mode .. pause
    end
    return "Round " .. tostring(state.round) .. "/6 · " .. PHASE_NAMES[state.phase] ..
        " · Chair " .. COUNTRY_NAMES[chairCountry()] .. " · Active " .. COUNTRY_NAMES[activeCountry()] ..
        mode .. pause .. turn_fault
end

function currentInstruction()
    if loadFault then return loadFault end
    if not state.started then
        if seatRefreshPending then
            return "TTS seating is settling. Wait for the fresh seat audit before opening the conference."
        end
        local audit = auditSeats()
        if #audit.occupiedInactive > 0 then return seatBlockInstruction(audit) end
        if manualOpenArmed then return manualOpenInstruction(audit) end
        return SETUP_INSTRUCTION
    end
    if seatRecoveryPending then
        return "Seat assignment requested. Complete any TTS player-name or hotseat handoff dialog; every clock " ..
            "mutation remains paused and the conference clock has not moved."
    end
    if seatRefreshPending then
        return "TTS seating is settling. Wait for the fresh seat audit; every clock mutation remains paused."
    end
    local audit = auditSeats()
    if state.phase == "ended" then
        local ended_block = forwardSeatBlockReason()
        if ended_block then return ended_block end
        if nativeSeatResumeRequired then return endedNativeResumeMessage() end
        return INSTRUCTIONS.ended
    end
    local seat_block = seatBlockInstruction(audit)
    if seat_block then return seat_block end
    if nativeResumeSettling then return nativeResumeSettlingMessage() end
    if nativeSeatResumeRequired then return nativeSeatResumeMessage() end
    if nativeTurnFaultSignature == clockTurnSignature() then
        return "Native End Turn paused after an unexpected turn event. Use a conference clock control once; native Turns will retry on the next state."
    end
    local instruction = INSTRUCTIONS[state.phase]
    if state.turnMode == TURN_MODE_MANUAL and state.phase ~= "ended" then
        return instruction .. " Manual hotseat: use clock controls; native End Turn is off."
    end
    return instruction
end

function isHostOrPromoted(player)
    if not player then return true end
    return player.host == true or player.promoted == true
end

function requireControl(player)
    if loadFault then
        local message = "LOAD BLOCKED. " .. loadFault
        if player and player.color then
            broadcastToColor(message, player.color, {0.93, 0.42, 0.36})
        else
            printToAll("[On War's End] " .. message, {0.93, 0.42, 0.36})
        end
        return false
    end
    if isHostOrPromoted(player) then return true end
    broadcastToColor("Only the host or a promoted player may operate the conference clock.", player.color, {0.93, 0.42, 0.36})
    return false
end

function uiPlayerCount(player, value)
    if state.started or not requireControl(player) then
        updateAll()
        return
    end
    disarmManualOpen()
    state.playerCount = math.max(2, math.min(6, tonumber(value) or 6))
    state.chairIndex = math.min(state.chairIndex, state.playerCount)
    updateAll()
end

function uiDispatch(player, value)
    if state.started or not requireControl(player) then
        updateAll()
        return
    end
    disarmManualOpen()
    state.dispatchCode = math.max(1, math.floor(math.abs(tonumber(value) or 148802)))
    updateAll()
end

function uiStartConference(player)
    if state.started then
        if player then
            broadcastToColor("The conference is already underway. For a full reset, reload the untouched original save; this discards unsaved physical changes.", player.color, {0.93, 0.76, 0.36})
        end
        return
    end
    if not requireControl(player) then return end
    local target_color = player and player.color or nil
    if seatRefreshPending then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock("TTS seating is settling. Wait for the fresh seat audit before opening the conference.",
            target_color)
        return
    end
    local audit = auditSeats()
    if #audit.occupiedInactive > 0 then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock(inactiveSeatBlockMessage(audit), target_color)
        return
    end
    if audit.exactActiveSeats then
        commitConferenceStart(TURN_MODE_NATIVE, player, audit.fingerprint)
        return
    end
    if manualOpenArmed and manualOpenSignature == audit.fingerprint then
        commitConferenceStart(TURN_MODE_MANUAL, player, audit.fingerprint)
        return
    end
    armManualOpen(audit, target_color)
end

function commitConferenceStart(turn_mode, player, expected_audit_fingerprint)
    local target_color = player and player.color or nil
    if loadFault then
        broadcastSeatBlock("LOAD BLOCKED. " .. loadFault, target_color)
        return false
    end
    if state.started then
        broadcastSeatBlock("The conference is already underway. Reload the untouched original save for a full reset.",
            target_color)
        return false
    end
    if not player or not isHostOrPromoted(player) then
        broadcastSeatBlock("Only a current host or promoted player may open the conference.", target_color)
        return false
    end
    if seatRefreshPending then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock("TTS seating is settling. Wait for the fresh seat audit before opening the conference.",
            target_color)
        return false
    end
    local audit = auditSeats()
    if not expected_audit_fingerprint or expected_audit_fingerprint ~= audit.fingerprint then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock("Seating changed before OPEN could be confirmed. Review the fresh roster and try again.",
            target_color)
        return false
    end
    if turn_mode ~= TURN_MODE_NATIVE and turn_mode ~= TURN_MODE_MANUAL then
        broadcastSeatBlock("Choose native or manual-hotseat seating before opening the conference.", target_color)
        return false
    end
    if #audit.occupiedInactive > 0 then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock(inactiveSeatBlockMessage(audit), target_color)
        return false
    end
    if turn_mode == TURN_MODE_NATIVE and not audit.exactActiveSeats then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock("Native turn play requires every active country seat: " ..
            seatItemList(audit.missingActive) .. ".", target_color)
        return false
    end
    if turn_mode == TURN_MODE_MANUAL and
        (not manualOpenArmed or manualOpenSignature ~= audit.fingerprint) then
        disarmManualOpen()
        updateUI()
        broadcastSeatBlock("Manual Hotseat must be armed and confirmed from OPEN THE CONFERENCE within five seconds.",
            target_color)
        return false
    end
    disarmManualOpen()
    disarmFinish()
    clearNativeTurnSafety()
    -- Opening establishes the first trusted running-seat baseline. A missing
    -- setup audit followed by an exact Native OPEN is not an in-game seat
    -- restoration and must not create the Resume quarantine.
    lastSeatCountryFingerprint = audit.countryFingerprint
    lastSeatExactActive = audit.exactActiveSeats
    state.started = true
    state.turnMode = turn_mode
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
    local manual_notice = turn_mode == TURN_MODE_MANUAL and
        " Manual Hotseat uses conference clock controls and keeps native End Turn off. " ..
        "Distinct people may preserve private hands only by passing control; one operator is open information." or ""
    broadcastToAll("[On War's End] Dispatch " .. tostring(state.dispatchCode) .. " opens a " ..
        tostring(state.playerCount) .. "-country conference. " .. COUNTRY_NAMES[chairCountry()] ..
        " holds the first chair. " .. turnModeLabel() .. " selected." .. manual_notice, {0.89, 0.76, 0.45})
    return true
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
    local target_color = player and player.color or nil
    if seatRefreshPending then
        broadcastSeatBlock("TTS seating is settling. Wait for the fresh seat audit; the conference clock remains paused.",
            target_color)
        return
    end
    if seatRecoveryPending then
        broadcastSeatBlock("A seat assignment is already pending. Complete any TTS hotseat handoff dialog or wait for the retry timer; the conference clock remains paused.",
            target_color)
        return
    end
    if nativeResumeSettling then
        broadcastSeatBlock(nativeResumeSettlingMessage(), target_color)
        return
    end
    local audit = auditSeats()
    local recovery = nativeSeatRecoveryOpportunity(audit)
    if seatRecoveryArmedSignature and
        (not recovery or seatRecoveryArmedSignature ~= recovery.signature) then
        -- Consume the stale confirmation click. A replacement spectator or
        -- target must receive its own deliberate review and two-press grant.
        disarmSeatRecovery()
        recordSeatAudit(audit)
        updateAll()
        broadcastSeatBlock("Seat assignment conditions changed. Review the fresh docket action before confirming.",
            target_color)
        return
    end
    if recovery then
        if not player then
            disarmSeatRecovery()
            broadcastSeatBlock("Seat assignment must be clicked in the docket by a current host or promoted player.",
                target_color)
            updateUI()
            return
        end
        if seatRecoveryArmedSignature == recovery.signature then
            restoreNativeSeat(player, target_color)
        else
            armSeatRecovery(recovery, target_color)
        end
        return
    end
    if nativeSeatResumeRequired and audit.exactActiveSeats and #audit.occupiedInactive == 0 then
        resumeNativeTurns(player, target_color)
        return
    end
    disarmSeatRecovery()
    advanceClock(target_color)
end

function resumeNativeTurns(player, target_color)
    if not nativeSeatResumeRequired then return false end
    if not player or not isHostOrPromoted(player) then
        broadcastSeatBlock("Native Turns must be resumed from the docket by a current host or promoted player.",
            target_color)
        return false
    end
    if seatRefreshPending or seatRecoveryPending then
        broadcastSeatBlock("TTS seating is still settling. Complete the handoff and wait for the fresh seat audit; " ..
            "the conference clock remains paused.", target_color)
        return false
    end
    local audit = auditSeats()
    if state.phase == "ended" then
        broadcastSeatBlock("Undo the ended conference only after exact seating is restored; the docket will then " ..
            "offer Native Resume without moving the clock.", target_color)
        return false
    end
    if not state.started or state.turnMode ~= TURN_MODE_NATIVE or not audit.exactActiveSeats then
        updateAll()
        broadcastSeatBlock("Native seating cannot resume because exact active-country seating is no longer present.",
            target_color)
        return false
    end
    nativeSeatResumeRequired = false
    nativeTurnResyncSignature = nil
    nativeResumeSettling = true
    nativeResumeClockSignature = clockTurnSignature()
    nativeResumeTargetColor = target_color
    updateAll()
    scheduleNativeResumeSettlement()
    return true
end

function scheduleNativeResumeSettlement()
    if not nativeResumeSettling then return end
    nativeResumeGeneration = nativeResumeGeneration + 1
    local generation = nativeResumeGeneration
    Wait.time(function() finishNativeResumeSettlement(generation) end, NATIVE_RESUME_QUIET_SECONDS)
end

function finishNativeResumeSettlement(generation)
    if generation ~= nativeResumeGeneration or not nativeResumeSettling then return false end
    local audit = auditSeats()
    recordSeatAudit(audit)
    local unchanged = state.started and state.turnMode == TURN_MODE_NATIVE and state.phase ~= "ended" and
        clockTurnSignature() == nativeResumeClockSignature
    if not unchanged or not audit.exactActiveSeats or #audit.occupiedInactive > 0 then
        nativeResumeSettling = false
        nativeResumeClockSignature = nil
        local target_color = nativeResumeTargetColor
        nativeResumeTargetColor = nil
        nativeSeatResumeRequired = state.started and state.turnMode == TURN_MODE_NATIVE
        updateAll()
        broadcastSeatBlock("Native seating changed while resuming. Restore exact seating and use the fresh docket " ..
            "Resume; the conference clock remains unchanged.", target_color)
        return false
    end
    nativeResumeSettling = false
    nativeResumeClockSignature = nil
    local target_color = nativeResumeTargetColor
    nativeResumeTargetColor = nil
    nativeSeatResumeRequired = false
    updateAll()
    broadcastSeatRecoveryOutcome("Native seating resumed at the unchanged " .. statusLine() ..
        ". Native End Turn is available only during an action phase.", target_color,
        {0.55, 0.78, 0.70})
    return true
end

function uiBack(player)
    if not requireControl(player) then return end
    stepBack(player and player.color or nil)
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
        position = {x = -6, y = 0, z = 0},
        pitch = 68,
        yaw = 180,
        distance = 58,
    })
end

function frameSetupHost()
    if state.started or loadFault then return end
    for _, player in ipairs(Player.getPlayers()) do
        if player.host and player.color == "White" then
            frameOverview(player)
            return
        end
    end
end

function recordSeatAudit(audit)
    local previous_country_fingerprint = lastSeatCountryFingerprint
    local previous_exact_active = lastSeatExactActive
    lastSeatCountryFingerprint = audit.countryFingerprint
    lastSeatExactActive = audit.exactActiveSeats
    if previous_country_fingerprint and previous_country_fingerprint ~= audit.countryFingerprint then
        nativeTurnResyncSignature = nil
    end
    if previous_exact_active == false and audit.exactActiveSeats then
        nativeTurnFaultSignature = nil
        if state.started and state.turnMode == TURN_MODE_NATIVE then
            -- TTS's platform handoff and a genuine End Turn expose the same
            -- onPlayerTurn colors. Keep the native order empty until an
            -- authorized docket press confirms the user-timed dialog is done.
            nativeSeatResumeRequired = true
        end
    end
end

function scheduleSeatRefresh()
    if loadFault then
        disarmManualOpen()
        disarmFinish()
        disarmSeatRecovery()
        clearSeatRecoveryPending()
        seatRefreshPending = false
        disableTurnsSafely()
        updateUI()
        updateController()
        recordSeatAudit(auditSeats())
        return
    end
    if state.started and state.turnMode == TURN_MODE_NATIVE then
        -- TTS color/connect/disconnect callbacks can precede the corresponding
        -- Player.getPlayers() update and expose only the new color, not the
        -- departed identity. Latch synchronously so two coalesced stale/exact
        -- audits can never hide an interrupted country seat. A neutral-only
        -- event may therefore require one harmless same-clock docket Resume.
        nativeSeatResumeRequired = true
        disableTurnsSafely()
    end
    disarmManualOpen()
    disarmFinish()
    disarmSeatRecovery()
    if nativeResumeSettling then
        nativeResumeSettling = false
        nativeResumeGeneration = nativeResumeGeneration + 1
        nativeResumeClockSignature = nil
        nativeResumeTargetColor = nil
        nativeSeatResumeRequired = state.started and state.turnMode == TURN_MODE_NATIVE
    end
    seatRefreshPending = true
    if state.started and state.turnMode == TURN_MODE_NATIVE then disableTurnsSafely() end
    recordSeatAudit(auditSeats())
    updateUI()
    updateController()
    seatRefreshGeneration = seatRefreshGeneration + 1
    local generation = seatRefreshGeneration
    Wait.frames(function()
        if seatRefreshGeneration ~= generation then return end
        -- TTS does not guarantee that Player.getPlayers() has settled when the
        -- color event first fires. Re-audit at the generation-guarded boundary
        -- so a late exact-seat restoration can clear the same-state fault.
        local settled_audit = auditSeats()
        recordSeatAudit(settled_audit)
        if seatRecoveryPending then
            local recovery = nativeSeatRecoveryContext(settled_audit)
            local missing_changed = #settled_audit.missingActive ~= 1 or
                settled_audit.missingActive[1].color ~= seatRecoveryPending.color
            if settled_audit.exactActiveSeats or #settled_audit.occupiedInactive > 0 or
                missing_changed or not recovery or
                recovery.contextSignature ~= seatRecoveryPending.contextSignature then
                clearSeatRecoveryPending()
            end
        end
        seatRefreshPending = false
        updateAll()
        local block_reason = forwardSeatBlockReason()
        if block_reason ~= lastSeatBlockReason then
            lastSeatBlockReason = block_reason
            if block_reason then broadcastSeatBlock(block_reason) end
        end
    end, 2)
end

function onPlayerChangeColor(player_color)
    scheduleSeatRefresh()
end

function onPlayerConnect(player)
    scheduleSeatRefresh()
    if player and player.host then Wait.time(frameSetupHost, 6) end
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
    if syncingTurns then return false end
    if not state.started or (state.phase ~= "summit" and state.phase ~= "aftermath") then
        local message = "All signatures may be confirmed during the Peace Summit or Aftermath."
        if target_color then
            broadcastToColor(message, target_color, {0.93, 0.42, 0.36})
        else
            printToAll("[On War's End] " .. message, {0.93, 0.42, 0.36})
        end
        return
    end
    local seat_block = forwardSeatBlockReason()
    if seat_block then
        disarmFinish()
        updateAll()
        broadcastSeatBlock(seat_block, target_color)
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
    clearNativeTurnSafety()
    updateAll()
    broadcastToAll("[On War's End] Every active delegation has signed. The Vellan Accord is complete.", {0.55, 0.78, 0.70})
end

function advanceClock(target_color)
    if syncingTurns then return false end
    if not state.started then
        printToAll("[On War's End] " .. SETUP_INSTRUCTION, {0.89, 0.76, 0.45})
        return false
    end
    if state.phase == "ended" then return false end
    local seat_block = forwardSeatBlockReason()
    if seat_block then
        updateAll()
        broadcastSeatBlock(seat_block, target_color)
        return false
    end
    disarmFinish()
    clearNativeTurnSafety()
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
    return true
end

function stepBack(target_color)
    if syncingTurns or not state.started then return false end
    local seat_block = forwardSeatBlockReason()
    if seat_block then
        updateAll()
        broadcastSeatBlock(seat_block, target_color)
        return false
    end
    local preserve_native_resume = state.phase == "ended" and nativeSeatResumeRequired
    disarmFinish()
    clearNativeTurnSafety()
    if preserve_native_resume then nativeSeatResumeRequired = true end
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
    return true
end

function updateAll()
    normalizeState()
    updateUI()
    if loadFault then
        -- Load quarantine may explain the fault and clear serialized Turns,
        -- but it must not project invented safe-Setup state onto a physically
        -- progressed table. Markers, counters, decks, hands, and other game
        -- objects remain exactly where the rejected save left them.
        disableTurnsSafely()
        updateController()
        local quarantined_audit = auditSeats()
        recordSeatAudit(quarantined_audit)
        return
    end
    updateMarkers()
    updateTurns()
    updateController()
    local audit = auditSeats()
    recordSeatAudit(audit)
end

function updateUI()
    local is_setup = not state.started
    local setup_operable = is_setup and not loadFault
    local is_running = state.started and state.phase ~= "ended"
    local can_finish = state.started and (state.phase == "summit" or state.phase == "aftermath")
    local audit = auditSeats()
    local seat_block = forwardSeatBlockReason()
    local roster_suffix = ""
    if is_setup then
        if #audit.occupiedInactive > 0 then
            roster_suffix = " · BLOCKED"
        elseif #audit.missingActive > 0 then
            roster_suffix = " · " .. tostring(#audit.missingActive) .. " MISSING"
        else
            roster_suffix = " · READY"
        end
    else
        roster_suffix = " · " .. (state.turnMode == TURN_MODE_MANUAL and "MANUAL" or "NATIVE")
        if seat_block then roster_suffix = roster_suffix .. " · PAUSED" end
    end
    UI.setValue("roundText", loadFault and "LOAD BLOCKED" or
        (state.started and ("ROUND " .. tostring(state.round) .. " / 6") or "CONFERENCE SETUP"))
    UI.setValue("rosterText", tostring(audit.activeSeated) .. " / " .. tostring(state.playerCount) .. " SEATED · " ..
        tostring(state.playerCount) .. " ACTIVE" .. (loadFault and " · READ ONLY" or roster_suffix))
    UI.setValue("phaseText", loadFault and "Reload a trusted untouched save" or
        (state.started and PHASE_NAMES[state.phase] or "Choose the delegation roster"))
    if loadFault then
        UI.setValue("activeText", "SCRIPTED MUTATION QUARANTINED")
    elseif is_setup then
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
    local recovery = nativeSeatRecoveryOpportunity(audit)
    local recovery_armed = recovery and seatRecoveryArmedSignature == recovery.signature
    local advance_label = state.started and ADVANCE_LABELS[state.phase] or "OPEN THE CONFERENCE"
    local advance_tooltip = "Advance the conference clock one table step or delegation turn."
    local advance_colors = "#B8783F|#D39458|#84542B|#666860"
    if loadFault then
        advance_label = "LOAD BLOCKED"
        advance_tooltip = loadFault
        advance_colors = "#704037|#704037|#522E28|#666860"
    elseif seatRecoveryPending then
        advance_label = "SEAT CHANGE REQUESTED"
        advance_tooltip = "Complete any TTS player-name or hotseat handoff dialog. The clock does not move."
        advance_colors = "#666860|#666860|#666860|#666860"
    elseif seatRefreshPending then
        advance_label = "SEATING SETTLING"
        advance_tooltip = "Wait for the fresh seat audit. Every mutating conference clock control remains paused."
        advance_colors = "#666860|#666860|#666860|#666860"
    elseif nativeResumeSettling then
        advance_label = "RESUMING NATIVE TURNS"
        advance_tooltip = "Wait for one quiet second while delayed TTS handoff callbacks drain. The clock does not move."
        advance_colors = "#666860|#666860|#666860|#666860"
    elseif recovery then
        advance_label = (recovery_armed and "CONFIRM ASSIGN  " or "ASSIGN  ") ..
            string.upper(recovery.missing.countryName) .. " / " .. string.upper(recovery.missing.color)
        advance_tooltip = "Assign the only Grey spectator, " .. recovery.playerName .. ", as " ..
            recovery.missing.color .. " (" .. recovery.missing.countryName ..
            "). Two presses within five seconds. Complete the TTS handoff, then resume from this docket; " ..
            "the clock does not move."
        advance_colors = recovery_armed and "#B25345|#CD6959|#803B32|#666860" or
            "#5B8A81|#70A89D|#43665F|#666860"
    elseif seat_block and (#audit.occupiedInactive > 0 or #audit.missingActive > 0) then
        advance_label = "SEATING PAUSED"
        advance_tooltip = seat_block
        advance_colors = "#666860|#666860|#666860|#666860"
    elseif nativeSeatResumeRequired and state.phase == "ended" then
        advance_label = "CONFERENCE CLOSED"
        advance_tooltip = "Exact seating is restored. Select UNDO CLOCK, then Resume from the reopened docket."
        advance_colors = "#666860|#666860|#666860|#666860"
    elseif nativeSeatResumeRequired then
        advance_label = "RESUME NATIVE TURNS"
        advance_tooltip = "After completing the TTS player-name or hotseat handoff dialog, clear the seating " ..
            "quarantine at the unchanged clock state. Native End Turn remains action-phase only."
        advance_colors = "#5B8A81|#70A89D|#43665F|#666860"
    elseif seat_block then
        advance_label = "SEATING PAUSED"
        advance_tooltip = seat_block
        advance_colors = "#666860|#666860|#666860|#666860"
    end
    UI.setAttribute("advanceButton", "text", advance_label)
    UI.setAttribute("advanceButton", "tooltip", advance_tooltip)
    UI.setAttribute("advanceButton", "colors", advance_colors)
    UI.setAttribute("playerCount", "value", state.playerCount - 2)
    UI.setAttribute("playerCount", "interactable", setup_operable)
    UI.setValue("dispatchCode", tostring(state.dispatchCode))
    UI.setAttribute("dispatchCode", "interactable", setup_operable)
    UI.setAttribute("setupControls", "active", is_setup)
    UI.setAttribute("startButton", "active", is_setup)
    local start_label = "OPEN THE CONFERENCE"
    local start_tooltip = "Open on an untouched original table. This is not a full physical reset."
    local start_colors = "#5B8A81|#70A89D|#43665F|#666860"
    if loadFault then
        start_label = "LOAD BLOCKED"
        start_tooltip = loadFault
        start_colors = "#704037|#704037|#522E28|#666860"
    elseif seatRefreshPending then
        start_label = "SEATING SETTLING"
        start_tooltip = "Wait for the fresh seat audit before opening the conference."
        start_colors = "#666860|#666860|#666860|#666860"
    elseif #audit.occupiedInactive > 0 then
        start_label = "FIX INACTIVE SEATING"
        start_tooltip = inactiveSeatBlockMessage(audit)
        start_colors = "#704037|#925348|#522E28|#666860"
    elseif manualOpenArmed and manualOpenSignature == audit.fingerprint then
        start_label = "CONFIRM MANUAL HOTSEAT"
        start_tooltip = manualOpenWarning(audit)
        start_colors = "#B8783F|#D39458|#84542B|#666860"
    end
    UI.setAttribute("startButton", "text", start_label)
    UI.setAttribute("startButton", "tooltip", start_tooltip)
    UI.setAttribute("startButton", "colors", start_colors)
    UI.setAttribute("startButton", "interactable", setup_operable and not seatRefreshPending)
    UI.setAttribute("advanceButton", "active", is_running)
    UI.setAttribute("clockTools", "active", true)
    UI.setAttribute("advanceButton", "interactable",
        is_running and not seatRecoveryPending and not seatRefreshPending and not nativeResumeSettling and
        (not seat_block or recovery ~= nil or
            (nativeSeatResumeRequired and audit.exactActiveSeats and #audit.occupiedInactive == 0)))
    UI.setAttribute("backButton", "interactable", not loadFault and state.started and not seat_block)
    UI.setAttribute("finishButton", "active", can_finish)
    UI.setAttribute("finishButton", "interactable", not loadFault and can_finish and not seat_block)
    UI.setAttribute("finishButton", "text", finishArmed and "CONFIRM ALL SIGNED  /  CLOSE NOW" or
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
    UI.setAttribute("clockPanel", "height", panelCollapsed and PANEL_HEIGHT_COLLAPSED or PANEL_HEIGHT_EXPANDED)
    UI.setAttribute("collapseButton", "text", panelCollapsed and "+" or "−")
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

function beginTurnsSync()
    turnSyncGeneration = turnSyncGeneration + 1
    local generation = turnSyncGeneration
    syncingTurns = true
    return generation
end

function finishTurnsSync(generation)
    Wait.frames(function()
        if turnSyncGeneration == generation then syncingTurns = false end
    end, 2)
end

function disableTurnsSafely()
    local order = Turns.order
    -- TTS Hotseat can keep the raw enable flag true; an empty order is the
    -- effective fail-closed state and must not trigger another mutation loop.
    if type(order) ~= "table" or #order == 0 then return false end
    local generation = beginTurnsSync()
    Turns.enable = false
    Turns.order = {}
    Turns.enable = false
    finishTurnsSync(generation)
    return true
end

function updateTurns()
    local generation = beginTurnsSync()
    Turns.enable = false
    Turns.order = {}
    Turns.enable = false
    local signature = clockTurnSignature()
    if nativeTurnsAllowed() and nativeTurnFaultSignature ~= signature then
        local colors = {}
        for _, country in ipairs(activeOrder()) do table.insert(colors, SEAT_COLORS[country]) end
        Turns.type = 2
        Turns.order = colors
        Turns.reverse_order = false
        Turns.skip_empty_hands = false
        Turns.disable_interactations = false
        Turns.pass_turns = false
        Turns.turn_color = SEAT_COLORS[activeCountry()]
        Turns.enable = true
    end
    finishTurnsSync(generation)
end

function handleUnexpectedNativeTurn()
    local signature = clockTurnSignature()
    disableTurnsSafely()
    if nativeTurnFaultSignature == signature then return end
    if nativeTurnResyncSignature ~= signature then
        nativeTurnResyncSignature = signature
        local seat_signature = auditSeats().fingerprint
        Wait.frames(function()
            if clockTurnSignature() == signature and auditSeats().fingerprint == seat_signature and
                nativeTurnFaultSignature ~= signature then
                updateTurns()
            end
        end, 2)
    else
        nativeTurnFaultSignature = signature
        updateUI()
        updateController()
        broadcastToAll("[On War's End] Native End Turn paused after an unexpected turn event. " ..
            "Use a conference clock control once; native Turns will retry on the next state.",
            {0.93, 0.42, 0.36})
    end
end

function onPlayerTurn(player, previous_player)
    if not player then return end
    if nativeResumeSettling then
        disableTurnsSafely()
        scheduleNativeResumeSettlement()
        return
    end
    if syncingTurns then return end
    if seatRefreshPending or seatRecoveryPending then
        disableTurnsSafely()
        return
    end
    if nativeTurnFaultSignature == clockTurnSignature() then
        disableTurnsSafely()
        return
    end
    if not nativeTurnsAllowed() then
        disableTurnsSafely()
        return
    end
    local current_color = SEAT_COLORS[activeCountry()]
    -- Hotseat emits onPlayerTurn when local control is handed to the player
    -- whose turn is already active. That focus handoff can include the prior
    -- virtual player, but it is not an End Turn transition.
    if player.color == current_color then return end
    if not previous_player then
        handleUnexpectedNativeTurn()
        return
    end
    local expected_next = state.turnIndex < state.playerCount and state.turnIndex + 1 or 1
    local expected_country = COUNTRIES[rosterIndexAtTurn(expected_next)]
    if previous_player.color ~= current_color or player.color ~= SEAT_COLORS[expected_country] then
        handleUnexpectedNativeTurn()
        return
    end
    advanceClock()
end

function updateController()
    local controller = getObjectFromGUID(GUIDS.controller)
    if not controller then return end
    local seat_block = forwardSeatBlockReason()
    local audit = auditSeats()
    local repair_required = #audit.occupiedInactive > 0 or
        (state.turnMode == TURN_MODE_NATIVE and #audit.missingActive > 0)
    local ended_resume = state.phase == "ended" and nativeSeatResumeRequired and
        not repair_required and not seat_block
    controller.call("setStatus", {
        label = "CONFERENCE CLOCK\n" .. statusLine(),
        advance = loadFault and "LOAD BLOCKED" or
            (seatRecoveryPending and "SEAT CHANGE REQUESTED") or
            (seatRefreshPending and "SEATING SETTLING") or
            (nativeResumeSettling and "NATIVE TURNS RESUMING") or
            (repair_required and "SEATING PAUSED") or
            (ended_resume and "CONFERENCE CLOSED") or
            (nativeSeatResumeRequired and "RESUME IN DOCKET") or
            (seat_block and "SEATING PAUSED") or
            (state.started and ADVANCE_LABELS[state.phase] or "SET UP IN PANEL"),
        back = ended_resume and "UNDO\nTO RESUME" or "BACK",
        backTooltip = ended_resume and
            "Reopen the recorded ended-state clock. Native Turns stay paused until docket Resume." or
            "Step the clock back once. This does not undo moved pieces.",
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
    local audit = auditSeats()
    local detailed_instruction = currentInstruction()
    if state.phase ~= "ended" and #audit.occupiedInactive > 0 then
        detailed_instruction = inactiveSeatBlockMessage(audit)
    elseif state.started and state.phase ~= "ended" and state.turnMode == TURN_MODE_NATIVE and
        #audit.missingActive > 0 then
        detailed_instruction = forwardSeatBlockReason() or detailed_instruction
    end
    local message = "[On War's End] " .. statusLine() .. ". " .. detailed_instruction
    if target_color then
        broadcastToColor(message, target_color, {0.89, 0.76, 0.45})
    else
        broadcastToAll(message, {0.89, 0.76, 0.45})
    end
end

function controllerAdvance(params)
    local color = params and params.color or nil
    local player = playerAtColor(color)
    if not player then
        broadcastSeatBlock("The physical console cannot identify this operator. Use the docket; Grey control requires exactly one spectator.",
            color)
        return
    end
    if requireControl(player) then advanceClock(player.color) end
end

function controllerBack(params)
    local color = params and params.color or nil
    local player = playerAtColor(color)
    if not player then
        broadcastSeatBlock("The physical console cannot identify this operator. Use the docket; Grey control requires exactly one spectator.",
            color)
        return
    end
    if requireControl(player) then stepBack(color) end
end

function controllerStatus(params)
    broadcastStatus(params and params.color or nil)
end

function hotkeyNext(player_color)
    local player = playerAtColor(player_color)
    if not player then
        broadcastSeatBlock("This Game Key cannot identify the current operator. Use the docket; Grey control requires exactly one spectator.",
            player_color)
        return
    end
    if requireControl(player) then advanceClock(player_color) end
end

function hotkeyBack(player_color)
    local player = playerAtColor(player_color)
    if not player then
        broadcastSeatBlock("This Game Key cannot identify the current operator. Use the docket; Grey control requires exactly one spectator.",
            player_color)
        return
    end
    if requireControl(player) then stepBack(player_color) end
end

function hotkeyStatus(player_color)
    broadcastStatus(player_color)
end

function onChat(message, sender)
    if not message or string.sub(string.lower(message), 1, 4) ~= "!owe" then return true end
    local command = string.lower(message)
    if command == "!owe help" then
        broadcastToColor("!owe status · !owe next · !owe back · !owe finish · !owe view. Host/promoted players control the clock; seat assignment and RESUME NATIVE TURNS are docket-only. For a full reset, reload the untouched original save; this discards unsaved physical changes.", sender.color, {0.89, 0.76, 0.45})
    elseif command == "!owe status" then
        broadcastStatus(sender.color)
    elseif command == "!owe next" then
        if requireControl(sender) then advanceClock(sender.color) end
    elseif command == "!owe back" then
        if requireControl(sender) then stepBack(sender.color) end
    elseif command == "!owe finish" then
        if requireControl(sender) then finishConference(sender.color) end
    elseif command == "!owe view" then
        frameOverview(sender)
    else
        broadcastToColor("Unknown command. Type !owe help.", sender.color, {0.93, 0.42, 0.36})
    end
    return false
end
