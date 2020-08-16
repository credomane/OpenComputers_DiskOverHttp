
--[[Due to the OC Internet Card call budgets this current design is *extremely inefficient.
    Originally designed to work like the httpfs but that needs to change.
    httpfs work more like a NFS where 1 or many computers can use it at the same time.
    httpdrv can't work like that since it isn't a filesystem at all. Just raw access to a single "file".
    I won't stop you if you really want to use httpdrv on many systems at once but YMMV.
    So here is the TODO to patch this up:
    1. Create a single sector cache
    2. make readByte/writeByte piggy back of their sector siblings

    For 2 to happen the byte functions need to convert their absolute offset into a
--]]

local function httpdrv(address, server)
    local cls = {}
    cls._pri = {}
    cls._pri.address = address
    cls._pri.server = server

    function cls._pri.request(path, value, headers, method)
        local req = ci(cl("internet", true)(), "request", cls._pri.server .. "disk/" .. cls._pri.address .. "/" .. path, value, headers, method)
        if req.finishConnect() then
            local data = ""
            while true do
                local chunk, reason = req.read()
                if not chunk then
                    req.close();
                    if reason then
                        error(reason, 0)
                    end
                    break
                end
                data = data .. chunk
            end
            return data
        end
        return nil
    end

    function cls.getAddress()
        return cls._pri.address
    end

    function cls.readByte(offset)
        return tonumber(cls._pri.request("readbyte/" .. offset))
    end

    function cls.writeByte(offset, value)
        return toboolean(cls._pri.request("writebyte/" .. offset, { byte = value }, {}, "post"))
    end

    function cls.getSectorSize()
        return tonumber(cls._pri.request("sectorsize"))
    end

    function cls.getLabel()
        return cls._pri.request("label")
    end

    function cls.setLabel(value)
        return cls._pri.request("label", { label = value }, {}, "post")
    end

    function cls.readSector(sector)
        return tonumber(cls._pri.request("readsector/" .. sector))
    end

    function cls.writeSector(sector, value)
        return toboolean(cls._pri.request("writesector/" .. offset, { data = value }, {}, "post"))
    end

    function cls.getPlatterCount()
        return tonumber(cls._pri.request("plattercount"))
    end

    function cls.getCapacity()
        return tonumber(cls._pri.request("spacetotal"))
    end
    return cls
end
