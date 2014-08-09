
var Matrix = require('../lib/matrixio/Matrix');

var node1 = new Matrix({
	banner: true,
	console: true,
	debug: false,
	colors: true,
	identity: {
		name: 'Matrix 1',
		datacenter: 0,
		worker: 1,
	},
	endpoints: [
		"http://127.0.0.1:33310"
	],
	connections: [
		"https://127.0.0.1:33320"
	]
});

var node2 = new Matrix({
	banner: false,
	debug: false,
	colors: true,
	ssl_key: './server.key',
	ssl_cert: './server.cert',
	identity: {
		name: 'Matrix 2',
		datacenter: 0,
		worker: 2
	},
	endpoints: [
		"https://127.0.0.1:33320"
	],
	connections: [
		"https://127.0.0.1:33310"
	]
});