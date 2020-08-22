module.exports = {
    "name": "disks",
    "description": "Lists all disks and basic information about them.",
    help(args) {
        return "";
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }

        let diskMan = params.diskMan;
        let disks = diskMan.listAll();

        for (let i = 0; i < disks.length; i++) {
            let disk = disks[i];
            if (diskMan.isManaged(disk)) {
                disk = diskMan.loadFilesystem(disk);
                console.log(disks[i], "filesystem", Math.floor(disk.spaceUsed() / disk.spaceTotal() * 100) + "% full", "\"" + disk.getLabel() + "\"");
            } else {
                disk = diskMan.loadDrive(disk);
                console.log(disks[i], "drive", Math.floor(disk.getCapacity() / 1024 / 1024) + "MB", disk.getSectorSize() + " byte sectors", "\"" + disk.getLabel() + "\"");
            }
        }
    }
};
