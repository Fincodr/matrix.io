
var Matrix = require('../lib/matrixio/Matrix');

var node2 = new Matrix({
	banner: true,
	debug: true,
	colors: true,
	console: true,
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
	/*
		"http://127.0.0.1:33301",
		"http://127.0.0.1:33303"
	*/
	]
});
