const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");

const OCdisk = require("./lib/OCDisk");
const ec = require("./lib/ErrorCodes");
const ConsoleHijack = require("./lib/ConsoleHijack");
const Commands = require("./lib/Commands");

let diskMan = new OCdisk(__dirname + "/disks/");

let webapp = express();
webapp.use(bodyParser.urlencoded({extended: false}));
webapp.use(bodyParser.json());

let config = JSON.parse(fs.readFileSync(__dirname + "/config/config.json", "utf8"));
let packagejson = JSON.parse(fs.readFileSync(__dirname + "/package.json", "utf8"));

console.log(packagejson.namePretty, "V" + packagejson.version);

let serverurl;
let httpPort = config.httpPort;
let loggingLevel = config.loggingLevel;

ConsoleHijack(loggingLevel);

if (config.httpPort === 80 || config.httpPort === 443) {
    serverurl = config.server + config.uri;
} else {
    serverurl = config.server + ":" + httpPort + config.uri;
}

//Pre-cache the pieces needed to actually initialize http booting.
let file_vcomponent = fs.readFileSync(__dirname + "/lua/vcomponent.lua", "utf8");
let file_bootloader = fs.readFileSync(__dirname + "/lua/bootloader.lua");
let file_httpfs = fs.readFileSync(__dirname + "/lua/httpfs.lua", "utf8");
let file_httpdrv = fs.readFileSync(__dirname + "/lua/httpdrv.lua", "utf8");

//This is ran everytime :disk is used in the routes.
webapp.param("disk", function (req, res, next, value) {
    let disk = req.params.disk;
    if (!diskMan.exists(disk)) {
        console.error(disk, "Disk not found.");
        res.status(404).send("" + ec.nodisk).end();
        return;
    }
    next();
});

// /boot/ is for initializing the boot over http.
// This is done by sending a few different files and pieces as single stream of data.
// 1. vcomponent (author: gamax92 https://github.com/OpenPrograms/gamax92-Programs) slightly modified for use without OpenOS.
// 2. Bootloader (author: credomane) Handles getting the first file off httpfs or reading the MBR on httpdrv.
// 3. httpfs/httpdrv (author: credomane) The heart of this project.
// 4. Some fileless lua to handle getting the ducks in line so virtual disk can be booted.
webapp.get('/boot/:fstype/:disk*', function (req, res) {
    let fstype = req.params.fstype.toLowerCase();
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];
    let stuff = "";

    if (fstype === "httpfs" && !diskMan.isManaged(disk)) {
        console.error(disk, "httpfs requires managed disk");
        res.status(404).send("" + ec.fsneedsmanaged).end();
        return;
    }
    if (fstype === "httpdrv" && diskMan.isManaged(disk)) {
        console.error(disk, "httpdrv requires unmanaged disk");
        res.status(404).send("" + ec.drvneedsunmanaged).end();
        return;
    }

    stuff += "--vcomponent.lua\n" + file_vcomponent + "\n";
    stuff += "--bootloader\n" + file_bootloader + "\n";

    if (fstype === "httpfs") {
        stuff += "--httpfs.lua\n" + file_httpfs + "\n";
        stuff += "--bootcode\n";
        stuff += "local disk = httpfs('" + disk + "','" + serverurl + "');\n";
        stuff += "component.virtual_register('" + disk + "', 'filesystem', disk)\n";
        stuff += "local init = bootdisk('" + disk + "','" + file + "')\n";
    } else if (fstype === "httpdrv") {
        stuff += "--httpdrv.lua\n" + file_httpdrv + "\n";
        stuff += "--bootcode\n";
        stuff += "local disk = httpdrv('" + disk + "','" + serverurl + "');\n";
        stuff += "component.virtual_register('" + disk + "', 'drive', disk)\n";
        stuff += "local init = bootdrive('" + disk + "','" + file + "')\n";
    } else {
        console.error(disk, "Unknown fstype requested:", "'" + fstype + "'");
        res.status(404).end();
        return;
    }

    stuff += "computer.setBootAddress('" + disk + "')\n";
    stuff += "init()\n";

    console.info(disk, "Sending bootcodefor", "'" + fstype + "'");
    res.type("application/lua").send("" + stuff).end();
});

/***************************************
 * FILESYSTEM & DRIVE common functions.
 ***************************************/
webapp.get('/disk/:disk/label', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    console.ok(disk, "get label", "'" + diskMan.getLabel(disk) + "'");
    res.send("" + diskMan.getLabel(disk)).end();
});

webapp.post('/disk/:disk/label', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let oldLabel = diskMan.getLabel(disk);
    let newLabel = req.body.label;

    if (typeof (newLabel) === "undefined") {
        console.warn(disk, "set label", "Attempted to set label to undefined value. Using original label.");
        newLabel = oldLabel;
    }

    diskMan.setLabel(disk, newLabel);
    console.ok(disk, "set label", "old: '" + oldLabel + "'", "new:'" + diskMan.getLabel(disk) + "'");
    res.send("" + diskMan.getLabel(disk)).end();
});

/***************************************
 * DRIVES (unmanaged-mode)
 ***************************************/
