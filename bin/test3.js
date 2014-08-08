
var Matrix = require('../lib/matrixio/Matrix');

var node3 = new Matrix({
	banner: true,
	debug: true,
	colors: true,
	console: true,
	identity: {
		name: 'Matrix 3',
		datacenter: 100,
		worker: 56
	},
	endpoints: [
		"http://127.0.0.1:33303"
	],
	connections: [
		"https://127.0.0.1:33320"
	]
});