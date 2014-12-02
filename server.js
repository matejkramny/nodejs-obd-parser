
var serialport = require("serialport");
// var port = new serialport.SerialPort("/dev/ttyUSB0", {
	// baudRate: 38400,
	// parser: serialport.parsers.readline("\r")
// });

var port = new (require('./fakeserial'))();

var initSequence = [
	"AT L0",
	"AT I",
	"AT @1",
	"AT DP",
	//"AT SP 0",
	"AT RV",
	"AT E0" // echo mode
];

var commands = [];

var availableCommands = [];

[
	'absLoad',
	'actualEngineTorque',
	'ambientAirTemp',
	'coolant',
	'engineFuelRate',
	'engineLoad',
	'engineOilTemp',
	'engineRefTorque',
	'fuelLevelInput',
	'fuelPressure',
	'intakeAirTemp',
	'rpm',
	'runtime',
	'speed',
	'throttlePosition',
	'throttleRelativePosition'
].forEach(function (a) {
	availableCommands.push(require('./commands/' + a));
});

console.log(availableCommands)

var supportCmdSeq = [0, 20, 40, 60];

var currentCommand = 0;

var isInit = 0;

var prevData = [];

port.on("open", function () {
	console.log('opened connection');

	port.on('data', parseData);

	// init sequence
	port.write(initSequence[0] + "\r\n");
});

function parseData (data) {
	if (data == "\r" || data.length == 0) return;

	if (isInit == 0) {
		parseInitData(data);
	} else if (isInit == 1) {
		if (supportCmdSeq.length == 0) {
			isInit = 2;
			writeNext();
			return;
		}

		parseSupportCmd(data, supportCmdSeq[0]);
		supportCmdSeq.splice(0, 1);

		var cmd = supportCmdSeq[0]
		port.write("01" + cmd + "\r\n");
	} else {
		mainDataLoop(data);
	}
}

function parseInitData (data) {
	console.log(data);

	if (data.indexOf(initSequence[0]) == -1) return;

	initSequence.splice(0, 1);

	if (initSequence.length > 0) {
		port.write(initSequence[0] + "\r\n")
	} else {
		isInit = 1;
		// get supported cmds
		port.write("0100" + "\r\n");
		// writeNext();
	}
}

function mainDataLoop (data) {
	// Parse the data.
	// console.log(data);

	var d = data.replace(/[^A-Fa-f0-9]/g, '');

	var prefix = (commands[currentCommand].class + 40) + commands[currentCommand].id
	if (d.length > 4 && d.substring(0, 4) == prefix) {
		var buf = new Buffer(d.substring(4, d.length), 'hex');

		var res = commands[currentCommand].parse(buf);
		prevData.push(res + " " + commands[currentCommand].name);

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
		currentCommand = 0;
		console.log("\033[2J" + prevData.join("\n"))

		prevData = [];
	}

	var cmd = ('0' + commands[currentCommand].class) + commands[currentCommand].id;

	// console.log('Wrote', cmd);
	port.write(cmd + " 1\r\n");
}

function parseSupportCmd (data) {
	var buf = new Buffer(data.replace(/ /g, ''), 'hex');
	console.log(buf, buf.length);

	var supportedPins = [];

	var pin = 0;
	for (var i = 0; i < buf.length; i++) {
		var byte = buf.readUInt8(i);
		console.log(byte.toString(2), '??');

		for (var b = 0; b < 8; b++) {
			pin++;

			if (byte & (1 << b)) {
				supportedPins.push(pin);
			}
		}
	}

	for (var i = 0; i < availableCommands.length; i++) {
		for (var x = 0; x < supportedPins.length; x++) {
			var pinHex = supportedPins[x].toString(16);
			if (pinHex.length == 1) {
				pinHex = '0' + pinHex;
			}

			pinHex = pinHex.toUpperCase();

			if (availableCommands[i].id == pinHex) {
				commands.push(availableCommands[i]);
			}
		}
	}

	console.log(supportedPins, commands);
}
