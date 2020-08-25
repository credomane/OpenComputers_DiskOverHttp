module.exports = {
    "name": "stop",
    "description": "Use /stop instead",
    "help": "",
    execute(args, params) {
        //This is just here for show. The real command is in the index.js file.
        params.commands.run("/stop")
    }
};
