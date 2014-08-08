
var Matrix = require('../lib/matrixio/Matrix');

var node1 = new Matrix({
	banner: true,
	console: true,
	debug: true,
	colors: true,
	identity: {
		name: 'Matrix 1',
		datacenter: 0,
		worker: 1,
	},
	endpoints: [
		"http://127.0.0.1:33301"
	],
	connections: [
		"https://127.0.0.1:33320"
	]
});
