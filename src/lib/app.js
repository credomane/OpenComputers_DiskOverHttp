const OCdisk = require("./OCDisk");
const ec = require("./ErrorCodes");
const ConsoleHijack = require("./ConsoleHijack");
const Commands = require("./Commands");

class app {

    constructor() {
        this.diskMan = new OCdisk(__dirname + "/disks/");
    }

    setup() {

    }

    run() {

    }
}


module.exports = app;
