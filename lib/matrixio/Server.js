/*global require, Buffer, define, console, module*/

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
    _             = require('lodash');

var Server = function(address, main) {
  'use strict';
  var self = this;
  self.main = main;

  var parts = address.split(':');
  self.endpoint = {
    ssl: parts[0]==='https'?true:false,
    protocol: parts[0],
    host: parts[1].substring(2),
    port: parts.length>1?parseInt(parts[2],10):33301,
    address: address
  };

  // Set Client STATE == CLIENT_DOWN
  self.state = self.STATES.SERVER_DOWN;

  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Server::Server', self.endpoint.address, 'SERVER_DOWN (INIT)');
  }

  self.type = 'SERVER';
};

Server.prototype.listen = function() {
  var self = this;

  // Set Server STATE == SERVER_UP
  self.state = self.STATES.SERVER_UP;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::listening', self.endpoint.address, 'SERVER_UP');
  }

  if (self.endpoint.ssl) {
    self.https = https.createServer({
      key: fs.readFileSync(self.main.options.ssl_key),
      cert: fs.readFileSync(self.main.options.ssl_cert)
    }).listen(self.endpoint.port, self.endpoint.host);
    self.server = eio.attach(this.https);
  } else {
    self.server = eio.listen(self.endpoint.port, self.endpoint.host);
  }

  if (self.main.options.mdns && self.main.options.register && (self.main.options.registerlocal || self.endpoint.internal===false)) {
    var mdns = require('mdns2');
    var ad = mdns.createAdvertisement(mdns.tcp('http'), self.endpoint.port, {
      name: 'matrix::' + self.endpoint.address
    });
    ad.start();
  }

  self.server.on('connection', function(socket){
    var id = socket.id;
    var client = {
      endpoint: _.clone(self.endpoint),
      type: 'SERVER'
    };
    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::listening', self.endpoint.address, 'SERVER_CONNECTION ' + socket.id);
    }
    socket.on('close', function(){
      if (node) {
        if (self.main.debug) {
          console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::disconnection', socket.id);
        }
        self.main.removeConnection(id);
        node = null;
      }
    });
    socket.on('disconnect', function(){
      if (node) {
        if (self.main.debug) {
          console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' server::disconnection', socket.id);
        }
        self.main.removeConnection(id);
        node = null;
      }
    });
    var node = self.main.createConnection(id, client);
    if (node) {
      node.handle(socket);
    }
  });
};

Server.prototype.disconnect = function() {
  var self = this;
  self.server.close();
  self.server.removeAllListeners();
};

Server.prototype.STATES = {
  SERVER_DOWN: { value: 0, name: 'SERVER_DOWN' },
  SERVER_UP: { value: 10, name: 'SERVER_UP' },
  SERVER_DISABLED: { value: 100, name: 'SERVER_DISABLED' }
};

try { module.exports = Server; }
catch (e) {}
