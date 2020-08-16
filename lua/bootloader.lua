--Note these two shorthands are used by the httpfs.lua and httpdrv.lua
--Figured save the space since they all get concatenated together anyways.
--And we want to make them after vcomponent.lua takes them over.
local cl = component.list;
local ci = component.invoke;

local function bootdisk(disk, file)
    for address in cl("filesystem", true) do
        if address == disk then
            local handle, reason = ci(address, "open", file)
            if not handle then
                error("Can't open file: " .. reason, 0)
            end
            local code = ""
            while true do
                local data, reason = ci(address, "read", handle, math.huge)
                if not data then
                    ci(address, "close", handle);
                    if reason then
                        error(reason, 0)
                    end
                    break
                end
                code = code .. data
            end
            local init, reason = load(code, "=httpfs.init.lua")
            if not init then
                error(reason, 0)
            end
            return init
        end
    end
end

--[[Doing unmanaged drives old school cool way. Meaning they are expected to have a 512 byte MBR.
    Problem is LUA. LUA is going to interpret the whole 512 bytes before executing it.
    If you only need say 128 bytes to jump into your full-sized bootloader lua will try to interpret the remaining 384
    bytes as lua. So you will need to take special care to make sure lua won't crash out.
    I suggest playing it safe by padding what you don't use of the 512 bytes with spaces.
    Or since you are reading this just modify that little hardcoded value to what you need. ;P
    Due note that I haven't properly tested (read: not test one single bit) this code yet.
--]]
local function bootdrive(drive)
    for address in cl("drive", true) do
        if address == drive then
            local code, reason = ci(address, "readSector", 1)
            if not code then
                error("Can't read sector: " .. reason, 0)
            end

            code = code:sub(1,512);

            local init, reason = load(code, "=httpdrv.init.lua")
            if not init then
                error(reason, 0)
            end
            return init
        end
    end
end

local bootaddress = "";
computer.getBootAddress = function()
    return bootaddress
end
computer.setBootAddress = function(address)
    bootaddress = address
    return bootaddress
end

