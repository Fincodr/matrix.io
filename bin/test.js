
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
		"http://127.0.0.1:33310"
	],
	connections: [
		"https://127.0.0.1:33320",
		"https://127.0.0.1:33330"
	]
});

var node2 = new Matrix({
	banner: false,
	debug: true,
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
		"http://127.0.0.1:33310",
		"http://127.0.0.1:33330"
	]
});

var node3 = new Matrix({
	banner: false,
	debug: true,
	colors: true,
	identity: {
		name: 'Matrix 3',
		datacenter: 100,
		worker: 56
	},
	endpoints: [
		"http://127.0.0.1:33330"
	],
	connections: [
		"https://127.0.0.1:33320",
		"https://127.0.0.1:33310"
	]
});

/*
node1.on('node::connect', function(connection){
	var self = this;
	setTimeout(function(){
		self.broadcast('hello', { 'me': 'node1', 'msg': 'hello there node2 and node3' });
	}, 1000);
})

node2.on('node::connect', function(connection){
	this.on('hello', function(data){
		if (data.msg !== 'you too!') {
			this.broadcast('hello', { 'me': 'node2', 'msg': 'you too!' });
		}
	});
});

node3.on('node::connect', function(connection){
	this.on('hello', function(data){
		if (data.msg !== 'you too!') {
			this.broadcast('hello', { 'me': 'node3', 'msg': 'you too!' });
		}
	});
});
*/