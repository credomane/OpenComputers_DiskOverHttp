function ConsoleHijack(loggingLevel) {
    const oconsolelog = console.log;
    const oconsolewarn = console.warn;
    const oconsoleerror = console.error;

    switch (loggingLevel.toString().toLowerCase()) {
        case "debug":
            loggingLevel = 4
            break;
        case "info":
            loggingLevel = 3
            break;
        case "warn":
        case "warning":
            loggingLevel = 2
            break;
        case "err":
        case "error":
            loggingLevel = 1
            break;
        case "none":
            loggingLevel = 0
            break;
        default:
            loggingLevel = 0;
    }


    //Used for "debug" logging.
    console.log = function (...args) {
        if (loggingLevel < 4) {
            return;
        }

        oconsolelog("[DEBUG ]", ...args);
    }

    //Used for Special cases.
    console.forcelog = function (...args) {
        oconsolelog(...args);
    }

    //Used for "info" logging.
    console.info = function (...args) {
        if (loggingLevel < 3) {
            return;
        }

        oconsolelog("[ INFO ]", ...args);
    }

    //Used for "info" logging.
    console.ok = function (...args) {
        if (loggingLevel < 3) {
            return;
        }

        oconsolelog("[  OK  ]", ...args);
    }

    //Used for "warning" logging.
    console.warn = function (...args) {
        if (loggingLevel < 2) {
            return;
        }

        oconsolewarn("[ WARN ]", ...args);
    }

    //Used for "error" logging.
    console.error = function (...args) {
        if (loggingLevel < 1) {
            return;
        }

        oconsoleerror("[ERROR ]", ...args);
    }

    //Used for "error" logging.
    console.fail = function (...args) {
        if (loggingLevel < 1) {
            return;
        }

        oconsoleerror("[ FAIL ]", ...args);
    }

}

module.exports = ConsoleHijack;
