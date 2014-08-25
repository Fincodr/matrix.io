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

var _             = require('lodash'),
    idgen         = require('flake-idgen'),
    biguintformat = require('biguint-format'),
    HashMap       = require('hashmap').HashMap,
    Payload       = require('./Payload');

var idGenerator   = new idgen();

/**
 * Node Class handles client and server connections
 */
var Node = function(parent, main) {
  var self = this;
  self.parent = parent;
  self.main = main;

  // aliases
  self.endpoint = self.parent.endpoint;
  self.socket = self.parent.socket;
  self.type = self.parent.type;

  // Set Node STATE == NODE_DOWN
  self.state = self.STATES.NODE_DOWN;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::Node', self.parent.endpoint.address, 'NODE_DOWN');
  }

  self.type = parent.type;
};

Node.prototype.destroy = function() {
  var self = this;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::~Node', self.parent.endpoint.address, 'NODE_DESTROYED');
  }
};

Node.prototype.update = function() {
  var self = this;
  var knownNodes = [];
  self.main.nodes.forEach(function(node,id){
    if (node.state === node.STATES.NODE_UP && node.identity) {
      knownNodes.push({
        name: node.identity.name,
        id: node.identity.id.toJSON()
      });
    }
  });
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::update', self.endpoint.address, 'NODE_UPDATING');
  }
  self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::update', JSON.stringify({ identity: self.main.identity, nodes: knownNodes })));
};

Node.prototype.handle = function(socket) {
  var self = this;
  if (socket) {
    self.socket = socket;
  }

  var knownNodes = [];
  self.main.nodes.forEach(function(node,id){
    if (node.state === node.STATES.NODE_UP && node.identity) {
      knownNodes.push({
        name: node.identity.name,
        id: node.identity.id.toJSON()
      });
    }
  });

  setTimeout(function(){
    // are we still authenticating after 5 seconds -> disconnect
    if (self.state === self.STATES.NODE_AUTHENTICATING) {
      if (self.main.debug) {
        console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::handle', self.endpoint.address, 'NODE_AUTHENTICATING -> NODE_DOWN (TIMEOUT)');
      }
      self.state = self.STATES.NODE_DOWN;
      self.socket.close();
      self.main.removeNode(self);
    }
  }, 5000);

  // Set Node STATE == NODE_AUTHENTICATING
  self.state = self.STATES.NODE_AUTHENTICATING;
  if (self.main.debug) {
    console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::handle', self.endpoint.address, 'NODE_AUTHENTICATING');
  }

  self.socket.on('message', function(binary_payload){
    var payload = Payload.parse(binary_payload);
    var identity;
    var msgIdAsHex = biguintformat(payload.msg_id, 'hex');
    //console.log('[DEBUG]'.green, self.main.identity.name + ': Connection -> Received message ' + payload.event.blue + ' from connection ' + self.socket.id, payload);
    if (payload && !self.main.messages.has(msgIdAsHex)) {
      self.main.messages.set(msgIdAsHex, payload);
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
          if (Payload.compareBuffer8(self.main.identity.id, identity_id)) {
            isAlreadyConnected = true;
          }
          self.main.nodes.forEach(function(node, id){
            if (node.state === node.STATES.NODE_UP && node.endpoint.identity) {
              if (Payload.compareBuffer8(node.endpoint.identity.id, identity_id)) {
                isAlreadyConnected = true;
                return false;
              }
            }
          });

          if (isAlreadyConnected) {
            self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::already_connected', ''));
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
            (function(){
              var identity = self.endpoint.identity = {};
              identity.name = json.identity.name;
              identity.id = identity_id;
              identity.knownNodes = [];
              _.forEach(json.nodes, function(node){
                identity.knownNodes.push({
                  name: node.name,
                  id: new Buffer(node.id)
                });
              });
            })();
            self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::welcome', ''));
          }
          break;

        case "node::update":
          // We got network update message
          (function(){
            var identity = self.endpoint.identity;
            identity.name = json.identity.name;
            identity.id = identity_id;
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
          // We are already connected to this node
          if (self.main.debug) {
            console.log(
              biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
              ('[' + self.main.identity.name + ']').red +
              ' ' + payload.event
            );
          }
          // If we are Client we need to mark the connection as inactive (until service up info is received)
          if (self.parent.type === 'CLIENT') {
            self.parent.state = self.parent.STATES.CLIENT_INACTIVE;
          }
          self.socket.close();
          break;

        case "node::goodbye":
          // We need to disconnect
          // Note: We must be NODE_AUTHENTICATING
          if (self.state === self.STATES.NODE_AUTHENTICATING) {
            if (self.main.debug) {
              console.log(
                biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
                ('[' + self.main.identity.name + ']').red +
                ' ' + payload.event
              );
            }
            self.socket.close();
            if (self.parent.type === 'CLIENT') {
              self.parent.state = self.parent.STATUS.DOWN;
            }
          }
          break;

        case "node::welcome":
          // Set Node STATE == NODE_UP
          self.state = self.STATES.NODE_UP;
          if (self.main.debug) {
            console.log(biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.main.identity.name + ']').red + ' Node::handle', self.endpoint.address, 'NODE_UP');
          }
          break;

          /**
           * For any other event type we should emit the event
           */
        default:
          self.main.emit(payload.event, {
            /** Event */
            event: payload.event,

            /** Who is sending the data */
            uid: self.main.identity.id,
            from: {
              uid: payload.owner_id,
              name: payload.owner_name
            }

          });
          self.main.rebroadcast(binary_payload);
          if (self.main.debug) {
            console.log(
              biguintformat(self.main.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' +
              ('[' + self.main.identity.name + ']').red +
              ' ' + payload.event,
              JSON.stringify(_.extend({
              source_id: biguintformat(payload.source_id, 'hex', {groupsize:4, delimiter:':'}),
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
              'from ' + ('[' + payload.owner_name + ']').green
            );
          }
          self.main.emit(payload.event, json);
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

  self.send(Payload.create(self.main.identity.id, idGenerator.next(), 'node::hello', JSON.stringify({ identity: self.main.identity, nodes: knownNodes })));

};

Node.prototype.send = function(binary_payload, source_id) {
  var self = this;
  if (!Payload.compareBuffer8(self.main.identity.id, source_id)) {
    // console.log('Sending payload', Payload.parse(binary_payload));
    self.socket.send(binary_payload);
  }
};

Node.prototype.close = function() {
  // Closing connection
};

Node.prototype.STATES = {
  NODE_DOWN: { value: 0, name: 'NODE_DOWN' },
  NODE_CONNECTING: { value: 10, name: 'NODE_CONNECTING' },
  NODE_AUTHENTICATING: { value: 20, name: 'NODE_AUTHENTICATING' },
  NODE_UP: { value: 30, name: 'NODE_UP' },
  NODE_TRY_LATER: { value: 100, name: 'NODE_TRY_LATER' },
  NODE_SERVICE_DOWN: { value: 9999, name: 'NODE_SERVICE_DOWN' }
};

try { module.exports = Node; }
catch (e) {}

