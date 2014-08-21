var cio           = require('engine.io-client');

function Client() {

  var self = this;

  self.endpoint = {
    address: 'http://localhost:44444'
  };

  self.socket = cio(self.endpoint.address);

  self.socket.on('open', function(){
    console.log('Client :: Open event from socket: ' + self.socket.id);
    self.socket.send('Hello World from Client');
  });

  self.socket.on('message', function(msg){
    console.log('Client :: Message event from socket: ' + self.socket.id + ', with message: ' + msg);
  });

  self.socket.on('close', function(){
    console.log('Client :: Close event from socket: ' + self.socket.id);
  });

  self.socket.on('disconnect', function(){
    console.log('Client :: Disconnect event from socket: ' + self.socket.id);
  });
}

// Run the client
var client = new Client();
