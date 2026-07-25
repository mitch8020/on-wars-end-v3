function onLoad()
    self.clearButtons()
    self.createButton({
        click_function = "noop",
        function_owner = self,
        label = "CONFERENCE CLOCK\nWaiting for setup",
        position = {0, 0.18, -0.72},
        rotation = {0, 0, 0},
        width = 0,
        height = 0,
        font_size = 165,
        font_color = {0.93, 0.86, 0.68},
    })
    self.createButton({
        click_function = "advance",
        function_owner = self,
        label = "NEXT",
        position = {0.8, 0.18, 0.28},
        rotation = {0, 0, 0},
        width = 980,
        height = 420,
        font_size = 205,
        color = {0.66, 0.42, 0.21},
        font_color = {1, 1, 1},
        tooltip = "Advance the conference clock by one delegation turn or table step.",
    })
    self.createButton({
        click_function = "back",
        function_owner = self,
        label = "BACK",
        position = {-1.8, 0.18, 0.28},
        rotation = {0, 0, 0},
        width = 700,
        height = 420,
        font_size = 175,
        color = {0.28, 0.27, 0.24},
        font_color = {1, 1, 1},
        tooltip = "Step the clock back once. This does not undo moved pieces.",
    })
    self.createButton({
        click_function = "status",
        function_owner = self,
        label = "STATUS",
        position = {2.55, 0.18, 0.28},
        rotation = {0, 0, 0},
        width = 700,
        height = 420,
        font_size = 165,
        color = {0.22, 0.35, 0.32},
        font_color = {1, 1, 1},
        tooltip = "Broadcast the current round, phase, chair, and active country.",
    })
end

function setStatus(data)
    if not data then return end
    self.editButton({index = 0, label = data.label or "CONFERENCE CLOCK"})
    self.editButton({index = 1, label = data.advance or "NEXT"})
end

function advance(_, color)
    Global.call("controllerAdvance", {color = color})
end

function back(_, color)
    Global.call("controllerBack", {color = color})
end

function status(_, color)
    Global.call("controllerStatus", {color = color})
end

function noop() end
