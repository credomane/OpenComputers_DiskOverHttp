let ec = {};

//Must all be strings or expressjs thinks we are sending a status code and throws a deprecated error.
ec.unknownerror = "-254";
ec.nodisk = "-200";
ec.fsneedsmanaged = "-201";
ec.drvneedsunmanaged = "-202";
ec.notindisk = "-203";
ec.invalidopenmode = "-204";
ec.filenotfound = "-205";
ec.readonly = "-206";
ec.alreadyexists = "-207";
ec.diskfull = "-208";
ec.isdir = "-209";
ec.pasteof = "-210";
ec.nan = "-211";

module.exports = ec;
