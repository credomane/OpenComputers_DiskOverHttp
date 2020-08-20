local function toboolean(val)
    --Seems only some lua version have this? or maybe someone else implemented it and I can't find the lua source for it?
    if val == "true" or val == 1 or val == "1" then
        return true
    end
    return false
end

local function httpfs(address, server)

    local cls = {}
    cls._pri = {}
    cls._pri.address = address
    cls._pri.server = server
    cls._pri.nextHandle = 1 --What file handle id to hand out next?
    cls._pri.handles = {} --holds open handles

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
        return nil, "Failed to connect"
    end

    function cls.getAddress()
        return cls._pri.address
    end

    function cls.spaceUsed()
        return tonumber(cls._pri.request("spaceused"))
    end

    function cls.open(path, mode)
        mode = mode or "r"
        if mode ~= "r" and mode ~= "r+" and mode ~= "w" and mode ~= "w+" and mode ~= "a" and mode ~= "a+" then
            return false, "Invalid open mode" .. mode
        end

        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        local size = tonumber(cls._pri.request("open" .. path, "mode=" .. mode, {}, "POST"))
        if size < 0 then
            --Maybe we tried to read mode a non-existent file or write/append mode a file on a readonly filesystem
            return false, "File doesn't exist"
        end

        local handle = cls._pri.nextHandle
        cls._pri.handles[handle] = {}
        cls._pri.handles[handle].path = path;
        cls._pri.handles[handle].mode = mode;
        cls._pri.handles[handle].size = size;
        cls._pri.handles[handle].pointer = 0;

        cls._pri.nextHandle = cls._pri.nextHandle + 1
        return handle
    end

    function cls.seek(handle, whence, offset)
        local h = cls._pri.handles[handle]
        if h == nil then
            return false
        end

        whence = whence or "cur"
        offset = offset or 0

        if whence == "set" then
            h.pointer = offset
        elseif whence == "cur" then
            h.pointer = h.pointer + offset
        elseif whence == "end" then
            h.pointer = h.size + offset
        end

        if h.pointer < 0 then
            h.pointer = 0
        elseif h.pointer > h.size then
            h.pointer = h.size
        end

        return h.pointer
    end

    function cls.makeDirectory(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        return toboolean(cls._pri.request("mkdir" .. path, "", {}, "POST"))
    end

    function cls.exists(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        return toboolean(cls._pri.request("exists" .. path))
    end

    function cls.isReadOnly()
        return toboolean(cls._pri.request("readonly"))
    end

    function cls.write(handle, value)
        local h = cls._pri.handles[handle]
        if h == nil then
            return false
        end
        if h.path:sub(1, 1) ~= "/" then
            h.path = "/" .. h.path
        end

        local char_to_hex = function(c)
            return string.format("%%%02X", string.byte(c))
        end

        local valenc = ""
        valenc = value:gsub("\n", "\r\n")
        valenc = valenc:gsub("([^%w ])", char_to_hex)
        valenc = valenc:gsub(" ", "+")

        local data = "offset=" .. h.pointer .. "&data=" .. valenc;

        return toboolean(cls._pri.request("write" .. h.path, data, {}, "POST"))
    end

    function cls.spaceTotal()
        return tonumber(cls._pri.request("spacetotal"))
    end

    function cls.isDirectory(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        return toboolean(cls._pri.request("isdir" .. path))
    end

    function cls.rename(from, to)
        if from:sub(1, 1) ~= "/" then
            from = "/" .. from
        end

        return toboolean(cls._pri.request("rename" .. from, { to = to }, {}, "POST"))
    end

    function cls.list(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        local results = cls._pri.request("list" .. path)
        if results == "false" then
            return {}
        end
        results = load(results)()
        return results
    end

    function cls.lastModified(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        return tonumber(cls._pri.request("lastmodified" .. path))

    end

    function cls.getLabel()
        return cls._pri.request("label")
    end

    function cls.remove(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        return toboolean(cls._pri.request("remove" .. path, "", {}, "POST"))
    end

    function cls.close(handle)
        if cls._pri.handles[handle] == nil then
            return false
        end

        cls._pri.handles[handle] = nil;
        return true;
    end

    function cls.size(path)
        if path:sub(1, 1) ~= "/" then
            path = "/" .. path
        end

        local size = tonumber(cls._pri.request("size" .. path))
        if size == -1 then
            return false
        end
        return size
    end

    function cls.read(handle, count)
        local h = cls._pri.handles[handle]
        if h == nil then
            return false
        end

        if h.pointer >= h.size then
            return nil
        end

        local data = "offset=" .. h.pointer .. "&count=" .. count;
        local result = cls._pri.request("read" .. h.path, data, {}, "POST")

        h.pointer = h.pointer + result:len();

        return result
    end

    function cls.setLabel(value)
        return cls._pri.request("label", "label=" .. value, {}, "POST")
    end

    return cls
end
