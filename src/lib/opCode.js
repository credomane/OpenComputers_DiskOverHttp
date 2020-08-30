const OpCode = {};

let myOPS = {};
let myParameters = {};

OpCode.getByName = function (op) {
    for (let opCode in myOPS) {
        if (op.toLowerCase() === myOPS[opCode].name.toLowerCase()) {
            return parseInt(opCode);
        }
    }
    return "";
};

OpCode.getByCode = function (op) {
    if (myOPS.hasOwnProperty(op) && myOPS[op].hasOwnProperty("name")) {
        return myOPS[op].name;
    }
    return false;
};

OpCode.run = function (opcode, socket, args, custom, fileHandles) {
    let params = {};
    //Make a copy. We don't want ops deleting parameters for future op calls.
    Object.assign(params, myParameters);

    if (myOPS.hasOwnProperty(opcode) && typeof (myOPS[opcode].execute) === "function") {
        myOPS[opcode].execute(socket, args, custom, fileHandles, params);
        return true;
    }
    return false;
}

OpCode.register = function (op) {
    const opName = op.name.toLowerCase()
    const opCode = op.opCode;
    if (!myOPS.hasOwnProperty(opCode)) {
        myOPS[opCode] = op;
        return true;
    }
    console.log(opName + " wants opCode " + opCode + " but it is already taken by " + myOPS[opCode].name);
    return false;
}


OpCode.unregister = function (op) {
    if (typeof (op) === "number" && myOPS.hasOwnProperty(op)) {
        delete myOPS[op];
        return true;
    }
    return false;
}

OpCode.addParameter = function (name, value) {
    if (!myParameters.hasOwnProperty(name)) {
        myParameters[name] = value;
        return true;
    }
    return false;
}

OpCode.removeParameter = function (name) {
    if (myParameters.hasOwnProperty(name)) {
        delete myParameters[name];
        return true;
    }
    return false;
}

OpCode.addParameter("ops", OpCode);

module.exports = OpCode;
