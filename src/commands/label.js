module.exports = {
    "name": "label",
    "description": "Gets/Sets a disk's label",
    help(args) {
        return `label <disk UUID>
    - Returns a disk's label
label <disk UUID> <new label>
    - Sets a disk's label`;
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

        let label = diskMan.getLabel(disk)
        if (args._.length === 1) {
            console.log("Label for " + disk + " is \"" + label + "\"");
        } else {
            args._.shift();
            let newLabel = diskMan.setLabel(disk, args._.join(" "));
            console.log("Changed label for " + disk + " from \"" + label + "\" to \"" + newLabel + "\"");
        }
        return true
    }
};
