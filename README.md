# OpenComputers' Disks over Internet
This a project intended for booting OpenComputers over the Internet or modem/linked cards.  
The NodeJS server section is only required for inetfs and inetdrv.  
The OC server section is only required for modemfs and modemdrv.

I've tried to make everything as easy as possible but some effort is still required.

## How to Install the NodeJS Server
1. NodeJS and npm need to be installed on the computer that will host the NodeJs server
1. Download OC Disks over Internet
1. Run `npm install` to fetch dependencies
1. copy /config/config.dist.json to /config/config.json
1. Edit /config/config.json to desired settings.
1. Run `node index` to launch the server

## How to Install the OC Server
1. Download OC Disks over Internet
1. TODO: Finish this guide once the vcomponents exist

## How to Use - For EEPROM Booting
1. Once the server is launched use the built-in cli to managed disks.
1. Use commands "list" and "help" to get started.
1. Manually copy initial boot files to your disk.
1. In OpenComputers use an EEPROM capable of internet booting (internet card required). [Provided EEPROM.lua does this in the most basic way]
1. Point EEPROM to boot from sock://your-server-address:server-port|diskuuid|file-to-boot
 * For modem/linked cards modem://your-server-address:server-porp|diskuuid|file-to-boot
1. Finally boot your OpenComputer.
1. The server cli should, depending on your log level, start spamming messages to the console.


## Info on how booting works for the curious people
Note: provided EEPROM.lua crashes with an error message on *all* failures.
Stage 1 bootloader consists of the following:
1. EEPROM opens a socket and connects to [your-server-ip-or-dns-name] using port [server-port].
  * For modem/linked cards a broadcast is sent to []
1. EEPROM sends USE [diskuuid]
1. EEPROM receives OK or FAIL reply.
1. EEPROM sends BOOTCODE
1. EEPROM receives OK or FAIL reply.
1. EEPROM receives lua code responsible for creating and registering virtual component.
1. EEPROM closes socket.
1. EEPROM ending Stage 1.

The received lua code is as follows and is the Stage 2 bootloader:
```lua 
--Lua received for Managed/filesystem disks
--[[insert contents of /lua/vcomponent.lua]]--
--[[insert contents of /lua/inetfs.lua]]--
--[[insert contents of /lua/bootloader.lua]]--
local diskuuid = "[diskUUID previously send to server]"
local diskinet = inetfs(diskuuid, "[your-server-ip]:[your-port]")
vcomponent.register(diskuuid, "filesystem", diskinet)
function computer.setBootAddress() end --Most OS expect this
function computer.getBootAddress() return diskuuid end --Most OS expect this
bootfs(diskuuid)()

--Lua received for Unmanaged/RAW disks
<insert contents of /lua/vcomponent.lua>
<insert contents of /lua/inetdrv.lua>
<insert contents of /lua/bootloader.lua>
local diskuuid = "[diskUUID previously send to server]"
local diskinet = inetdrv(diskuuid, "[your-server-ip]:[your-port]")
component.virtual_register(diskuuid, "drive", diskinet)
function computer.setBootAddress() end --Most OS expect this
function computer.getBootAddress() return diskuuid end --Most OS expect this
bootdrv(diskuuid)()
``` 

1. EEPROM attempts to run the received lua kicking off Stage 2 bootloader.
1. Stage2 calls inetfs() or inetdrv() depending on disk type
  * This opens a socket to [your-server-ip]:[your-port]
1. Stage2 registers the returned diskinet as a filesystem or drive virtual component.
1. Stage2 sets up two "helper" functions that most OS expect.
1. Stage2 calls bootfs([diskuuid], [file-to-boot]) or bootdrv([diskuuid])
1. Stage2 attempts to execute one of the following depending on disk type
 * bootfs([diskuuid], [file-to-boot])
   1. [file-to-boot] located on [diskuuid] ends and your OS takes over.
 * bootdrv([diskuuid])
   1. First 512 bytes of disk are read then executed as lua. Old-school MBR-style. Don't like that? Edit the inetdrv.lua then. :D
1. Stage 2 ends and your OS takes over.
 * One added benefit is vcomponent.lua extends the built-in component so ALL inet booted OS have virtual component support by default!
 * You'll just have to copy inetfs.lua and inetdrv.lua to your OS and uncomment the return statement at the bottom.
 * then you can just require("inetfs.lua") through whatever method your OS provides!