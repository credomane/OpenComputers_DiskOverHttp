const fs = require("fs");
const path = require("path");
const uuidv4 = require("uuid").v4;
const OCDrive = require("./OCDrive");
const OCFilesystem = require("./OCFilesystem");
const ec = require("./ErrorCodes");

class OCDisk {
    constructor(sourcePath) {
        this.sourcePath = this.normalize(sourcePath);
    }

    normalize(dir) {
        if (!dir.endsWith("/")) {
            dir += "/";
        }

        return path.normalize(dir).replace(/\\/g, "/");
    }

    isValidUUID(disk) {
        return disk.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }

    exists(disk) {
        return fs.existsSync(this.sourcePath + disk + "/disk.json");
    }

    listAll() {
        let disks = [];
        fs.readdirSync(this.sourcePath).forEach(disk => {
            if (this.isValidUUID(disk) && this.exists(disk)) {
                disks[disks.length] = disk;
            }
        });
        return disks;
    }

    isManaged(disk) {
        let info = JSON.parse(fs.readFileSync(this.sourcePath + disk + "/disk.json", "utf8"));
        return info.managed;
    }

    getLabel(disk) {
        let info = JSON.parse(fs.readFileSync(this.sourcePath + disk + "/disk.json", "utf8"));
        return info.label;
    }

    setLabel(disk) {
        let info = JSON.parse(fs.readFileSync(this.sourcePath + disk + "/disk.json", "utf8"));
        fs.writeFileSync(this.sourcePath + disk + "/disk.json", JSON.stringify(info, null, 2), "utf8")
        return info.label;
    }

    createDrive(label, platterCount, sectorSize, sectorCount) {
        let disk = uuidv4();
        if (this.exists(disk)) {
            return false;
        }

        let info = {};
        info.label = label;
        info.managed = false;

        platterCount = parseInt(platterCount);
        sectorSize = parseInt(sectorSize);
        sectorCount = parseInt(sectorCount);

        if (isNaN(platterCount) || (platterCount < 2 || 8 < platterCount)) {//50MB
            console.log("createDrive->platterCount is not between 1 and 8: '" + platterCount + "'");
            return false;
        }
        if (isNaN(sectorSize) || (sectorSize !== 512 && sectorSize !== 2048 && sectorSize !== 4096 && sectorSize !== 8192)) {
            console.log("createDrive->sectorSize is not a valid value: '" + sectorSize + "'");
            console.log("Valid values are 512, 2048, 4096 and 8192");
            return false;
        }
        if (isNaN(sectorCount)) {
            console.log("createDrive->sectorCount is not a number: '" + sectorCount + "'");
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

        info.capacity = capacity;
        info.platterCount = platterCount;
        info.sectorSize = sectorSize;

        fs.mkdirSync(this.sourcePath + disk);
        fs.writeFileSync(this.sourcePath + disk + "/disk.json", JSON.stringify(info, null, 2));
        let f = fs.openSync(this.sourcePath + disk + "/disk.bin", "w");
        let written = 0;
        let buff;
        let tmp;
        //Create and fill the drive with random garbage. >:D
        while (written <= capacity) {
            tmp = "";
            buff = 0;
            while (buff <= 65536 && written <= capacity) {
                tmp += String.fromCharCode(Math.floor(Math.random() * 256));
                buff++;
                written++;
            }
            fs.writeSync(f, tmp);
        }
        fs.closeSync(f);
        return disk;
    }

    loadDrive(disk) {
        if (!this.isValidUUID(disk) || !this.exists(disk)) {
            return false;
        }
        return new OCDrive(disk, this.sourcePath);
    }

    deleteDisk(disk) {
        if (!this.isValidUUID(disk)) {
            return false;
        }
        if (!this.exists(disk)) {
            return false;
        }

        fs.rmdirSync(this.sourcePath + disk, {recursive: true});

        return true;
    }

    createFilesystem(spaceTotal, label, readOnly) {
        let disk = uuidv4();
        if (this.exists(disk)) {
            return false;
        }

        spaceTotal = parseInt(spaceTotal);
        if (isNaN(spaceTotal) || (spaceTotal < 0 || 52428800 < spaceTotal)) {//50MB
            console.log("createFilesystem->spaceTotal is not between 0 and 52428800: '" + spaceTotal + "'");
            return false;
        }

        let info = {};
        info.label = label;
        info.managed = true;
        info.spaceTotal = spaceTotal;
        info.spaceUsed = 0;
        info.readOnly = !!readOnly;

        fs.mkdirSync(this.sourcePath + disk);
        fs.mkdirSync(this.sourcePath + disk + "/files/");
        fs.writeFileSync(this.sourcePath + disk + "/disk.json", JSON.stringify(info, null, 2));
        return disk;
    }

    loadFilesystem(disk) {
        if (!this.isValidUUID(disk) || !this.exists(disk)) {
            console.log("Load fs failed: " + disk, this.isValidUUID(disk), this.exists(disk));
            return false;
        }
        return new OCFilesystem(disk, this.sourcePath);
    }
}

module.exports = OCDisk;
