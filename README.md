# OpenComputers' Disks over HTTP
This an experiment with booting OpenComputers over the Internet, specifically http(s) using a nodejs webserver.  
It is still rough around the edges. Setup is easy but booting your first disk isn't as it 
requires some manual copying of files to your created disks first. 

## Install Requirements
Nodejs and npm

## How to Install
1. Read the "How to use" section first.
1. Download OC Disks over HTTP 
1. Run `npm install` to fetch dependencies
1. copy /config/config.dist.json to /config/config.json
1. Edit /config/config.json to desired settings.
1. Run `node index` to launch the server

## How to Use
1. Once the server is launched use the built-in cli to create disks.
1. Use commands "list" and "help" to get started.
1. In minecraft use an EEPROM capable of http booting (internet card required too). [Provided by TitanBIOS.lua in the lua directory.]
1. Point EEPROM to boot from http://your-server-ip:your-port/boot/disk-uuid/init.lua  
1. Manually copy initial boot files to your disk.  
   * Advanced users check bottom of readme for register httpfs.lua as a virtual component. To avoid the manual copying.
1. Finally boot your OpenComputer.
1. The server cli should, depending on your log level, start spamming messages to the console.


## For Advanced Users
Assuming you are on an OpenComputer capable of using virtual components.  
OpenOS is capable but can't by default. You must download a program that can add this feature for you.  
Once you have done that get the /lua/httfs.lua and/or /lua/httpdrv.lua onto your computer.  
Have a program create a new httpfs and register it like so:
```lua 
--For httpfs (Managed/filesystem disks)
local httpfs = require("httpfs")
local diskuuid = "<insert your disk uuid from the server here"
local diskhttpfs = httpfs(diskuuid, "http://your-server-ip:your-port/")
vcomponent.register(diskuuid,"filesystem",diskhttpfs)

--For httpdrvfs (Unmanaged/RAW disks)
local httpdrv = require("httpdrv")
local diskuuid = "<insert your disk uuid from the server here"
local diskhttpdrv = httpdrv(diskuuid, "http://your-server-ip:your-port/")
vcomponent.register(diskuuid,"drive",diskhttpdrv)
``` 
