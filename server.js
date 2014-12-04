
var util = require('util'),
	fs = require('fs'),
	Table = require('cli-table');

var serialport = require("serialport");
var port = new serialport.SerialPort("/dev/ttyUSB0", {
	baudRate: 38400,
	parser: serialport.parsers.readline("\r")
});

// var port = new (require('./fakeserial'))();

var logtrail = require('logtrail');
logtrail.configure({
	loglevel: 'error'
})
console.log = logtrail.log.bind(logtrail);

var initSequence = [
	"AT E1",
	"AT L0",
	"AT I",
	"AT @1",
	"AT DP",
	//"AT SP 0",
	"AT RV",
	"AT E0" // echo mode
];

var commands = [];
var commandTable = null;

var availableCommands = [];

fs.readdirSync(__dirname + '/commands').forEach(function (e) {
	availableCommands.push(require('./commands/' + e));
});

var supportCmdSeq = [0, 20, 40, 60];
var currentCommand = -1;
var isInit = 0;

port.on("open", function () {
	console.log('opened connection');

	port.on('data', parseData);

	// init sequence
	port.write(initSequence[0] + "\r\n");
});

var origWrite = port.write;
port.write = function (data) {
	console.log('W:', data.replace("\r\n", ''));
	origWrite.call(port, data);
}

function parseData (data) {
	console.log('R:', data);

	if (data == "\r" || data.length == 0) return;

	if (isInit == 0) {
		parseInitData(data);
	} else if (isInit == 1) {
		if (supportCmdSeq.length == 0) {
			isInit = 2;
			console.log("Done.")
			//writeNext();
			return;
		}

		parseSupportCmd(data, supportCmdSeq[0]);
	} else {
		mainDataLoop(data);
	}
}

function parseInitData (data) {
	console.log('Init:', data);

	if (data.indexOf(initSequence[0]) == -1) return;

	initSequence.splice(0, 1);

	if (initSequence.length > 0) {
		port.write(initSequence[0] + "\r\n")
	} else {
		isInit = 1;
		logtrail.warn('INIT Done.');

		// get supported cmds
		port.write("0100" + "\r\n");
	}
}

function mainDataLoop (data) {
	// Parse the data.
	console.log("Main:", data);

	var d = data.replace(/[^A-Fa-f0-9]/g, '');

	var prefix = '41' + commands[currentCommand].id
	if (d.length > 4 && d.substring(0, 4) == prefix) {
		var buf = new Buffer(d.substring(4, d.length), 'hex');

		var res;
		if (buf.length == 1) {
			res = buf.readUInt8(0);
		} else if (buf.length == 2) {
			res = buf.readInt16BE(0);
		} else if (buf.length == 4) {
			res = buf.readInt32BE(0);
		}

		var command = commands[currentCommand];
		var calculated = command.formula(res);

		var lastCalculated = command.lastCalculated;
		if (!lastCalculated) lastCalculated = Date.now();
		command.lastCalculated = Date.now();
		var diff = command.lastCalculated - lastCalculated;

		var row = {};
		row[commands[currentCommand].name] = [command.id, calculated, diff];

		console.log('adding', util.inspect(row));
		commandTable.push(row);

		writeNext();
	}

	if (data.indexOf('SEARCHING') > -1) {
		console.log('searching...')
	} else if (data.indexOf('UNABLETO CONNECT') > -1) {
		console.log('Unable to connect!! Timeout 5s.');

		setTimeout(writeNext, 5000);
	} else if (data.indexOf('NO DATA') > -1) {
		writeNext();
	}
}

function writeNext () {
	currentCommand++;

	if (currentCommand >= commands.length) {
		currentCommand = -1;
		process.stdout.write("\x1b[2J\x1b[H" + commandTable.toString());
		commandTable.splice(0, commandTable.length); //empty

		setTimeout(writeNext, 100);

		return;
	}

	var cmd = '01' + commands[currentCommand].id;
	port.write(cmd + " 1\r\n");
}

function parseSupportCmd (data, sequence) {
	console.log("Support:", data, 'seq:', sequence);

	if (data.indexOf('OK') > -1) {
		return;
	}
	if (data.indexOf('NO DATA') > -1) {
		return skipNextSupportCmd();
	}

	var d = data.replace(/[^A-Fa-f0-9]/g, '');
	console.log('Parsed:', d);

	var seqS = sequence.toString();
	if (seqS.length == 1) {
		seqS = '0' + seqS;
	}

	if (d.substring(0, 4) != '41' + seqS) {
		return;
	}

	var buf = new Buffer(d.substring(4, d.length), 'hex');
	console.log(util.inspect(buf), buf.length);

	var supportedPins = [];

	var pin = 0;
	for (var i = 0; i < buf.length; i++) {
		var byte = buf.readUInt8(i);
		// console.log(byte.toString(2), '??');

		var bin = byte.toString(2).split('');
		var binLength = bin.length;

		if (binLength < 8) {
			for (var x = 0; x < 8 - binLength; x++) {
				bin.unshift('0');
			}
		}

		for (var b = 0; b < 8; b++) {
			pin++;

			if (bin[b] == '1') {
				supportedPins.push(pin);
			}
		}

		// for (var b = 0; b < 8; b++) {
			// if (byte & (1 << b)) {
				// supportedPins.push(pin);
			// }
			// pin++;
		// }
	}

	for (var i = 0; i < availableCommands.length; i++) {
		for (var x = 0; x < supportedPins.length; x++) {
			var pinHex = (supportedPins[x] + parseInt(sequence, 16)).toString(16);
			if (pinHex.length == 1) {
				pinHex = '0' + pinHex;
			}

			pinHex = pinHex.toUpperCase();

			if (availableCommands[i].id == pinHex) {
				var found = false;
				for (var c = 0; c < commands.length; c++) {
					if (commands[c].id == availableCommands[i].id) {
						found = true;
						break;
					}
				}

				if (found == false) {
					commands.push(availableCommands[i]);
				}
			}
		}
	}

	console.log(util.inspect(supportedPins));
	skipNextSupportCmd();
}

function skipNextSupportCmd () {
	supportCmdSeq.splice(0, 1);

	if (supportCmdSeq.length == 0) {
		commandTable = new Table({
			head: ['', 'Value']
		})

		isInit = 2;

		console.log(util.inspect(commands));
		console.log("Done.")
		writeNext();
		return;
	}

	var cmd = supportCmdSeq[0]
	setTimeout(function () {
		port.write("01" + cmd + "\r\n");
	}, 1000);
}
