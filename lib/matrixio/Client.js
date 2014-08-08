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

var cio           = require('engine.io-client'),
    biguintformat = require('biguint-format'),
    idgen         = require('flake-idgen'),
    Payload       = require('./Payload'),
    HashMap       = require('hashmap').HashMap,
    Connection    = require('./Connection');

var idGenerator   = new idgen();

var Client = function(connection, main) {
  var self = this;
  var parts = connection.split(':');
  self.ssl = parts[0]==='https'?true:false;
  self.host = parts[1].substring(2);
  self.port = parts.length>1?parts[2]:33301;
  self.connection = connection;
  self.main = main;
  self.state = 0; // 0 = not connected/disconnected, 1 = trying to connect, 20 = need to authenticate, 30 = authenticated, 99 = try again later, 9999 = disabled
  //console.log(biguintformat(parent.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + parent.identity.name + ']').red + ' client::created', { host: self.host, port: self.port, ssl: self.ssl });
}

Client.prototype.STATUS = {
  NOT_CONNECTED: 0,
  CONNECTING: 10,
  AUTHENTICATING: 20,
  READY: 30,
  TRY_LATER: 100,
  DISABLED: 9999
};

Client.prototype.connect = function() {
  var self = this;
  var connection_id = null;
  self.socket = cio(self.connection);
  self.socket.on('open', function() {
    connection_id = self.socket.id;
    var connection = new Connection(self.socket, self.main, 'client', self.connection);
    self.main.connections.set(connection_id, connection);
    connection.handle();  
    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' node::connected', { host: self.host, port: self.port, ssl: self.ssl });
    }
    self.state = 20;
    self.main.emit('node::connected', self.connection);
  });
  self.socket.on('close', function() {
    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' node::disconnected', { host: self.host, port: self.port, ssl: self.ssl });
    }
    if (connection_id) {
      var connection = self.main.connections.get(connection_id);
      connection.close();
      self.main.connections.remove(connection_id);
    }
    self.state = 0;
  });
  
  /*
  self.socket.on('message', function(binary_payload) {
    var payload = Payload.parse(binary_payload);
    // check if we already have processed this message
    if (payload) {
      var json = payload.msg;
      try {
        json = JSON.parse(payload.msg);
      }
      catch (e) {
      }
      switch (payload.event) {
        case "node::authenticate":
          // 1. Send our identity first
          console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' client::authenticating');
          self.broadcast(Payload.create(self.main.identity.id, idGenerator.next(), 'node::authentication', JSON.stringify({ identity: self.main.identity })));
          break;
        case "node::authentication":
          // 2. We got server identity back
          console.log(
            biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red +
            ' ' +
            ('[' + self.main.identity.name + ']').red +
            ' client::authenticated with ' +
            '[' + json.identity.name + '] ' +
            biguintformat(payload.owner_id, 'hex', {groupsize:4, delimiter:':'})
          );
          self.identity = {
            name: json.identity.name,
            id: new Buffer(json.identity.id)
          }
          self.broadcast(Payload.create(self.main.identity.id, idGenerator.next(), 'node::authenticated', self.connection));
          self.state = 30;
          break;
        case "node::goodbye":
          // 3. We need to disconnect
          self.socket.disconnect();
          break;
        case "message":
          self.main.rebroadcast(Payload.incrementHops(binary_payload));
          console.log(
            biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
            ('[' + self.main.identity.name + ']').red +
            ' client::socket::on::' + payload.event,
            {
              owner_id: biguintformat(payload.owner_id, 'hex', {groupsize:4, delimiter:':'}),
              hops: payload.hops,
              msg_id: biguintformat(payload.msg_id, 'hex', {groupsize:4, delimiter:':'})
            },
            json
          );
          self.main.emit(payload.event, json);
          break;
      }
    }
  });
  */
}

/*
Client.prototype.send = function(payload, source_id) {
  var self = this;
  if (!Payload.compareBuffer8(self.identity.id, source_id)) {
    self.socket.send(payload);
  }
}
*/

try { module.exports = Client; }
catch (e) {}