webapp.get('/disk/:disk/capacity', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (diskMan.isManaged(disk)) {
        console.error(disk, "getCapacity", "Attempted to get capacity on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return;
    }
    let diskObj = diskMan.loadDrive(disk);

    console.ok(disk, "getCapacity", diskObj.getCapacity());
    res.send("" + diskObj.getCapacity()).end();
});

webapp.get('/disk/:disk/plattercount', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (diskMan.isManaged(disk)) {
        console.error(disk, "platterCount", "Attempted to get platter count on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return;
    }
    let diskObj = diskMan.loadDrive(disk);

    console.ok(disk, "platterCount", diskObj.getPlatterCount());
    res.send("" + diskObj.getPlatterCount()).end();
});

webapp.get('/disk/:disk/sectorsize', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (diskMan.isManaged(disk)) {
        console.error(disk, "sectorSize", "Attempted to get sector size on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return;
    }
    let diskObj = diskMan.loadDrive(disk);

    console.ok(disk, "sectorSize", diskObj.getSectorSize());
    res.send("" + diskObj.getSectorSize()).end();
});

webapp.get('/disk/:disk/readbyte/:offset', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let offset = req.params.offset;

    if (diskMan.isManaged(disk)) {
        console.error(disk, "readByte", "Attempted to read a byte on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return;
    }
    let diskObj = diskMan.loadDrive(disk);

    console.ok(disk, "readbyte", offset);
    res.send("" + diskObj.readByte(offset)).end();
});

webapp.post('/disk/:disk/writebyte/:offset', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let offset = req.params.offset;
    let data = req.body.data

    if (diskMan.isManaged(disk)) {
        console.error(disk, "writeByte", "Attempted to write a byte on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return;
    }
    let diskObj = diskMan.loadDrive(disk);
    diskObj.writeByte(offset, data);

    console.ok(disk, "writeByte", offset, "0x" + data.charCodeAt(0).toString(16).padStart(2, '0'));
    res.send("true").end();
});

webapp.get('/disk/:disk/readsector/:sector', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let sector = req.params.sector;

    if (diskMan.isManaged(disk)) {
        console.error(disk, "readSector", "Attempted to read a sector on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
        return false;
    }
    let diskObj = diskMan.loadDrive(disk);

    console.ok(disk, "readSector", sector);
    res.send("" + diskObj.readSector(sector)).end();
});

webapp.post('/disk/:disk/writesector/:sector', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let sector = req.params.sector;
    let data = req.body.data

    if (diskMan.isManaged(disk)) {
        console.error(disk, "writeSector", "Attempted to write a sector on managed disk.");
        res.status(404).send(ec.drvneedsunmanaged).end();
    }
    let diskObj = diskMan.loadDrive(disk);
    diskObj.writeSector(sector, data);

    console.ok(disk, "writeSector", sector);
    res.send("true").end();
});

/***************************************
 * FILESYSTEM (managed-mode)
 ***************************************/
webapp.get('/disk/:disk/spacetotal', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "spaceTotal", "Attempted to get total space on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    console.ok(disk, "spaceTotal", diskObj.spaceTotal());
    res.send("" + diskObj.spaceTotal()).end();
});

webapp.get('/disk/:disk/spaceused', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "spaceUsed", "Attempted to get space used on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    console.ok(disk, "spaceUsed", diskObj.spaceUsed());
    res.send("" + diskObj.spaceUsed()).end();
});

webapp.get('/disk/:disk/readonly', function (req, res) {
    let disk = req.params.disk.toLowerCase();

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "readOnly", "Attempted to get read only status on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    console.ok(disk, "readOnly", diskObj.isReadOnly());
    res.send("" + diskObj.isReadOnly()).end();
});

webapp.post('/disk/:disk/open*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];
    let mode = req.body.mode.toLowerCase();

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "open", "Attempted to open a file on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.open(file, mode);
    if (result < 0) {
        console.fail(disk, "open", file, mode, result);
    } else {
        console.ok(disk, "open", file, mode, result + " bytes");
    }
    res.send("" + result).end();
});

webapp.post('/disk/:disk/mkdir*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "mkdir", "Attempted to make a directory on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.makeDirectory(file);
    if (result < 0) {
        result = false;
        console.fail(disk, "mkdir", file, result);
    } else if (!result) {
        console.fail(disk, "mkdir", file, "Directory wasn't found after is was supposedly created");
    } else {
        console.ok(disk, "mkdir", file);
    }
    res.send("" + result).end();
});

webapp.get('/disk/:disk/exists*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "exists", "Attempted to check if file exists on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.exists(file);
    if (result) {
        console.ok(disk, "exists", file, "Exists");
    } else {
        console.ok(disk, "exists", file, "Does not exist");
    }
    res.send("" + result).end();
});

webapp.post('/disk/:disk/write*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];
    let offset = req.body.offset;
    let data = req.body.data;

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "write", "Attempted to write to a file on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);


    let result = diskObj.write(file, data, offset);
    if (result > 0) {
        console.fail(disk, "write", file, result);
    } else {
        console.ok(disk, "write", file, result + " bytes");
    }
    res.send("" + result).end();
});

