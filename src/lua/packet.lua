local types = {
    none = 0,
    boolean = 1,
    number = 2,
    integer = 2,
    float = 3,
    string = 4,
    list = 5,
    array = 5,
    table = 6,
    dictionary = 6,
    object = 6
}

local function PacketSerializer(packetData)
    if (type(packetData) ~= "table") then
        error("PacketData is not an array or object")
    end

    local packetBuffer = ""

    local function saveRaw(value)
        packetBuffer = packetBuffer .. value
    end

    local function saveByte(value)
        saveRaw(string.char(value))
    end

    local function saveBool(value)
        if value then
            saveRaw(string.char(0x01))
        else
            saveRaw(string.char(0x00))
        end
    end

    local function saveUShort(value)
        local hex = string.format("%04x", value)
        saveRaw(string.char("0x" .. hex:sub(3, 4), "0x" .. hex:sub(1, 2)))
    end

    local function saveUInt(value)
        local hex = string.format("%08x", value)
        local ret = string.char("0x" .. hex:sub(7, 8), "0x" .. hex:sub(5, 6), "0x" .. hex:sub(3, 4), "0x" .. hex:sub(1, 2))
        saveRaw(ret)
    end

    local function saveULong(value)
        local hex = string.format("%016x", value)
        local ret = string.char("0x" .. hex:sub(15, 16), "0x" .. hex:sub(13, 14), "0x" .. hex:sub(11, 12), "0x" .. hex:sub(9, 10),
                "0x" .. hex:sub(7, 8), "0x" .. hex:sub(5, 6), "0x" .. hex:sub(3, 4), "0x" .. hex:sub(1, 2))
        saveRaw(ret)
    end

    local function saveDouble(value)
        local hex = string.format("%016x", value)
        local ret = string.char("0x" .. hex:sub(15, 16), "0x" .. hex:sub(13, 14), "0x" .. hex:sub(11, 12), "0x" .. hex:sub(9, 10),
                "0x" .. hex:sub(7, 8), "0x" .. hex:sub(5, 6), "0x" .. hex:sub(3, 4), "0x" .. hex:sub(1, 2))
        saveRaw(ret)
    end

    local function saveFloat(value)
        local hex = string.format("%016x", value)
        local ret = string.char("0x" .. hex:sub(15, 16), "0x" .. hex:sub(13, 14), "0x" .. hex:sub(11, 12), "0x" .. hex:sub(9, 10),
                "0x" .. hex:sub(7, 8), "0x" .. hex:sub(5, 6), "0x" .. hex:sub(3, 4), "0x" .. hex:sub(1, 2))
        saveRaw(ret)
    end

    local function saveString(value)
        local buf = tostring(value)

        if (buf:len() < 255) then
            saveByte(buf:len())
        else
            saveByte(255)
            saveUInt(buf:len())
        end
        saveRaw(buf)
    end

    local function savePropertyTree(tree)
        local ttype = type(tree)
        if ttype == "table" then
            local t = "list"
            for key, value in pairs(tree) do
                if type(key) ~= "number" then
                    t = "dictionary"
                    break
                end
            end
            ttype = t
        elseif ttype == "number" then
            local t = tostring(tree)
            if t:find(".", 1, true) then
                ttype = "float"
            end

        end

        saveByte(types[ttype])

        local count

        if types[ttype] == types.none then
        elseif types[ttype] == types.boolean then
            saveBool(tree)
        elseif types[ttype] == types.number then
            --Lua can't handle IEEE754 easily so be lazy and save it as a string instead
            --saveDouble(tree)
            saveString(tree)
        elseif types[ttype] == types.float then
            --Lua can't handle IEEE754 easily so be lazy and save it as a string instead
            --saveFloat(tree)
            saveString(tree)
        elseif types[ttype] == types.string then
            saveString(tree)
        elseif types[ttype] == types.list then
            count = #tree
            saveUInt(count)
            -- Save list values
            for key, value in pairs(tree) do
                saveString("")
                savePropertyTree(value)
            end
        elseif types[ttype] == types.dictionary then
            count = 0
            for _, _ in pairs(tree) do
                count = count + 1
            end

            saveUInt(count)

            -- Save dictionary values
            for key, value in pairs(tree) do
                saveString(tostring(key))
                savePropertyTree(value)
            end

        else
            error("Unknown type: " .. tostring(ttype))
        end
    end

    savePropertyTree(packetData)
    return packetBuffer
