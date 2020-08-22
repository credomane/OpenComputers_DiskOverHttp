local function httpdrv(address, server)
    local cls = {}
    cls._pri = {}
    cls._pri.address = address
    cls._pri.server = server
    cls._pri.sectorSize = nil
    cls._pri.capacity = nil
    cls._pri.platterCount = nil

    local cache = {}
    cache.enabled = true;
    cache.sector = nil;
    cache.sectorData = nil;

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

    function cls.getSectorSize()
        if cls._pri.sectorSize == nil then
            cls._pri.sectorSize = tonumber(cls._pri.request("sectorsize"))
        end
        return cls._pri.sectorSize
    end

    function cls.getPlatterCount()
        if cls._pri.platterCount == nil then
            cls._pri.platterCount = tonumber(cls._pri.request("plattercount"))
        end
        return cls._pri.platterCount
    end

    function cls.getCapacity()
        if cls._pri.capacity == nil then
            cls._pri.capacity = tonumber(cls._pri.request("capacity"))
        end
        return cls._pri.capacity
    end

    function cls.getLabel()
        return cls._pri.request("label")
    end

    function cls.setLabel(value)
        return cls._pri.request("label", { label = value }, {}, "post")
    end

    function cls.readSector(sector)
        if cache.enabled then
            if cache.sector ~= sector then
                cache.sectorData = cls._pri.request("readsector/" .. sector)
                cache.sector = sector
            end
            return cache.sectorData
        end
        return cls._pri.request("readsector/" .. sector)
    end

    function cls.writeSector(sector, value)
        return toboolean(cls._pri.request("writesector/" .. sector, { data = value }, {}, "post"))
    end

    function cls.readByte(offset)
        --readByte actually reads a sector to cache then reads bytes from that cache.
        --When sector boundaries are crossed the cached sector is swapped.
        local sector = math.floor(offset / this.getSectorSize());
        local sectorOffset = offset % sector;
        if cache.enabled then
            local sectorData
            if cache.sector ~= sector then
                sectorData = cls.readSector(sector);
            end

            return sectorData:sub(sectorOffset, sectorOffset);
        end

        return cls._pri.request("readbyte/" .. offset)
    end

    function cls.writeByte(offset, value)
        --Sadly since we don't want to desync because of a reboot/shutdown we need to send every write to the http server.
        --This forces writeByte to be always be slow.
        local sector = math.floor(offset / this.getSectorSize());
        local sectorOffset = offset % sector;
        if cache.enabled then
            if cache.sector ~= sector then
                cache.sectorData = cls.readSector(sector);
                cache.sector = sector
            end

            cache.sectorData = table.concat({ cache.sectorData:sub(1, sectorOffset - 1), value, cache.sectorData:sub(sectorOffset + 1) })
            return toboolean(cls.writeSector(sector, cache.sectorData))
        end

        return toboolean(cls._pri.request("writebyte/" .. offset, { byte = value }, {}, "post"))
    end

    return cls
end
