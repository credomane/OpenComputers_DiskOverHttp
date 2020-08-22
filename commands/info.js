module.exports = {
    "name": "info",
    "description": "Returns all information about a disk.",
    help(args) {
        return "info <disk UUID>";
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length !== 1) {
            console.log("Only disk UUID is allowed");
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

        if (diskMan.isManaged(disk)) {
            const diskFS = diskMan.loadFilesystem(disk);
            console.log("Label      : " + diskFS.getLabel());
            console.log("Total Space: " + diskFS.spaceTotal() + " (" + Math.floor(diskFS.spaceTotal() / 1024 / 1024) + "MB)");
            console.log("Space Used : " + diskFS.spaceUsed() + " (" + Math.floor(diskFS.spaceUsed() / 1024 / 1024) + "MB)");
            console.log("Filesystem is " + (diskFS.isReadOnly() ? "read-only" : "writable"));
            console.log("Disk is " + (diskMan.isDeletable(disk) ? "" : "NOT ") + "deletable");
        } else {
            const diskDRV = diskMan.loadDrive(disk);
            console.log("Label      : " + diskDRV.getLabel());
            console.log("Capacity: " + diskDRV.getCapacity() + " (" + Math.floor(diskDRV.getCapacity() / 1024 / 1024) + "MB)");
            console.log("Bytes Read : " + diskDRV.getBytesRead() + " (" + Math.floor(diskDRV.getBytesRead() / 1024 / 1024) + "MB)");
            console.log("Bytes Written : " + diskDRV.getBytesWritten() + " (" + Math.floor(diskDRV.getBytesWritten() / 1024 / 1024) + "MB)");
            console.log("Sector Size : " + diskDRV.getSectorSize());
            console.log("Platter Count : " + diskDRV.getPlatterCount());
            console.log("Disk is " + (diskMan.isDeletable(disk) ? "" : "NOT ") + "deletable");
        }
        return true;
    }
};
