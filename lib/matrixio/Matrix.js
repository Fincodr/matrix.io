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
    util          = require('util'),
    HashMap       = require('hashmap').HashMap,
    colors        = require('colors2'),
    eventEmitter  = require('eventemitter2').EventEmitter2,
    idgen         = require('flake-idgen'),
    biguintformat = require('biguint-format'),
    Payload       = require('./Payload'),
    Client        = require('./Client'),
    Server        = require('./Server');

var idGenerator   = new idgen();

// Fix: [Error: xhr poll error] description: 503
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


var Matrix = function(options) {
  try {

    var self = this;
    self.defaults = {
      channel: 'matrix::message',
      delimiter: '::',
      identity: {
        id: null,
        name: 'unnamed',
        datacenter: 0,
        worker: process.pid
      },
      CLIENT_CHECK_INTERVAL: 5000,
      CONNECTION_TIMEOUT: 2500
    };
    self.options = _.extend(self.defaults, options);
    if (options.identity) {
      self.options.identity = _.extend(self.defaults.identity, options.identity);
    }

    // aliases
    self.debug = self.options.debug;
    self.colors = self.options.colors;
    self.identity = _.clone(self.options.identity);
    self.uuidGenerator = new idgen({ datacenter: self.identity.datacenter, worker: self.identity.worker });
    self.identity.id = self.uuidGenerator.next();

    self.connections = new HashMap();
    self.delimiter = self.options.delimiter;

    // Show banner
    if (self.options.banner) {
      self.banner();
    }

    // Create Server for each endpoint
    self.servers = [];
    _.forEach(options.endpoints, function(endpoint){
      self.servers.push(new Server(endpoint, self));
    });

    // Create clients for each client
    self.clients = [];
    _.forEach(options.connections, function(client){
      self.clients.push(new Client(client, self));
    });

    // Start server listen
    _.forEach(self.servers, function(server){
      server.listen();
    });

    // Start initial clients
    _.forEach(self.clients, function(client){
      if (client.state === 0) {
        client.state = 1;
        client.connect();
      }
    });

    // Check clients again every 5 seconds
    var intervalCheckclients = setInterval(function(){
      _.forEach(self.clients, function(client){
        if (client.state === 0) {
          client.state = 1;
          client.connect();
        }
      })
    }, self.options.CLIENT_CHECK_INTERVAL);

    if (self.options.console) {
      //process.stdout.write((self.identity.name + ':').magenta);
      // process standard input
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function (chunk) {
        var lines = chunk.split('\n');
        lines.forEach(function(line){
          if (line) {
            if (line[0] === '/') {
              switch (line) {
                case '/quit':
                case '/exit':
                  process.exit(0);
                  break;
                case '/connections':
                  self.connections.forEach(function(connection, id){
                    console.log(id, connection.identity);
                    _.forEach(connection.connections, function(connection){
                      console.log('  ', connection);
                    });
                  });
                  break;
              }
            } else {
              self.broadcast(self.options.channel, { msg: line, from: self.identity.name });
              /*
              // self.emit('matrix' + self.delimiter + 'STDIN', line, self.sender);
              try {
                // Eval input line
                eval(line);
              } catch (err) {
                // Silently ignore eval errors
              }
              */
            }
          }
        });
        //process.stdout.write((self.identity.name + ':').magenta);
      });
    }
  } catch (e) {
    console.error('Exception:', e.toString());
    process.exit(-1);
  }

}

// Extend with eventEmitter properties
util.inherits(Matrix, eventEmitter);

Matrix.prototype.rebroadcast = function(payload) {
  var self = this;
  // copy payload source id
  var payload_source_id = new Buffer(8);
  payload.copy(payload_source_id, 0, 0, 8);
  // copy payload owner id
  var payload_owner_id = new Buffer(8);
  payload.copy(payload_owner_id, 0, 9, 9+8);
  //   0      7 8 9
  // [ 12345678 1 12345678 ]
  // increment payload hops and set source to ourself
  Payload.incrementHops(payload);
  Payload.setSourceId(payload, self.identity.id);
  // broadcast to all connections (except to the owner or last hop)
  //console.log('Payload owner id  = ' + biguintformat(payload_owner_id, 'hex', { groupsize: 4, delimiter: ':' }));
  //console.log('Payload source id = ' + biguintformat(payload_source_id, 'hex', { groupsize: 4, delimiter: ':' }));
  self.connections.forEach(function(connection, id){
    //console.log('Rebroadcasting');
    //console.log('--------------');
    //console.log('Connection identity = ' + biguintformat(connection.identity.id, 'hex', { groupsize: 4, delimiter: ':' }));
    if (!Payload.compareBuffer8(payload_source_id, connection.identity.id) && !Payload.compareBuffer8(payload_owner_id, connection.identity.id)) {
      connection.send(payload);
    }
  });
}

Matrix.prototype.broadcast = function(event, data) {
  var self = this;
  var payload = Payload.create(self.identity.id, idGenerator.next(), event, JSON.stringify(data));
  if (self.debug) {
    console.log(biguintformat(self.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.identity.name + ']').red + ' node::broadcast ', event, data);
  }
  // broadcast to all connections
  self.connections.forEach(function(connection, id){
    connection.send(payload);
  });
}

Matrix.prototype.banner = function() {
  console.log("matrix.io  Copyright (C) 2014  Mika 'Fincodr' Luoma-aho");
  console.log("This program comes with ABSOLUTELY NO WARRANTY;");
  console.log("This is free software, and you are welcome to redistribute it");
  console.log("under certain conditions; see LICENSE for details.");
  console.log("           _       _       _     ".red);
  console.log(" _____ ___| |_ ___|_|_ _  |_|___ ".blue);
  console.log("|     | .'|  _|  _| |_'_|_| | . |");
  console.log("|_|_|_|__,|_| |_| |_|_,_|_|_|___|".blue);
  console.log("");
};

try { module.exports = Matrix; }
catch (e) {}