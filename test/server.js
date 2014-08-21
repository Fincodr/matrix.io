var eio           = require('engine.io'),
    HashMap       = require('hashmap').HashMap;

function Server() {

  var self = this;

  self.endpoint = {
    port: 44444,
    host: 'localhost'
  };

  self.server = eio.listen(self.endpoint.port, self.endpoint.host);

  self.server.on('connection', function(socket){
    console.log('Server :: Connection from socket: ' + socket.id);
    socket.on('message', function(msg){
      console.log('Server :: Message event from socket: ' + socket.id + ', with message: ' + msg);
      // echo message back
      socket.send('echoed back: ' + msg);
    });
    socket.on('close', function(){
      console.log('Server :: Close event from socket: ' + socket.id);
    });
    socket.on('disconnect', function(){
      console.log('Server :: Disconnect event from socket: ' + socket.id);
    });
  });
}

var server = new Server();





