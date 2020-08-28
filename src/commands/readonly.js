module.exports = {
    "name": "readonly",
    "description": "Allows for marking filesystem disks as readonly.",
    help(args) {
        return `readonly <disk uuid>
readonly <disk uuid> <true|false>`;
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length < 1) {
            console.log("A disk UUID is required");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length > 2) {
            console.log("Too many args");
            return false;
        }

        const diskMan = params.diskMan;
        const disk = args._[0].toString().toLowerCase();

        if (!diskMan.isValidUUID(disk)) {
            console.log("diskUUID is not a valid uuid");
            return false;
        }

        if (!diskMan.exists(disk)) {
            console.log("diskUUID does not exist");
            return false;
        }

        if (!diskMan.isManaged(disk)) {
            console.log("diskUUID does not a filesystem disk");
            return false;
        }

        const diskFS = diskMan.loadFilesystem(disk);
        let readOnly = diskFS.isReadOnly(disk);
        if (args._.length === 1) {
            console.log(disk + " is " + (readOnly ? "read-only" : "writable"));
        } else {
            let newReadOnly = diskMan.setReadOnly(!!args._[1]);
            console.log(disk + " was " + (readOnly ? "read-only" : "writable") + " and is now " + (newReadOnly ? "read-only" : "writable"));
        }
        return true
    }
};
