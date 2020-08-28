const fs = require("fs");
const path = require("path");

const ec = require("./ErrorCodes");

class OCFilesystem {
    constructor(disk, sourcePath) {
        disk = disk.toLowerCase();
        if (!disk.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            throw new Error("Invalid Disk UUID: " + disk);
        }

        if (!sourcePath.endsWith("/")) {
            sourcePath += "/";
        }

        if (!fs.existsSync(sourcePath + disk + "/disk.json")) {
            throw new Error("Invalid disk: " + sourcePath + disk + "/disk.json");
        }

        this.disk = disk;
        this.sourcePath = sourcePath;
        this.diskJson = this.sourcePath + this.disk + "/disk.json";
        this.filePath = this.sourcePath + this.disk + "/files/";

        this.info = JSON.parse(fs.readFileSync(this.diskJson, "utf8"))
    }

    _commit() {
        fs.writeFileSync(this.diskJson, JSON.stringify(this.info, null, 2), "utf8")
    }

    _cleanFilePath(file) {
        file = path.normalize(file).replace(/\\/g, "/");
        return path.relative(this.filePath, this.filePath + file);
    }

    _isFileInDisk(file) {
        return !this._cleanFilePath(file).startsWith("../");
    }

    /**
     * Gets the disk's UUID.
     * @returns string uuid
     */
    getUUID() {
        return this.disk;
    }

    /**
     * Get the current label of the disk.
     */
    getLabel() {
        return this.info.label;
    }

    /**
     * Set the current label of the disk.
     */
    setLabel(newLabel = "") {
        if (!this.isReadOnly()) {
            this.info.label = newLabel;
            this._commit();
        }
        return this.info.label;
    }

    /**
     * Returns the total space of the drive, in bytes.
     */
    spaceTotal() {
        return this.info.spaceTotal;
    }

    /**
     * sets the total space of the drive, in bytes.
     */
    setSpaceTotal(value) {
        if (this.isReadOnly()) {
            return false;
        }
        if (value < this.spaceUsed() || 52428800 < value) {
            return false;
        }
        this.info.spaceTotal = parseInt(value);
        this._commit();
        return true;
    }

    /**
     * Gets space used
     */
    spaceUsed() {
        return this.info.spaceUsed;
    }

    /**
     * Sets read only mode
     */
    setReadOnly(value) {
        this.info.readOnly = !!value
        this._commit();
        return this.info.readOnly;
    }

    /**
     * Gets read only mode
     */
    isReadOnly() {
        return this.info.readOnly;
    }

    /**
     * Verifies path can be opened in the desired mode
     * @return number
     */
    open(file, mode = "r") {
        file = this._cleanFilePath(file);
        if (!this._isFileInDisk(file)) {
            return ec.notindisk;
        }
        if (mode !== "r" && mode !== "r+" && mode !== "w" && mode !== "w+" && mode !== "a" && mode !== "a+") {
            return ec.invalidopenmode;
        }
        if (!this.exists(file) && (mode === "r" || mode === "r+")) {
            return ec.filenotfound;
        }
        if (this.exists(file) && (mode === "r" || mode === "r+")) {
            return fs.statSync(this.filePath + file)["size"];
        }
        if (this.isReadOnly() && (mode === "w" || mode === "w+" || mode === "a" || mode === "a+")) {
            return ec.readonly;
        }
        if (!this.exists(file) && this._isFileInDisk(file) && (mode === "w" || mode === "w+" || mode === "a" || mode === "a+")) {
            fs.closeSync(fs.openSync(this.filePath + file, "w"));
            return 0;
        }
        if (this.exists(file) && (mode === "w" || mode === "w+")) {
            this.info.spaceUsed -= fs.statSync(this.filePath + file)["size"];
            this._commit();
            fs.closeSync(fs.openSync(this.filePath + file, "w"));
            return 0;
        }
        if (this.exists(file) && (mode === "a" || mode === "a+")) {
            //Damn it nodejs why you make this impossible?
            //Why is it filesize about 4 bytes greater than the max pointer position?
            //Even if I read the whole damn file byte by byte that is STILL the case.
            //Hell in that case the byte for byte read matches the filesize so wtf!?
            return this.size(file);
        }

        console.error(this.disk, "Open failed because you missed a case moron. Data dump: ", this.disk, file, mode, this.isReadOnly(), this.exists(file), this._isFileInDisk(file));
        return ec.unknownerror;
    }


    /**
     * Seeks in an open file descriptor with the specified handle. Returns the new pointer position.
     * This should never be needed on the http backend.
     * @return number
     */
    seek(file, whence, offset) {
    }

    /**
     * Creates a directory at the specified absolute path in the file system. Creates parent directories, if necessary.
     * @return boolean
     */
    makeDirectory(dir) {
        if (this.isReadOnly()) {
            return ec.readonly;
        }
        dir = this._cleanFilePath(dir);
        if (!this._isFileInDisk(dir)) {
            return ec.notindisk;
        }
        if (this.exists(dir)) {
            console.error(this.disk, "mkdir", "Tried to create a directory when it already exists.");
            return ec.alreadyexists;
        }
        fs.mkdirSync(this.filePath + dir, {recursive: true});
        return this.exists(dir);
    }