end

local function PacketDeserializer(packet)
    local packetBuffer = packet
    local packetOffset = 1

    local function loadRaw(length)
        local tmp = packetBuffer:sub(packetOffset, packetOffset + length)
        packetOffset = packetOffset + length
        return tmp
    end

    local function loadByte()
        return loadRaw(1):byte()
    end

    local function loadBool()
        return not not loadRaw(1)
    end

    local function loadUShort()
        local tmp = loadRaw(2)
        return tonumber(tmp:sub(2, 2) .. tmp:sub(1, 1))
    end

    local function loadUInt()
        local tmp = loadRaw(4)
        return tonumber(tmp:sub(4, 4) .. tmp:sub(3, 3) .. tmp:sub(2, 2) .. tmp:sub(1, 1))
    end

    local function loadULong()
        local tmp = loadRaw(8)
        return tonumber(tmp:sub(8, 8) .. tmp:sub(7, 7) .. tmp:sub(6, 6) .. tmp:sub(5, 5) .. tmp:sub(4, 4) .. tmp:sub(3, 3) .. tmp:sub(2, 2) .. tmp:sub(1, 1))
    end

    local function loadDouble()
        local tmp = loadRaw(8)
        return tonumber(tmp:sub(8, 8) .. tmp:sub(7, 7) .. tmp:sub(6, 6) .. tmp:sub(5, 5) .. tmp:sub(4, 4) .. tmp:sub(3, 3) .. tmp:sub(2, 2) .. tmp:sub(1, 1))
    end

    local function loadFloat()
        local tmp = loadRaw(8)
        return tonumber(tmp:sub(8, 8) .. tmp:sub(7, 7) .. tmp:sub(6, 6) .. tmp:sub(5, 5) .. tmp:sub(4, 4) .. tmp:sub(3, 3) .. tmp:sub(2, 2) .. tmp:sub(1, 1))
    end

    local function loadString()
        local stringSize = loadByte()
        if (stringSize == 255) then
            stringSize = loadUInt()
        end

        local buffer = loadRaw(stringSize)
        return buffer
    end

    local function loadPropertyTree()
        local ttype = loadByte()
        local count, data

        if ttype == types.none then
            return
        elseif ttype == types.boolean then
            return loadBool()
        elseif ttype == types.number then
            --Lua can't handle IEEE754 easily so we saved it as a string instead tonumber that string
            --return loadDouble()
            return tonumber(loadString())
        elseif ttype == types.float then
            --Lua can't handle IEEE754 easily so we saved it as a string instead tonumber that string
            --return loadFloat()
            return tonumber(loadString())
        elseif ttype == types.string then
            return loadString()
        elseif ttype == types.list then
            count = loadUInt()
            data = {}
            -- Read list values
            for i = 1, count do
                -- List uses the same key <> value format as Dictionary but the key is unused
                loadString()
                data[#data] = loadPropertyTree()
            end

            return data
        elseif ttype == types.dictionary then
            count = loadUInt()
            data = {}

            -- Read dictionary values
            for i = 1, count do
                local propName = loadString()
                data[propName] = loadPropertyTree()
            end

            return data
        else
            error("Unknown type: " .. tostring(ttype))
        end
    end

    return loadPropertyTree()
end

return {
    serialize = PacketSerializer,
    deserialize = PacketDeserializer
}
