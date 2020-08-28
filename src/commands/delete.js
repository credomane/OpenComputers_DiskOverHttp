let confirmDisk = null;
let confirmCode = null;
let confirmTime = null;
let confirmNeed = false;

module.exports = {
    "name": "delete",
    "description": "Deletes disks by UUID",
    help(args) {
        return `Command must be ran twice within ten seconds.
1st run: delete <disk uuid>
2nd run: delete <disk uuid> <confirm code>`;
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
        const disk = args._[0];

        if (confirmNeed) {
            if (args._.length < 2) {
                console.log("Too few arguments.");
                args._[1] = "failed";
            }

            let code = args._[1].toString().padStart(4, "0");
            let time = Date.now();
            if (disk === confirmDisk && code === confirmCode && time <= confirmTime) {
                confirmDisk = null;
                confirmCode = null;
                confirmTime = null;
                confirmNeed = false;
                diskMan.deleteDisk(disk);
                console.log("Disk with uuid '" + disk + "' has been deleted");
                return true;
            } else if (time > confirmTime) {
                console.log("Confirmation failed: 10-second Timer expired");
            } else if (disk !== confirmDisk) {
                console.log("Confirmation failed: Disk to be deleted changed...");
            } else if (code !== confirmCode) {
                console.log("Confirmation failed: Wrong confirmation code");
            }
            confirmDisk = null;
            confirmCode = null;
            confirmTime = null;
            confirmNeed = false;
            return false;
        }

        if (args._.length > 1) {
            console.log("Too many arguments.");
            return false;
        }


        if (!diskMan.isValidUUID(disk)) {
            console.log("diskUUID is not a valid uuid");
            return false;
        }

        if (!diskMan.exists(disk)) {
            console.log("diskUUID does not exist");
            return false;
        }

        if (!diskMan.isDeletable(disk)) {
            console.log("This disk is marked as un-deletable.");
            return false;
        }

        let code = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        confirmDisk = disk;
        confirmCode = code;
        confirmTime = Date.now() + 10000;//10 seconds in the future;
        confirmNeed = true;
        console.log("Please confirm deletion with: 'delete " + disk + " " + code + "' within 10 seconds.");
    }
};