    /**
     * Returns whether an object exists at the specified absolute path in the file system.
     * @return boolean
     */
    exists(file) {
        file = this._cleanFilePath(file);
        return !!(this._isFileInDisk(file) && fs.existsSync(this.filePath + file));
    }

    /**
     * Writes the specified data to an open file descriptor with the specified handle.
     * @return boolean
     */
    write(file, value, offset, mode) {
        if (this.isReadOnly()) {
            return ec.readonly;
        }
        file = this._cleanFilePath(file);
        if (!this.exists(file)) {
            return ec.filenotfound;
        }
        if (this.spaceTotal() <= this.spaceUsed()) {
            return ec.diskfull;
        }
        let spaceLimit = value.length + this.spaceUsed() - this.spaceTotal();
        if (spaceLimit > 0) {
            value = value.substring(0, spaceLimit);
        }

        if (mode === "a" || mode === "a+") {
            offset = null;
        }

        let data = Buffer.from(value);
        let oldSize = fs.statSync(this.filePath + file)["size"];
        let f = fs.openSync(this.filePath + file, mode);
        let bytes = fs.writeSync(f, data, offset);
        fs.closeSync(f);
        let newSize = fs.statSync(this.filePath + file)["size"];
        this.info.spaceUsed += newSize - oldSize;
        this._commit();
        return bytes;
    }

    /**
     * Returns whether the object at the specified absolute path in the file system is a directory.
     * @return boolean
     */
    isDirectory(file) {
        return this.exists(file) && fs.lstatSync(this.filePath + file).isDirectory();
    }

    /**
     * Renames/moves an object from the first specified absolute path in the file system to the second.
     */
    rename(from, to) {
        if (this.isReadOnly()) {
            return ec.readonly;
        }
        from = this._cleanFilePath(from);
        to = this._cleanFilePath(to);
        if (!this.exists(from)) {
            return ec.filenotfound;
        }
        if (!(this._isFileInDisk(to) && !this.exists(to))) {
            return ec.notindisk;
        }
        fs.renameSync(this.filePath + from, this.filePath + to);
        return this.exists(to);
    }

    /**
     * Returns a list of names of objects in the directory at the specified absolute path in the file system.
     * @return array | boolean
     */
    list(file) {
        if (!this.exists(file)) {
            return false;
        }
        let files = [];
        fs.readdirSync(this.filePath + file).forEach(f => {
            files[files.length] = f;
        });
        return files;
    }

    /**
     * Returns the (real world) timestamp of when the object at the specified absolute path in the file system was modified.
     * @return number
     */
    lastModified(file) {
        if (!this.exists(file)) {
            return ec.filenotfound;
        }
        let stats = fs.statSync(this.filePath + file);
        return Math.floor(stats.mtimeMs);
    }

    /**
     * Removes the object at the specified absolute path in the file system.
     * @return boolean
     */
    remove(file) {
        if (this.isReadOnly()) {
            return ec.readonly;
        }
        if (this.exists(file) && !this.isDirectory(file)) {
            this.info.spaceUsed -= fs.statSync(this.filePath + file)["size"];
            this._commit();
            fs.unlinkSync(this.filePath + file);
        } else if (this.exists(file) && this.isDirectory(file)) {
            //Wee fun times. I get to scan through all the files and sub directories and remove them one by one.
            //Gotta keep that space usage accurate. -.-
            let files = this.list(file);
            for (let subfile in files) {
                this.remove(file + "/" + files[subfile]);
            }
            fs.rmdirSync(this.filePath + file);
        }
        return !this.exists(file);
    }

    /**
     * Closes an open file descriptor with the specified handle.
     * This should never be needed on the http backend.
     * @return number
     */
    close(file) {
    }

    /**
     * Returns the size of the object at the specified absolute path in the file system.
     * @return number
     */
    size(file) {
        if (!this.exists(file)) {
            return ec.filenotfound;
        }
        if (this.isDirectory(file)) {
            return ec.isdir;
        }
        let stats = fs.statSync(this.filePath + file);
        return stats.size;
    }

    /**
     * Reads up to the specified amount of data from an open file descriptor with the specified handle. Returns nil when EOF is reached.
     * @return string | null
     */
    read(file, count, offset) {
        if (!this.exists(file)) {
            return ec.filenotfound;
        }
        if (count === "inf") {
            count = this.size(file);
        }

        let size = this.size(file);
        count = parseInt(count);

        if (offset > size) {
            return ec.pasteof;
        }

        if (count + offset > size) {
            count = size - offset;
        }

        let data = Buffer.allocUnsafe(count);
        let f = fs.openSync(this.filePath + file, "r+");
        fs.readSync(f, data, 0, count, offset);
        fs.closeSync(f);
        return data.toString("utf8");
    }
}


module.exports = OCFilesystem;
