const fs = require("fs");
const net = require("net");

const OCdisk = require("./lib/OCDisk");
const ec = require("./lib/ErrorCodes");
const ConsoleHijack = require("./lib/ConsoleHijack");
const Commands = require("./lib/Commands");
const opCode = require("./lib/opCode")
const packet = require("./lib/packet")

let diskMan = new OCdisk(__dirname + "/disks/");

let config = JSON.parse(fs.readFileSync(__dirname + "/config/config.json", "utf8"));
let packagejson = JSON.parse(fs.readFileSync(__dirname + "/package.json", "utf8"));

let serverhost = config.server;
let serverport = config.port;
let loggingLevel = config.loggingLevel;

ConsoleHijack(loggingLevel);

//Pre-cache the pieces needed to actually initialize http booting.
let file_vcomponent = fs.readFileSync(__dirname + "/lua/vcomponent.lua", "utf8");
let file_bootloader = fs.readFileSync(__dirname + "/lua/bootloader.lua");
let file_inetfs = fs.readFileSync(__dirname + "/lua/inetfs.lua", "utf8");
let file_inetdrv = fs.readFileSync(__dirname + "/lua/inetdrv.lua", "utf8");

/**************************
 * Setup the socket server and related handlers.
 **************************/

const server = new net.Server();
server.listen(serverport, "0.0.0.0", function () {
    console.log("Server listening for connection requests on socket " + server.address().address + ":" + server.address().port + ".");
});

server.on('connection', function (socket) {

    const client = {};
    client.addr = socket.remoteAddress + ":" + socket.remotePort.toString();
    client.data = {};//Holds all data created and used by opCodes for this connection.
    client.data.custom = {};//OpCodes should make subtables as needed
    client.data.fileHandles = {};//Holds all active handles to files opened by opCodes. Needed for when a socket closes so they can be cleaned up properly.

    client.opcode = 0;//0=no opcode (NULL)
    client.totalSize = 0;
    client.size = 0;

    console.log(client.addr + " is a new client.");

    socket.on('data', function (chunk) {
        let tmp = "";
        console.log(chunk);
        if (client.opcode === 0) {
            client.opcode = chunk.readUInt16LE(0);
            client.totalSize = chunk.readUInt16LE(2);

            if (client.opcode !== opCode.getByName("hello")) {//First packet must be hello.
                console.log(client.addr + " didn't send hello. Good-Bye");
                console.log(typeof client.opcode);
                console.log(typeof opCode.getByName("hello"));
                socket.write(opCode.getByName("bye").toString())
                socket.end();
                return;
            }

            if (client.totalSize > 131072) {//128KB should be enough for anybody in a "single" packet.
                socket.write(opCode.getByName("bye").toString())
                socket.end();
                return;
            }

            client.buf = Buffer.alloc(client.totalSize, 0);
            tmp = chunk.slice(4);
        } else {
            tmp = chunk;
        }
        client.size += tmp.length;
        //This needs improved. If the client sends multiple packets that get lumped together this will trigger "falsely".
        if (client.size > client.totalSize) {
            socket.write(opCode.getByName("bye").toString())
            socket.end()
        }
        tmp.copy(client.buf, client.size - tmp.length);
        if (client.size === client.totalSize) {
            console.log(client.addr + ": Full packet received. Calling opcode " + opCode.getByCode(client.opcode));
            let parsedData = packet.deserialize(client.buf)
            console.log(parsedData);
            //call opCode(data)
            if (!opCode.run(client.opcode, socket, parsedData, client.data.custom, client.data.fileHandles)) {
                console.warn("Unknown opCode: " + client.opcode);
            }
            client.opcode = 0;
            client.size = 0;
            client.totalSize = 0;
        }
    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function () {
        console.log('Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function (err) {
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
 * Register all of the OPS (PacketHandlers)
 **************************/
const opCodeFiles = fs.readdirSync(__dirname + "/lib/opCodes");

opCode.addParameter("diskMan", diskMan);

for (let file of opCodeFiles) {
    if (!file.endsWith(".js")) {
        continue;
    }
    let command = require(__dirname + "/lib/opCodes/" + file);
    opCode.register(command);
}

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
