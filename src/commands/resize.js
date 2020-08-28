module.exports = {
    "name": "resize",
    "description": "Allows for resizing filesystem disks.",
    help(args) {
        return "resize <disk uuid> <new size in bytes>";
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length !== 2) {
            console.log("Only two arguments allowed");
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
            console.log("Provided disk is not a filesystem disk");
            return false;
        }

        const diskFS = diskMan.loadFilesystem(disk);
        console.log(args._[1]);
        if (diskFS.setSpaceTotal(parseInt(args._[1]))) {
            console.log("Disk has been resized");
            return true;
        }
        console.log("Failed to resize disk");
        return false;
    }
};
