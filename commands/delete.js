let confirmDisk = null;
let confirmCode = null;
let confirmNeed = false;

module.exports = {
    "name": "delete",
    "description": "Deletes disks by UUID",
    help(args) {
        return "";
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length < 1) {
            console.log("Too few arguments.");
            return false;
        }

        let disk = args._[0];

        if (confirmNeed) {
            if (args._.length < 2) {
                console.log("Too few arguments.");
                args._[1] = "failed";
            }

            let code = args._[1];
            if (disk === confirmDisk && code === confirmCode) {
                confirmDisk = null;
                confirmCode = null;
                confirmNeed = false;
                params.diskMan.deleteDisk(disk);
                console.log("Disk with uuid '" + disk + "' has been deleted");
                return true;
            } else {
                confirmDisk = null;
                confirmCode = null;
                confirmNeed = false;
                console.log("Confirmation failed");
                return false;
            }
        }
        if (args._.length > 1) {
            console.log("Too many arguments.");
            return false;
        }


        if (!params.diskMan.isValidUUID(disk)) {
            console.log("diskUUID is not a valid uuid");
            return false;
        }

        if (!params.diskMan.exists(disk)) {
            console.log("diskUUID does not exist");
            return false;
        }

        let code = Math.floor(Math.random() * 10000);
        confirmDisk = disk;
        confirmCode = code;
        confirmNeed = true;
        console.log("Please confirm deletion with: 'delete " + disk + " " + code + "'");
    }
};
