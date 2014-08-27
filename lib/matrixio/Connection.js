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

var _             = require('lodash'),
    idgen         = require('flake-idgen'),
    biguintformat = require('biguint-format'),
    HashMap       = require('hashmap').HashMap,
    Payload       = require('./Payload');

var idGenerator   = new idgen();

/**
 * Connection Class handles client and server connections
 */
var Connection = function(parent, main) {
  'use strict';
  var self = this;
  self.parent = parent;
  self.main = main;

  // aliases
  self.endpoint = self.parent.endpoint;
  self.socket = self.parent.socket;
  self.type = self.parent.type;

  // Set Connection STATE == CONNECTION_DOWN
  self.state = self.STATES.CONNECTION_DOWN;
  if (self.main.debug) {
    // console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::Node', self.parent.endpoint.address, 'CONNECTION_DOWN');
  }

  self.type = parent.type;
};

Connection.prototype.disconnect = function() {
  var self = this;
  self.socket.close();
  self.socket.removeAllListeners();
};

Connection.prototype.destroy = function() {
  var self = this;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::~Node', self.parent.endpoint.address, 'NODE_DESTROYED');
  }
};

Connection.prototype.update = function() {
  var self = this;
  var knownNodes = [];
  self.main.connections.forEach(function(node,id){
    if (node.state === node.STATES.CONNECTION_UP && node.identity) {
      knownNodes.push({
        name: node.identity.name,
        id: node.identity.id.toJSON()
      });
    }
  });
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::update', self.endpoint.address, 'CONNECTION_UPDATING');
  }
  self.send(Payload.create(self.main.identity.id, self.main.identity.name, idGenerator.next(), 'node::update', JSON.stringify({ identity: self.main.identity, nodes: knownNodes })));
};

