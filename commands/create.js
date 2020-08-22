module.exports = {
    "name": "create",
    "description": "Creates new disks",
    help(args) {
        return `create fs <spaceTotal>
    - spaceTotal = total space of drive in bytes
create drive <sectorSize> <sectorCount> <platterCount> 
    - Drive capacity will be sectorSize * sectorCount.
    - SectorSize = 512, 2048, 4096, or 8192
    - SectorCount valid ranges change depending on sectorSize.
        Must be between 2048-51200 for sectorSize of  512
                        512 -12800 for sectorSize of 2048
                        256 - 6400 for sectorSize of 4096
                        128 - 3200 for sectorSize of 8192
    - PlatterCount = 1-8.`;
    },
    execute(args, params) {
        if (!params.hasOwnProperty("diskMan")) {
            console.log("Require parameter 'diskMan' not available.");
            console.log("Try restarting DiskOverHTTP.");
            return false;
        }
        if (!args.hasOwnProperty("_") || args._.length < 1) {
            console.log("Too few args");
            return false;
        }
        const type = args._[0].toString().toLowerCase();
        if (type === "fs") {
            if (args._.length < 2) {
                console.log("Too few args");
                return false;
            }
            if (args._.length > 2) {
                console.log("Too many args");
                return false;
            }
            let size = parseInt(args._[1]);
            if (isNaN(size)) {
                console.log("SpaceTotal isn't a number");
                return false;
            }
            let disk = params.diskMan.createFilesystem(size, "", false);

            if (disk !== false) {
                console.log("Created new managed disk with uuid " + disk);
                return true;
            }

            console.log("Failed to create new disk");
            return false;
        } else if (type === "drive") {
            if (args._.length < 4) {
                console.log("Too few args");
                return false;
            }
            if (args._.length > 4) {
                console.log("Too many args");
                return false;
            }
            let sectorSize = parseInt(args._[1]);
            let sectorCount = parseInt(args._[2]);
            let platterCount = parseInt(args._[3]);

            if (isNaN(platterCount) || (platterCount < 2 || 8 < platterCount)) {//50MB
                console.log("platterCount is not between 1 and 8");
                return false;
            }
            if (isNaN(sectorSize) || (sectorSize !== 512 && sectorSize !== 2048 && sectorSize !== 4096 && sectorSize !== 8192)) {
                console.log("sectorSize is not 512, 2048, 4096 or 8192");
                return false;
            }
            if (isNaN(sectorCount)) {
                console.log("sectorCount is not a number");
                return false;
            }
            let capacity = sectorSize * sectorCount
            if (sectorSize === 512 && (capacity < 1048576 || 52428800 < capacity)) {
                console.log("sectorCount must be between 2048-102400 for sectorSize of 512");
                return false;
            }
            if (sectorSize === 2048 && (capacity < 1048576 || 52428800 < capacity)) {
                console.log("sectorCount must be between 512-51200 for sectorSize of 2048");
                return false;
            }
            if (sectorSize === 4096 && (capacity < 1048576 || 52428800 < capacity)) {
                console.log("sectorCount must be between 256-12800 for sectorSize of 4096");
                return false;
            }
            if (sectorSize === 8192 && (capacity < 1048576 || 52428800 < capacity)) {
                console.log("sectorCount must be between 128-6400 for sectorSize of 8192");
                return false;
            }

            let disk = params.diskMan.createDrive("", platterCount, sectorSize, sectorCount);
            if (disk !== false) {
                console.log("Created new managed disk with uuid " + disk);
                return true;
            }

            console.log("Failed to create new drive");
            return false;
        }
        console.log("Bad disk type");
        return false;
    }
};
