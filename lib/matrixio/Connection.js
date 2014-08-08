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

var _             = require('lodash'),
    Payload       = require('./Payload'),
    biguintformat = require('biguint-format'),
    idgen         = require('flake-idgen'),
    util          = require('util'),
    eventEmitter  = require('eventemitter2').EventEmitter2;

var idGenerator   = new idgen();


var Connection = function(socket, main, mode, address) {
  var self = this;
  self.mode = mode;
  self.address = address;
  self.main = main;
  self.socket = socket;
  self.identity = {
    name: 'unknown',
    id: new Buffer(8)
  }
  self.identity.id.fill(0);
};

// Extend with eventEmitter properties
util.inherits(Connection, eventEmitter);

Connection.prototype.handle = function() {
  var self = this;

  // send authentication request by sending our identity first
  self.emit('authenticating');
  self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::hello', JSON.stringify({ identity: self.main.identity })));
  //console.log('[DEBUG]'.green, self.main.identity.name + ': Connection -> Sending identity to connection ' + self.socket.id);

  self.socket.on('message', function(binary_payload){
    var payload = Payload.parse(binary_payload);
    //console.log('[DEBUG]'.green, self.main.identity.name + ': Connection -> Received message ' + payload.event.blue + ' from connection ' + self.socket.id);
    if (payload) {
      var json = payload.msg;
      try {
        json = JSON.parse(payload.msg);
      }
      catch (e) {
      }
      switch (payload.event) {
        case "node::hello":
          var identity_id = new Buffer(json.identity.id);
          var isAlreadyConnected = false;
          self.main.connections.forEach(function(connection, id){
            if (Payload.compareBuffer8(connection.identity.id, identity_id)) {
              isAlreadyConnected = true;
            }
          });
          if (isAlreadyConnected) {
            self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::goodbye', ''));
          } else {
            if (self.main.debug) {
              console.log(
                biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red +
                ' ' +
                ('[' + self.main.identity.name + ']').red +
                ' connection::authenticated with ' +
                '[' + json.identity.name + '] ' +
                biguintformat(payload.owner_id, 'hex', {groupsize:4, delimiter:':'})
              );
            }
            self.identity.name = json.identity.name;
            self.identity.id = identity_id
            self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::status', ''));
          }
          break;
        case "node::goodbye":
          // 3. We need to disconnect
          if (self.main.debug) {
            console.log(
              biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
              ('[' + self.main.identity.name + ']').red +
              ' ' + payload.event
            );
          }
          self.socket.close();
          break;
        case "message":
          self.main.rebroadcast(binary_payload);
          if (self.main.debug) {
            console.log(
              biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
              ('[' + self.main.identity.name + ']').red +
              ' ' + payload.event,
              JSON.stringify(_.extend({
              owner_id: biguintformat(payload.owner_id, 'hex', {groupsize:4, delimiter:':'}),
              hops: payload.hops,
              msg_id: biguintformat(payload.msg_id, 'hex', {groupsize:4, delimiter:':'})
              },
              json))
            );
          } else {
            console.log(
              biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
              ('[' + self.main.identity.name + ']').red + ' ' +
              payload.event + ' ' +
              (' ' + json.msg + ' ').inverse.yellow + ' ' +
              'from ' + ('[' + json.from + ']').green
            );
          }
          self.main.emit(payload.event, json);
          break;
      }
    }
  });
};

Connection.prototype.send = function(payload, source_id) {
  var self = this;
  if (!Payload.compareBuffer8(self.main.identity.id, source_id)) {
    self.socket.send(payload);
  }
};

Connection.prototype.close = function() {
  // Closing connection
};

try { module.exports = Connection; }
catch (e) {}