webapp.get('/disk/:disk/isdir*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "isDir", "Attempted to check if path is a directory on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.isDirectory(file);
    console.ok(disk, "isDir", file, result.toString());
    res.send("" + result).end();
});

webapp.post('/disk/:disk/rename*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];
    let fileTo = req.body.to;

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "rename", "Attempted to rename a path on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.rename(file, fileTo);
    if (result < 0) {
        result = false
        console.fail(disk, "rename", file, fileTo, result);
    } else if (!result) {
        console.fail(disk, "rename", file, fileTo, "Destination file doesn't exists after rename");
    } else {
        console.ok(disk, "rename", file, fileTo);
    }
    res.send("" + result).end();
});

webapp.get('/disk/:disk/list*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "list", "Attempted to list files on unmanaged disk.");
        res.status(404).send(ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let files = diskObj.list(file);
    if (files === false) {
        console.fail(disk, "list", file);
        res.send("false").end();
        return;
    }
    let luaTable = "return {";
    files.forEach(f => {
        luaTable += "'" + f.replace(/'/g, "\'") + "',";
    });
    if (luaTable.endsWith(",")) {
        luaTable = luaTable.substring(0, luaTable.length - 1);//I'm dumb and this is easy way to remove that extra comma.
    }
    luaTable += "}";
    console.ok(disk, "list", file, files.length + " files.");
    res.send("" + luaTable).end();
});

webapp.get('/disk/:disk/lastmodified*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "lastModified", "Attempted to get file last modified on unmanaged disk.");
        res.status(404).send("" + ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.lastModified(file);
    if (result < 0) {
        console.fail(disk, "lastModified", "Failed to get last modified time", result);
    } else {
        console.ok(disk, "lastModified", result);
    }
    res.send("" + result).end();
});

webapp.post('/disk/:disk/remove*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "remove", "Attempted to delete a file on unmanaged disk.");
        res.status(404).send("" + ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    let result = diskObj.remove(file);
    if (result < 0) {
        result = false;
        console.error(disk, "remove", file, result);
    } else if (!result) {
        console.fail(disk, "remove", file, "File still exists after getting removed");
    } else {
        console.ok(disk, "remove", file);
    }
    res.send("" + result).end();
});

webapp.get('/disk/:disk/size*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "size", "Attempted to get file size on unmanaged disk.");
        res.status(404).send("" + ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);

    if (diskObj.isDirectory(file)) {
        console.warn(disk, "size", file, "Attempted to get size of directory sending 0");
        res.send("0").end();
        return;
    }

    let result = diskObj.size(file);
    if (result < 0) {
        console.fail(disk, "size", file, result);
        result = 0
    } else {
        console.ok(disk, "size", file, result + " bytes");
    }
    res.send("" + result).end();
});

webapp.post('/disk/:disk/read*', function (req, res) {
    let disk = req.params.disk.toLowerCase();
    let file = req.params[0];
    let offset = parseInt(req.body.offset);
    let count = req.body.count;

    if (!diskMan.isManaged(disk)) {
        console.error(disk, "read", "Attempted to read a file on unmanaged disk.");
        res.status(404).send("" + ec.fsneedsmanaged).end();
        return;
    }
    let diskObj = diskMan.loadFilesystem(disk);


    let result = diskObj.read(file, count, offset);
    if (result < 0) {
        result = null;
        console.fail(disk, "read", file, offset, count, result);
    } else {
        console.ok(disk, "read", file, offset, count, result.length + " bytes.");
    }
    res.send("" + result).end();
});

/********************************************
 * Admin Panel
 *******************************************/
//TODO: make the thing.

/********************************************
 * Catch all Rules
 *******************************************/
webapp.all("*", function (req, res) {
    console.error("ERROR 404: " + req.method + " -> " + req.path);
    res.status(404).send("").end();
});

let websrv = require("http").createServer(webapp).listen(httpPort);


/**************************
 * Pterodactyl is weird and won't send ^C to nodejs properly.
 * So I added a graceful stop feature here when "stop" is read on stdin.
 *   --Credo
 **************************/
function dobotshutdown() {
    console.log('Terminating!');
    websrv.close();
    process.exit(0);
}

process.stdin.resume();
process.on('SIGINT', () => {
    dobotshutdown();
});
const readline = require('readline');
let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', function (line) {
    if (line.startsWith("/")) {
        if (!Commands.run(line)) {
            console.warn("unknown command: " + line);
        }
    }
})

/**************************
 * Build up the commands for cli interactions.
 **************************/
const commandFiles = fs.readdirSync(__dirname + "/commands");

Commands.addParameter("diskMan", diskMan);

Commands.register({
    "name": "stop",
    "description": "Stops the server",
    "help": "",
    execute(args, params) {
        dobotshutdown();
    }
});

for (let file of commandFiles) {
    if (!file.endsWith(".js")) {
        continue;
    }
    let command = require(__dirname + "/commands/" + file);
    Commands.register(command);
}
/**************************
 * Say we are ready so pterodactyl switches from "Starting..." to "Online"
 **************************/
console.log("Ready!");
