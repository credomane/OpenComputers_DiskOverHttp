const minimist = require("minimist");
const Commands = {};

let myCommands = {};
let myParameters = {};

Commands.run = function (arg) {
    arg = arg.split(" ")
    let cmd = arg.shift();
    let args = minimist(arg);

    if (cmd.startsWith("/")) {
        cmd = cmd.substring(1, cmd.length).toLowerCase();
    }

    let params = {};
    //Make a copy. We don't want commands deleting parameters for future commands calls.
    Object.assign(params, myParameters);

    if (cmd === "list") {
        console.forcelog("Command : Description");
        console.forcelog("/help : Provides help with commands");
        console.forcelog("/list : Lists all registered commands");
        for (let command in myCommands) {
            let description = myCommands[command].hasOwnProperty("description") ? " : " + myCommands[command].description : "";
            console.forcelog("/" + command + description);
        }
        return true;
    }
    if (cmd === "help") {
        if (args._.length === 0) {
            console.forcelog("Use '/list' to get a list of commands then do '/help command' to get that command's help");
            return true;
        }

        let cmd = args._.shift().toLowerCase();
        if (cmd === "help") {
            console.forcelog("You need help for '/help'? ...Maybe just back up a bit? You're scaring me.");
            return true;
        }

        if (cmd === "list") {
            console.forcelog("Just try it! Do it! type '/list' and see what happens.");
            return true;
        }

        if (!myCommands.hasOwnProperty(cmd)) {
            console.forcelog("The command '/" + cmd + "' isn't registered.");
            return true;
        }

        if (!myCommands[cmd].hasOwnProperty("help")) {
            console.forcelog("The command '/" + cmd + "' doesn't provide any help.");
            return true;
        }

        if (typeof myCommands[cmd].help === "string") {
            //This command provides a more basic help text.
            console.forcelog(myCommands[cmd].help);
            return true;
        }
        if (typeof myCommands[cmd].help === "function") {
            //This command provides a more "interactive" help.
            let helpText = myCommands[cmd].help(args);
            if (typeof helpText !== "string") {
                console.forcelog("help function for '/" + cmd + "' didn't return help text");
                return true;
            }
            console.forcelog(helpText);
            return true;
        }

        console.forcelog("The help data for '" + cmd + "' is not a string or function");
        return true;
    }
    if (typeof (myCommands[cmd].execute) === "function") {
        myCommands[cmd].execute(args, params);
        return true;
    }
    return false;
}

Commands.register = function (cmd) {
    const cmdName = cmd.name.toLowerCase()
    if (!myCommands.hasOwnProperty(cmdName)) {
        myCommands[cmdName] = cmd;
        return true;
    }
    console.forcelog(cmdName + " is already registered");
    return false;
}


Commands.unregister = function (cmd) {
    if (typeof (cmd) === "string" && myCommands.hasOwnProperty(cmd.toLowerCase())) {
        delete myCommands[cmd.toLowerCase()];
        return true;
    }
    return false;
}

Commands.addParameter = function (name, value) {
    if (!myParameters.hasOwnProperty(name)) {
        myParameters[name] = value;
        return true;
    }
    return false;
}

Commands.removeParameter = function (name) {
    if (myParameters.hasOwnProperty(name)) {
        delete myParameters[name];
        return true;
    }
    return false;
}

module.exports = Commands;