Connection.prototype.handle = function(socket) {
  var self = this;
  if (socket) {
    self.socket = socket;
  }

  var knownNodes = [];
  self.main.connections.forEach(function(node,id){
    if (node.state === node.STATES.CONNECTION_UP && node.identity) {
      knownNodes.push({
        name: node.identity.name,
        id: node.identity.id.toJSON()
      });
    }
  });

  setTimeout(function(){
    // are we still authenticating after 5 seconds -> disconnect
    if (self.state === self.STATES.CONNECTION_AUTHENTICATING) {
      if (self.main.debug) {
        self.main.log.debug({
          'OwnerID': {
            content: biguintformat(self.main.identity.id,'hex',{groupsize:4,delimiter:':'}),
            len: 16,
            color: 'grey'
          },
          'SourceID': {
            content: '-',
            len: 16,
            color: 'grey'
          },
          'Hops': {
            content: '-',
            len: 4,
            color: 'grey'
          },
          'MsgID': {
            content: '-',
            len: 16,
            color: 'grey'
          },
          'Name': {
            content: self.main.identity.name,
            len: 0,
            color: 'red'
          },
          'Event': {
            content: 'node::timeout',
            len: 0,
            color: 'cyan'
          },
          'Data': {
            content: '-',
            len: 0,
            color: 'cyan'
          }
        });
        //console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::handle', self.endpoint.address, 'CONNECTION_AUTHENTICATING -> CONNECTION_DOWN (TIMEOUT)');
      }
      self.state = self.STATES.CONNECTION_DOWN;
      self.socket.close();
      self.main.removeConnection(self);
    }
  }, 5000);

  // Set Node STATE == CONNECTION_AUTHENTICATING
  self.state = self.STATES.CONNECTION_AUTHENTICATING;
  if (self.main.debug) {
    // console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::handle', self.endpoint.address, 'CONNECTION_AUTHENTICATING');
    self.main.log.debug({
      'OwnerID': {
        content: ' ' + biguintformat(self.main.identity.id,'hex',{groupsize:4,delimiter:':'}) + ' ',
        len: 16,
        color: 'grey'
      },
      'SourceID': {
        content: '-',
        len: 16,
        color: 'grey'
      },
      'Hops': {
        content: '-',
        len: 4,
        color: 'grey'
      },
      'MsgID': {
        content: '-',
        len: 16,
        color: 'grey'
      },
      'Name': {
        content: self.main.identity.name,
        len: 0,
        color: 'red'
      },
      'Event': {
        content: 'node::authenticating',
        len: 0,
        color: 'cyan'
      },
      'Data': {
        content: '-',
        len: 0,
        color: 'cyan'
      }
    });
  }

  self.socket.on('message', function(binary_payload){
    var payload = Payload.parse(binary_payload);
    var identity;
    var msgIdAsHex = biguintformat(payload.msg_id, 'hex');
    // console.log('[DEBUG]'.green, self.main.identity.name + ': Connection -> Received message ' + payload.event.blue + ' from connection ' + self.socket.id, payload);
    if (payload && !self.main.messages.has(msgIdAsHex)) {
      self.main.messages.set(msgIdAsHex, payload);
      var json = payload.data;
      try {
        json = JSON.parse(payload.data);
      }
      catch (e) {
      }
      switch (payload.event) {

        case "node::hello":
          var isAlreadyConnected = false;
          if (Payload.compareBuffer8(self.main.identity.id, payload.owner_id)) {
            isAlreadyConnected = true;
          }
          self.main.connections.forEach(function(node, id){
            if (node.state === node.STATES.CONNECTION_UP && node.endpoint.identity) {
              if (Payload.compareBuffer8(node.endpoint.identity.id, payload.owner_id)) {
                isAlreadyConnected = true;
                return false;
              }
            }
          });

          if (isAlreadyConnected) {
            self.send(Payload.create(self.main.identity.id, self.main.identity.name, idGenerator.next(), 'node::already_connected', ''));

            if (self.parent.type === 'CLIENT') {
              self.parent.state = self.parent.STATES.CLIENT_INACTIVE;
              if (self.main.debug) {
                console.log(('CONNECTION :: ' + self.parent.endpoint.address + ' :: already connected + setting this client connection to inactive and closing socket # ' + self.socket.id).red);
              }
            } else {
              if (self.main.debug) {
                console.log(('CONNECTION :: ' + self.parent.endpoint.address + ' :: already connected + closing socket # ' + self.socket.id).red);
              }
            }
            self.socket.close();

          } else {
            if (self.main.debug) {
              self.main.log.debug({
                'OwnerID': {
                  content: biguintformat(payload.owner_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'SourceID': {
                  content: biguintformat(payload.source_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'Hops': {
                  content: payload.hops.toString(),
                  len: 4,
                  color: 'grey'
                },
                'MsgID': {
                  content: biguintformat(payload.msg_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'Name': {
                  content: payload.owner_name,
                  len: 0,
                  color: 'red'
                },
                'Event': {
                  content: payload.event,
                  len: 0,
                  color: 'cyan'
                },
                'Data': {
                  content: json,
                  len: 0,
                  color: 'cyan'
                }
              });
            }
            (function(){
              var identity = self.endpoint.identity = {};
              identity.name = payload.owner_name;
              identity.id = payload.owner_id;
              identity.knownNodes = [];
              if (_.has(json, 'nodes')) {
                _.forEach(json.nodes, function(node){
                  identity.knownNodes.push({
                    name: node.name,
                    id: new Buffer(node.id)
                  });
                });
              }
            })();
            self.send(Payload.create(self.main.identity.id, self.main.identity.name, idGenerator.next(), 'node::welcome', ''));
          }
          break;

        case "node::update":
          // We got network update message
          (function(){
            var identity = self.endpoint.identity;
            identity.name = payload.owner_name;
            identity.id = payload.owner_id;
            identity.knownNodes = [];
            _.forEach(json.nodes, function(node){
              identity.knownNodes.push({
                name: node.name,
                id: new Buffer(node.id)
              });
            });
          })();
          break;

        case "node::already_connected":
          self.main.emit('node::already_connected', { owner_name: payload.owner_name });
          // We are already connected to this node
          if (self.main.debug) {
            self.main.log.debug({
              'OwnerID': {
                content: biguintformat(payload.owner_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'SourceID': {
                content: biguintformat(payload.source_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Hops': {
                content: payload.hops.toString(),
                len: 4,
                color: 'grey'
              },
              'MsgID': {
                content: biguintformat(payload.msg_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Name': {
                content: payload.owner_name,
                len: 0,
                color: 'red'
              },
              'Event': {
                content: payload.event,
                len: 0,
                color: 'cyan'
              },
              'Data': {
                content: json,
                len: 0,
                color: 'cyan'
              }
            });
          }
          // If we are Client we need to mark the connection as inactive (until service up info is received)
          if (self.parent.type === 'CLIENT') {
            self.parent.state = self.parent.STATES.CLIENT_INACTIVE;
            if (self.main.debug) {
              console.log(('CONNECTION :: ' + self.parent.endpoint.address + ' :: already connected + setting this client connection to inactive and closing socket # ' + self.socket.id).red);
            }
          } else {
            if (self.main.debug) {
              console.log(('CONNECTION :: ' + self.parent.endpoint.address + ' :: already connected + closing socket # ' + self.socket.id).red);
            }
          }
          self.send(Payload.create(self.main.identity.id, self.main.identity.name, idGenerator.next(), 'node::goodbye', ''));
          self.socket.close();
          break;

        case "node::goodbye":
          // We need to disconnect
          console.log(('CONNECTION :: ' + self.parent.endpoint.address + ' :: we got message that we need to disconnect socket # ' + self.socket.id).red);
          // Note: We must be CONNECTION_AUTHENTICATING
          if (self.state === self.STATES.CONNECTION_AUTHENTICATING) {
            if (self.main.debug) {
              self.main.log.debug({
                'OwnerID': {
                  content: biguintformat(payload.owner_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'SourceID': {
                  content: biguintformat(payload.source_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'Hops': {
                  content: payload.hops.toString(),
                  len: 4,
                  color: 'grey'
                },
                'MsgID': {
                  content: biguintformat(payload.msg_id,'hex',{groupsize:4,delimiter:':'}),
                  len: 0,
                  color: 'grey'
                },
                'Name': {
                  content: payload.owner_name,
                  len: 0,
                  color: 'red'
                },
                'Event': {
                  content: payload.event,
                  len: 0,
                  color: 'cyan'
                },
                'Data': {
                  content: json,
                  len: 0,
                  color: 'cyan'
                }
              });
            }
            self.socket.close();
            if (self.parent.type === 'CLIENT') {
              self.parent.state = self.parent.STATUS.DOWN;
            }
          }
          break;

        case "node::welcome":
          self.main.emit('node::welcome', { owner_name: payload.owner_name });
          // Set Node STATE == CONNECTION_UP
          self.state = self.STATES.CONNECTION_UP;
          if (self.main.debug) {
            self.main.log.debug({
              'OwnerID': {
                content: biguintformat(payload.owner_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'SourceID': {
                content: biguintformat(payload.source_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Hops': {
                content: payload.hops.toString(),
                len: 4,
                color: 'grey'
              },
              'MsgID': {
                content: biguintformat(payload.msg_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Name': {
                content: payload.owner_name,
                len: 0,
                color: 'red'
              },
              'Event': {
                content: payload.event,
                len: 0,
                color: 'cyan'
              },
              'Data': {
                content: json,
                len: 0,
                color: 'cyan'
              }
            });
          }
          break;

          /**
           * For any other event type we should re-broadcast to all connections
           */
        default:
          if (!self.main.debug) {
            self.main.log.info({
              '__Owner__': {
                id: payload.owner_id,
                name: payload.owner_name,
              },
              'Event': {
                content: payload.event,
                len: 40,
                color: 'cyan'
              },
              'Data': {
                content: json,
                len: 50,
                color: 'grey'
              }
            });
          } else {
            self.main.log.debug({
              'OwnerID': {
                content: biguintformat(payload.owner_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'SourceID': {
                content: biguintformat(payload.source_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Hops': {
                content: payload.hops.toString(),
                len: 4,
                color: 'grey'
              },
              'MsgID': {
                content: biguintformat(payload.msg_id,'hex',{groupsize:4,delimiter:':'}),
                len: 0,
                color: 'grey'
              },
              'Name': {
                content: payload.owner_name,
                len: 0,
                color: 'red'
              },
              'Event': {
                content: payload.event,
                len: 0,
                color: 'cyan'
              },
              'Data': {
                content: json,
                len: 0,
                color: 'cyan'
              }
            });
          }
          self.main.rebroadcast(binary_payload);
          break;
      }
    }

  });

  self.socket.on('error', function(err){
    //console.log('Socket error', err);
  });

  self.socket.on('close', function(err){
    //console.log('Socket close', err);
  });

  self.socket.on('flush', function(err){
    //console.log('Socket flush', err);
  });

  self.socket.on('drain', function(err){
    //console.log('Socket drain', err);
  });

  self.socket.on('upgradeError', function(err){
    //console.log('Socket upgradeError', err);
  });

  self.socket.on('disconnected', function(err){
    //console.log('Socket disconnected', err);
  });

  self.send(Payload.create(self.main.identity.id, self.main.identity.name, idGenerator.next(), 'node::hello', JSON.stringify({ nodes: knownNodes })));

};

Connection.prototype.send = function(binary_payload, source_id) {
  var self = this;
  if (!Payload.compareBuffer8(self.main.identity.id, source_id)) {
    // console.log('Sending payload', Payload.parse(binary_payload));
    self.socket.send(binary_payload);
  }
};

Connection.prototype.close = function() {
  // Closing connection
};

Connection.prototype.STATES = {
  CONNECTION_DOWN: { value: 0, name: 'CONNECTION_DOWN' },
  CONNECTION_CONNECTING: { value: 10, name: 'CONNECTION_CONNECTING' },
  CONNECTION_AUTHENTICATING: { value: 20, name: 'CONNECTION_AUTHENTICATING' },
  CONNECTION_UP: { value: 30, name: 'CONNECTION_UP' },
  CONNECTION_TRY_LATER: { value: 100, name: 'CONNECTION_TRY_LATER' },
  CONNECTION_SERVICE_DOWN: { value: 9999, name: 'CONNECTION_SERVICE_DOWN' }
};

try { module.exports = Connection; }
catch (e) {}

