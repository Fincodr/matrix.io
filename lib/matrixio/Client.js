'use strict';
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

var cio           = require('engine.io-client'),
    biguintformat = require('biguint-format'),
    HashMap       = require('hashmap').HashMap,
    Payload       = require('./Payload');

/**
 * The Client class
 *
 * Client class handles one connection to a fixed endpoint
 *
 * When connection is established a Node class will be created to handle communications between Nodes
 * When connection is disconnected the Node connection will be notified and removed
 *
 * Client states are:
 * CLIENT_DOWN - There is no active connection
 * CLIENT_CONNECTING - There is active outbound connection attempt but not yet active connection
 * CLIENT_UP - There is active connection
 * CLIENT_DISABLED - This connection will not be retried
 *
 * @param {string} address The endpoint to connect to
 * @param {object} main    The Matrix class
 */
var Client = function(address, main) {
  var self = this;
  self.main = main;
  var parts = address.split(':');

  self.endpoint = {
    address: address,
    ssl: parts[0]==='https'?true:false,
    protocol: parts[0],
    host: parts[1].substring(2),
    port: parts.length>1?parts[2]:33301
  };

  // Set Client STATE == CLIENT_DOWN
  self.state = self.STATES.CLIENT_DOWN;

  self.socket = null;
  self.node = null;

  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::Client', self.endpoint.address, 'CLIENT_DOWN (INIT)');
  }

  self.type = 'CLIENT';
};

Client.prototype.disconnect = function() {
  var self = this;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::disconnect', self.endpoint.address);
  }
  try {
    self.socket.close();
  } catch (ee) {}
};

Client.prototype.onConnectionTimeout = function() {
  var self = this;
  if (self.state === self.STATES.CLIENT_CONNECTING) {
    // Remove listeners
    self.socket.off('open');
    self.socket.off('close');
    // Disconnect socket
    self.socket.close();
    // Set Client STATE == CLIENT_DOWN
    self.state = self.STATES.CLIENT_DOWN;

    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::Client', self.endpoint.address, 'CLIENT_DOWN (TIMEOUT)');
    }
  }
};

Client.prototype.connect = function() {
  var self = this;

  // Set Client STATE == CLIENT_CONNECTING
  self.state = self.STATES.CLIENT_CONNECTING;

  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::connect', self.endpoint.address, 'CLIENT_CONNECTING');
  }

  self.socket = cio(self.endpoint.address);
  self.id = null;

  // Disconnect socket if CONNECTION_TIMEOUT
  var timeoutId = setTimeout(function(){
    self.onConnectionTimeout();
  }, self.main.options.CONNECTION_TIMEOUT);


  // Connection established
  self.socket.on('open', function() {

    self.id = self.socket.id;

    //clearTimeout(timeoutId);
    self.state = self.STATES.CLIENT_UP;

    if (self.main.debug) {
      console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::connect', self.endpoint.address, 'CLIENT_CONNECTED');
    }

    self.node = self.main.createNode(self.id, self);
    if (self.node) {
      self.node.handle();
    } else {
      self.socket.close();
      self.state = self.STATES.CLIENT_INACTIVE;
    }

  });

  self.socket.on('close', function() {
    if (self.node) {
      if (self.main.debug) {
        console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::connect', self.endpoint.address, 'CLIENT_DOWN (DISCONNECTED)');
      }
      self.main.removeNode(self.id);
      self.node = null;

      // Set Client STATE == CLIENT_DOWN
      if (self.state !== self.STATES.CLIENT_INACTIVE) {
        self.state = self.STATES.CLIENT_DOWN;
      }
    }
  });

  self.socket.on('disconnect', function() {
    if (self.node) {
      if (self.main.debug) {
        console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Client::connect', self.endpoint.address, 'CLIENT_DOWN (DISCONNECTED)');
      }
      self.main.removeNode(self.id);
      self.node = null;

      // Set Client STATE == CLIENT_DOWN
      if (self.state !== self.STATES.CLIENT_INACTIVE) {
        self.state = self.STATES.CLIENT_DOWN;
      }
    }
  });

};

Client.prototype.STATES = {
  CLIENT_DOWN: { value: 0, name: 'CLIENT_DOWN' },
  CLIENT_CONNECTING: { value: 10, name: 'CLIENT_CONNECTING'},
  CLIENT_UP: { value: 10, name: 'CLIENT_UP' },
  CLIENT_INACTIVE: { value: 9999, name: 'CLIENT_INACTIVE' }
};

try { module.exports = Client; }
catch (e) {}
