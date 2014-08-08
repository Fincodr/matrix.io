'use strict';

/*

Copyright (C) 2014  Mika "Fincodr" Luoma-aho

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

var eio           = require('engine.io'),
    fs            = require('fs'),
    https         = require('https'),
    biguintformat = require('biguint-format'),
    HashMap       = require('hashmap').HashMap,
    Connection    = require('./Connection');

var Server = function(endpoint, main) {
  var self = this;
  self.main = main;
  var parts = endpoint.split(':');
  self.ssl = parts[0]==='https'?true:false;
  self.host = parts[1].substring(2);
  self.port = parts.length>1?parts[2]:33301;
  self.endpoint = endpoint;
}

Server.prototype.listen = function() {
  var self = this;
  if (this.ssl) {
    self.https = https.createServer({
      key: fs.readFileSync(self.main.options.ssl_key),
      cert: fs.readFileSync(self.main.options.ssl_cert)
    }).listen(this.port, this.host);
    self.server = eio.attach(this.https);
  } else {
    self.server = eio.listen(this.port, this.host);
  }
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::listening', { ssl: this.ssl, host: this.host, port: this.port });
  }
  self.server.on('connection', function(socket){
    var connection = new Connection(socket, self.main, 'server', self.endpoint);
    self.main.connections.set(socket.id, connection);
    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::connection', socket.id);
    }
    connection.handle();  
    socket.on(['close', 'disconnect'], function(){
      if (self.main.debug) {
        console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::disconnection', socket.id);
      }
      connection.close();
      self.main.connections.remove(socket.id);
    })
  });
}

/*
Server.prototype.broadcast = function(payload, source_id) {
  var self = this;
  self.main.socketsMap.forEach(function(socket, id){
    var socketIdentity = self.socketsIdMap.get(id);
    if (!Payload.compareBuffer8(socketIdentity.id, source_id)) {
      console.log('Broadcasting message', Payload.parse(payload), 'because my identity:', socketIdentity.id, 'is different from source_id:',source_id);
      socket.send(payload);
    }
  });
}
*/

try { module.exports = Server; }
catch (e) {}