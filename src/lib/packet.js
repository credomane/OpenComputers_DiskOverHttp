'use strict';

let types = {
    none: 0,
    boolean: 1,
    number: 2,
    integer: 2,
    float: 3,
    string: 4,
    list: 5,
    array: 5,
    dictionary: 6,
    object: 6
};

function PacketSerializer(packetData) {
    if (typeof (packetData) !== "object" && !Array.isArray(packetData)) {
        throw new Error("PacketData is not an array or object")
    }

    let packetBuffer = Buffer.alloc(0);

    let saveRaw = function (value) {
        packetBuffer = Buffer.concat([packetBuffer, value]);
    }

    let saveByte = function (value) {
        let buf = Buffer.alloc(1);
        buf.writeUInt8(value);
        saveRaw(buf);
    }

    let saveBool = function (value) {
        let buf = Buffer.alloc(1);
        //Gotta do this otherwise it always writes 1 no matter if value is true or false.
        //value = (!!value) ? 1 : 0;
        buf.writeUInt8(value);
        saveRaw(buf);
    }

    let saveUShort = function (value) {
        let buf = Buffer.alloc(2);
        buf.writeUInt16LE(value);
        saveRaw(buf);
    }

    let saveUInt = function (value) {
        let buf = Buffer.alloc(4);
        buf.writeUInt16LE(value);
        saveRaw(buf);
    }

    let saveULong = function (value) {
        let buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(value);
        saveRaw(buf);
    }

    let saveDouble = function (value) {
        let buf = Buffer.alloc(8);
        buf.writeDoubleLE(value);
        saveRaw(buf);
    }

    let saveFloat = function (value) {
        let buf = Buffer.from(value.toString());

        if (buf.length < 255) {
            saveByte(buf.length);
        } else {
            saveByte(255);
            saveUInt(buf.length);
        }
        saveRaw(buf);
    }

    let saveString = function (value) {
        let buf = Buffer.from(value);

        if (buf.length < 255) {
            saveByte(buf.length);
        } else {
            saveByte(255);
            saveUInt(buf.length);
        }
        saveRaw(buf);
    }

    let savePropertyTree = function (tree) {
        let type = typeof (tree);
        if (Array.isArray(tree)) {
            type = "list";
        } else if (type === "number" && tree.toString().includes(".")) {
            type = "float";
        }

        saveByte(types[type]);

        let count;

        switch (types[type]) {
            case types.none:
                break;
            case types.boolean:
                saveBool(tree);
                break;
            case types.number:
                //Lua can't handle IEEE754 easily so be lazy and save it as a string instead
                //saveDouble(tree);
                saveString(tree.toString());
                break;
            case types.float:
                //Lua can't handle IEEE754 easily so be lazy and save it as a string instead
                //saveFloat(tree);
                saveString(tree.toString());
                break;
            case types.string:
                saveString(tree);
                break;
            case types.list:
                count = tree.length;
                saveUInt(count);
                // Save list values
                tree.forEach(function (value) {
                    // List uses the same key <> value format as Dictionary but the key is unused
                    saveString("");
                    savePropertyTree(value);
                });
                break;
            case types.dictionary:
                count = Object.keys(tree).length;
                saveUInt(count);

                // Save dictionary values
                Object.keys(tree).forEach(function (value) {
                    saveString(value);
                    savePropertyTree(tree[value]);
                });
                break;
            default:
                throw new Error("Unknown type: " + type);
        }
    }

    savePropertyTree(packetData);
    return packetBuffer;
}


function PacketDeserializer(packet) {
    let packetBuffer = Buffer.from(packet);
    let packetOffset = 0;

    //Empty packet check
    if (packetBuffer.length === 0) {
        return {};
    }

    let loadRaw = function (length) {
        let tmp = packetBuffer.slice(packetOffset, packetOffset + length);
        packetOffset += length;
        return tmp;
    }

    let loadByte = function () {
        return loadRaw(1).readUInt8();
    }

    let loadBool = function () {
        return !!loadRaw(1).readUInt8();
    }

    let loadUShort = function () {
        return loadRaw(2).readUInt16LE();
    }

    let loadUInt = function () {
        return loadRaw(4).readUInt32LE();
    }

    let loadULong = function () {
        return loadRaw(8).readBigUInt64LE();
    }

    let loadDouble = function () {
        return loadRaw(8).readDoubleLE();
    }

    let loadFloat = function () {
        let stringSize = loadByte();
        if (stringSize === 255) {
            stringSize = loadUInt();
        }

        let buffer = loadRaw(stringSize);
        return parseFloat(buffer.toString("utf8"));
    }

    let loadString = function () {
        let stringSize = loadByte();
        if (stringSize === 255) {
            stringSize = loadUInt();
        }

        let buffer = loadRaw(stringSize);
        return buffer.toString("utf8");
    }

    let loadPropertyTree = function () {
        let type = loadByte();
        let count, data;

        switch (type) {
            case types.none:
                break;
            case types.boolean:
                return loadBool();
            case types.number:
                //Lua can't handle IEEE754 easily so we saved it as a string instead parseInt that string
                //return loadDouble();
                return parseInt(loadString());
            case types.float:
                //Lua can't handle IEEE754 easily so we saved it as a string instead parseFloat that string
                //return loadFloat();
                return parseFloat(loadString());
            case types.string:
                return loadString();
            case types.list:
                count = loadUInt();
                data = [];
                // Read list values
                for (let i = 0; i < count; ++i) {
                    // List uses the same key <> value format as Dictionary but the key is unused
                    loadString();
                    data[data.length] = loadPropertyTree();
                }

                return data;
            case types.dictionary:
                count = loadUInt();
                data = {};

                // Read dictionary values
                for (let i = 0; i < count; ++i) {
                    let propName = loadString();
                    data[propName] = loadPropertyTree();
                }

                return data;
            default:
                throw new Error("Unknown type: " + type);
        }
    }

    return loadPropertyTree()
}

module.exports.serialize = PacketSerializer;
module.exports.deserialize = PacketDeserializer;
