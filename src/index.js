const fs = require("fs");
const net = require("net");
const luamin = require("luamin")

const OCdisk = require("./lib/OCDisk");
const ec = require("./lib/ErrorCodes");
const ConsoleHijack = require("./lib/ConsoleHijack");
const Commands = require("./lib/Commands");
const OPS = require("./lib/opCode")
const packet = require("./lib/packet")

let diskMan = new OCdisk(__dirname + "/disks/");

let config = JSON.parse(fs.readFileSync(__dirname + "/config/config.json", "utf8"));
let packagejson = JSON.parse(fs.readFileSync(__dirname + "/package.json", "utf8"));

let serverhost = config.server;
let serverport = config.port;
let loggingLevel = config.loggingLevel;

ConsoleHijack(loggingLevel);

//Pre-cache the pieces needed to actually initialize booting over and Internet socket.
let luaBootFiles = [];
luaBootFiles[luaBootFiles.length] = fs.readFileSync(__dirname + "/lua/bootloader.lua", "utf8");
luaBootFiles[luaBootFiles.length] = fs.readFileSync(__dirname + "/lua/vcomponent.lua", "utf8");
luaBootFiles[luaBootFiles.length] = fs.readFileSync(__dirname + "/lua/packet.lua", "utf8");
luaBootFiles[luaBootFiles.length] = fs.readFileSync(__dirname + "/lua/inetfs.lua", "utf8");
luaBootFiles[luaBootFiles.length] = fs.readFileSync(__dirname + "/lua/inetdrv.lua", "utf8");

//Pre-cache all opCodes
const opCodeLocation = __dirname + "/lib/opCodes/";
const opCodeCache = [];
const opCodeFiles = fs.readdirSync(opCodeLocation);
for (let file of opCodeFiles) {
    if (!file.endsWith(".js")) {
        continue;
    }
    opCodeCache[opCodeCache.length] = require(opCodeLocation + file);
}

/**************************
 * Setup the socket server and related handlers.
 **************************/

const server = new net.Server();
server.listen(serverport, "0.0.0.0", function () {
    console.log("Server listening for connection requests on socket " + server.address().address + ":" + server.address().port + ".");
});

server.on('connection', function (socket) {
    const client = {};
    client.addr = socket.remoteAddress;
    client.port = socket.remotePort.toString();
    client.socket = socket;
    client.customData = {};//OpCodes should make subtables as needed
    client.fileHandles = {};//Holds all active handles to files opened by opCodes. Needed for when a socket closes so they can be cleaned up properly.

    //The hello packet with version info and such needs to be sent first!
    let needHello = true;
    //Need this because bunch of small packets can get processed before the socket actually closes.
    let socketOK = true;
    //Holds all the incoming package data. Gets "resized" as more data arrives/parsed.
    let packetChunks = Buffer.alloc(0);

    /**
     * Same as console.log but everything is prepended with this client's address + port.
     */
    const consolelog = function () {
        console.log(client.addr + ":" + client.port, ...arguments)
    }
    consolelog("is a new client.");

    /**
     * Just blindly close them all asynchronously with a dummy function.
     */
    const closeAllFiles = function () {
        consolelog("is gone. Closing any open files...");
        for (let handle of client.fileHandles) {
            fs.close(handle, function () {
            });
        }
    }

    /**
     * Packages and sends off a packet to the client.
     */
    const sendPacket = function (opcode, args) {
        const packet = packet.serialize(args)
        const header = Buffer.allocUnsafe(4);
        header.writeUInt16LE(packet.length + 2);
        header.writeUInt16LE(opcode, 2);
        socket.write(header);
        socket.write(packet);
    }


    /**
     * @return Boolean|Object   OBJECT is present with valid packet or FALSE.
     */
    const parsePacket = function () {
        //Putting these in vars isn't needed but helps make sense of all the random numbers.
        let sizePacketLength = 2;
        let sizeOpCode = 2;
        let sizeHeader = sizePacketLength + sizeOpCode;
        let offsetPacketLength = 0;
        let offsetOpCode = 2;
        let offsetPacketData = 4;


        if (packetChunks.length < sizePacketLength) {
            return false;//Packet isn't even long enough to get a total length, yet.
        }
        let packetLength = packetChunks.readUInt16LE(offsetPacketLength);
        if (packetChunks.length < packetLength) {
            return false;//Packet is still missing data.
        }
        if (packetLength - sizeHeader < 0) {
            //Fubar packet. The other end is talking crazy... Just slam the door in their face!
            // They'll get the picture or they won't. Not my problem anymore.
            consolelog("sent a Fubar packet. Hanging up");
            socket.end()
            return false;
        }

        //Supposedly a valid packet. Remove the packet from the packetChunks.
        const packetData = Buffer.alloc(packetLength - sizeHeader, 0);
        let opcode = packetChunks.readUInt16LE(offsetOpCode);
        packetChunks.copy(packetData, 0, offsetPacketData, packetLength);
        const tmp_packetChunks = Buffer.alloc(packetChunks.length - packetLength, 0);
        packetChunks.copy(tmp_packetChunks, 0, packetLength);
        packetChunks = tmp_packetChunks;

        let ret = {};
        ret.opcode = opcode;
        ret.data = packet.deserialize(packetData);
        return ret;
    }

    const opCode = new OPS(opCodeCache);
    opCode.addParameter("client", client);
    opCode.addParameter("data", client.customData);//Pass this in direct.
    opCode.addParameter("files", client.fileHandles);//Pass this in direct.
    opCode.addParameter("ops", opCode);//For some fancy opcode the needs to call another opcode.
    opCode.addParameter("diskMan", diskMan);//For OCDisk opcodes.
    opCode.addParameter("sendPacket", sendPacket);
    opCode.addParameter("consolelog", consolelog);

    socket.on('data', function (chunk) {
        packetChunks = Buffer.concat([packetChunks, chunk]);
        let packet;
        while ((packet = parsePacket()) !== false && socketOK) {
            if (packet === true) {
                console.log("Got an empty packet.");
                continue;
            }
            consolelog("Sent a PACKET!", packet);
            if (needHello && client.opcode !== opCode.getByName("hello")) {
                consolelog("First packet wasn't a hello! Hanging up.");
                socketOK = false;
                socket.end();
                return;
            }
            if (!opCode.run(packet.opcode, packet.data)) {
                console.warn("Unknown opCode: " + client.opcode);
            }
        }
    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function () {
        closeAllFiles();
        console.log('Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function (err) {
        closeAllFiles();
        console.log(`Error: ${err}`);
    });
});

function doshutdown() {
    console.log('Terminating!');
    server.close();
    process.exit(0);
}

process.stdin.resume();
process.on('SIGINT', () => {
    doshutdown();
});

/**************************
 * Build up the commands for cli interactions.
 **************************/
const commandFiles = fs.readdirSync(__dirname + "/commands");

Commands.addParameter("diskMan", diskMan);

Commands.register({
    "name": "/stop",
    "description": "Stops the server",
    "help": "",
    execute(args, params) {
        doshutdown();
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
 * Also setup command parsing
 **************************/
console.log(packagejson.namePretty + " V" + packagejson.version);
console.log("Using NodeJS " + process.version);

console.log("Listening on 0.0.0.0:" + serverport);
console.log("Ready!");

const readline = require('readline');
let rl = readline.createInterface(process.stdin, process.stdout);

function readLineLoop() {
    rl.question('> ', function (cmd) {
        if (!Commands.run(cmd)) {
            console.warn("Unknown command: " + cmd);
        }
        readLineLoop();
    });
}

readLineLoop();
