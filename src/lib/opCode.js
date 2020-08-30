"use strict";

const fs = require("fs");

class OpCode {
    constructor(opCodeLocation) {
        const opCodeFiles = fs.readdirSync(opCodeLocation);

        this.ops = {};
        this.params = {};

        for (let file of opCodeFiles) {
            if (!file.endsWith(".js")) {
                continue;
            }
            let command = require(opCodeLocation + "/" + file);
            this.register(command);
        }
    }

    getByName = function (op) {
        for (let opCode in this.ops) {
            if (op.toLowerCase() === this.ops[opCode].name.toLowerCase()) {
                return parseInt(opCode);
            }
        }
        return "";
    };

    getByCode = function (op) {
        if (this.ops.hasOwnProperty(op) && this.ops[op].hasOwnProperty("name")) {
            return this.ops[op].name;
        }
        return false;
    };

    run = function (opcode, args) {
        if (this.ops.hasOwnProperty(opcode) && typeof (this.ops[opcode].execute) === "function") {
            this.ops[opcode].execute.call(this.params, args);
            return true;
        }
        return false;
    }

    register = function (op) {
        const opName = op.name.toLowerCase()
        const opCode = op.opCode;
        if (!this.ops.hasOwnProperty(opCode)) {
            this.ops[opCode] = op;
            return true;
        }
        console.log(opName + " wants opCode " + opCode + " but it is already taken by " + this.ops[opCode].name);
        return false;
    }


    unregister = function (op) {
        if (typeof (op) === "number" && this.ops.hasOwnProperty(op)) {
            delete this.ops[op];
            return true;
        }
        return false;
    }

    addParameter = function (name, value) {
        if (!this.params.hasOwnProperty(name)) {
            this.params[name] = value;
            return true;
        }
        return false;
    }

    removeParameter = function (name) {
        if (this.params.hasOwnProperty(name)) {
            delete this.params[name];
            return true;
        }
        return false;
    }

}

module.exports = OpCode;
