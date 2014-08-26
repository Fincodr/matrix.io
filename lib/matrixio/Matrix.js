/*global require, console, process, Buffer, module*/

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
    EventEmitter  = require('eventemitter2').EventEmitter2,
    idgen         = require('flake-idgen'),
    biguintformat = require('biguint-format'),
    portfinder    = require('portfinder'),
    os            = require('os'),
    Payload       = require('./Payload'),
    Client        = require('./Client'),
    Server        = require('./Server'),
    Connection    = require('./Connection'),
    Log           = require('./Log');

var idGenerator   = new idgen();

// Fix: [Error: xhr poll error] description: 503
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Matrix = function(options) {
  'use strict';
  try {
    var self = this;

    self.defaults = {
      event: 'matrix::global',
      events: {
        delimiter: '::',
      },
      logging: {
        exitOnError: false,
        transports: {
          'Console': {
            level: 'info',
            timestamp: true
          },
          'File': {
            filename: 'matrix.log'
          }
        }
      },
      identity: {
        id: null,
        name: null,
        datacenter: 0,
        worker: process.pid
      },
      showuid: false,
      ipfamily: 'IPv4',
      MAX_HOPS: 10,
      CLIENT_CHECK_INTERVAL: 5000,
      CONNECTION_TIMEOUT: 2500
    };

    self.options = _.merge(self.defaults, options);

    if (self.options.identity.name===null) {
      self.options.identity.name = os.hostname() + ':' + process.pid;
    }

    self.log = new Log(self.options.logging);

    // aliases
    self.debug = self.options.debug;
    self.colors = self.options.colors;
    self.identity = _.clone(self.options.identity);
    self.uuidGenerator = new idgen({ datacenter: self.identity.datacenter, worker: self.identity.worker });
    self.identity.id = self.uuidGenerator.next();
    self.delimiter = self.options.events.delimiter;

    // Call EventEmitter
    EventEmitter.call(self, {
      delimiter: self.delimiter,
      wildcard: true
    });

    /**
     * Connections (HashMap) contains list of active connections
     * @type {HashMap}
     */
    self.connections = new HashMap();

    /**
     * Messages contains all received messages
     * @type {HashMap}
     */
    self.messages = new HashMap();

    // Show banner
    if (self.options.banner) {
      self.banner();
    }

    /** Catch all events and log them */
    self.onAny(function(data){
      self.log.info(this.event, data);
    });
    /*
    self.on('my-channel::*::error', function(data){
      self.log.warn(this.event.toString().cyan + data.blue);
    });
    self.emit('my-channel::topic::error', 'my-data');
    */

    // Create Server for each endpoint
    self.servers = [];
    if (options.endpoints) {
      _.forEach(options.endpoints, function(endpoint){
        var server = new Server(endpoint, self);
        self.servers.push(server);
        server.listen();
      });
    } else {
      var networkInterfaces = os.networkInterfaces();
      _.forEach(networkInterfaces, function(networkInterface){
        _.forEach(networkInterface, function(networkEndpoint){
          if (networkEndpoint.family === self.options.ipfamily) {
            // get free port for this network
            portfinder.getPort({
              port: 33300
            }, function(err,port) {
              if (!err) {
                var address = self.options.ssl?'https':'http';
                address += '://' + networkEndpoint.address + ':' + port;
                var server = new Server(address, self);
                server.endpoint.internal = networkEndpoint.internal;
                self.servers.push(server);
                server.listen();
              }
            });
          }
        });
      });
    }

    // Create clients for each client and connect
    self.clients = [];
    _.forEach(options.connections, function(address){
      var client = new Client(address, self);
      client.connect();
      self.clients.push(client);
    });

    if (self.options.mdns && self.options.discover) {
      // watch all http servers
      var mdns = require('mdns2');
      var browser = mdns.createBrowser(mdns.tcp('http'));
      browser.on('serviceUp', function(service) {
        var names = service.name.split('::');
        if (names.length === 2 && names[0]==='matrix') {
          // add to connections
          //console.log("service up: ", names[1]);
          var found = false;
          _.forEach(self.servers, function(server){
            if (server.endpoint.address===names[1]) {
              found = true;
              return false;
            }
          });
          _.forEach(self.clients, function(client){
            if (client.endpoint.address===names[1]) {
              if (client.state === client.STATES.CLIENT_INACTIVE) {
                client.state = client.STATES.CLIENT_DOWN;
              }
              found = true;
              return false;
            }
          });
          if (!found) {
            //console.log('+ new connection to ', names[1]);
            var client = new Client(names[1], self);
            client.endpoint.dynamic = true;
            client.connect();
            self.clients.push(client);
          }
        }
      });
      browser.on('serviceDown', function(service) {
        var names = service.name.split('::');
        if (names.length === 2 && names[0]==='matrix') {
          // remove from connections
          //console.log("service down: ", names[1]);
          var found = false;
          _.forEach(self.servers, function(server){
            if (server.endpoint.address===names[1]) {
              found = true;
              return false;
            }
          });
          if (!found) {
            _.forEach(self.clients, function(client){
              if (client.endpoint.dynamic && client.endpoint.address===names[1]) {
                //console.log('- removed connection from ', client.endpoint);
                client.disconnect();
                client.state = client.STATES.CLIENT_INACTIVE;
                found = true;
                return false;
              }
            });
          }
        }
      });
      browser.start();
    }

    // Check clients again every CLIENT_CHECK_INTERVAL seconds
    var intervalCheckclientsId = setInterval(function(){
      _.forEach(self.clients, function(client){
        if (client.state === client.STATES.CLIENT_DOWN) {
          client.connect();
        }
      });
    }, self.options.CLIENT_CHECK_INTERVAL);

    if (self.options.console) {
      //process.stdout.write((self.identity.name + ' >>>').rainbow);
      // process standard input
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function (chunk) {
        var lines = chunk.split('\n');
        lines.forEach(function(line){
          if (line) {
            if (os.platform()==='win32') {
              line = line.trim('\r');
            }
            if (line[0] === '/') {
              var cmd = line.split(' ');
              switch (cmd[0]) {
                case '/quit':
                case '/exit':
                  process.exit(0);
                  break;
                case '/connect':
                  var found = false;
                  _.forEach(self.servers, function(server){
                    if (server.endpoint.address===cmd[1]) {
                      found = true;
                      return false;
                    }
                  });
                  _.forEach(self.clients, function(client){
                    if (client.endpoint.address===cmd[1]) {
                      if (client.state === client.STATES.CLIENT_INACTIVE) {
                        client.state = client.STATES.CLIENT_DOWN;
                      }
                      found = true;
                      return false;
                    }
                  });
                  if (!found) {
                    var client = new Client(cmd[1], self);
                    client.dynamic = true;
                    client.connect();
                    self.clients.push(client);
                  }
                  break;
                case '/connections':
                  self.connections.forEach(function(connection, id){
                    console.log((' ' + id + ' ').red.inverse, connection.state.name.blue, connection.type.cyan.inverse, connection.endpoint.identity?connection.endpoint.identity:'(no identity)');
                  });
                  break;
                case '/servers':
                case '/endpoints':
                  _.forEach(self.servers, function(server){
                    if (server.state) {
                      console.log((' ' + server.endpoint.address + ' ').red.inverse, server.state.name.blue, server.endpoint);
                    }
                  });
                  break;
                case '/clients':
                  _.forEach(self.clients, function(client){
                    if (client.state) {
                      console.log((' ' + client.endpoint.address + ' ').red.inverse, client.state.name.blue, client.endpoint);
                    }
                  });
                  break;
              }
            } else {
              self.broadcast(self.options.event, { msg: line });
            }
          }
        });
        //process.stdout.write((self.identity.name + ':').magenta);
      });
    }
  } catch (e) {
    self.log.error('Exception: ' + e.toString() + ', ' + e.stack);
    // console.error('Exception:', e.toString());
    // console.trace();
    // process.exit(-1);
  }

};

// Extend with eventEmitter properties
util.inherits(Matrix, EventEmitter);

Matrix.prototype.createConnection = function(id, parent) {
  var self = this;
  if (!self.connections.has(id)) {
    // add new connection and return it
    var connection = new Connection(parent, self);
    self.connections.set(id, connection);
    return connection;
  } else {
    // return null
    return null;
  }
};

Matrix.prototype.removeConnection = function(id) {
  var self = this;
  if (self.connections.has(id)) {
    var node = self.connections.get(id);
    node.destroy();
    self.connections.remove(id);
    node = null;
    return true;
  } else {
    return false;
  }
};

Matrix.prototype.getConnection = function(id) {
  var self = this;
  if (self.connections.has(id)) {
    return self.connections.get(id);
  } else {
    return null;
  }
};

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
  if (Payload.incrementHops(payload) < self.options.MAX_HOPS) {
    Payload.setSourceId(payload, self.identity.id);
    // broadcast to all connections (except to the owner or last hop)
    //console.log('Payload owner id  = ' + biguintformat(payload_owner_id, 'hex', { groupsize: 4, delimiter: ':' }));
    //console.log('Payload source id = ' + biguintformat(payload_source_id, 'hex', { groupsize: 4, delimiter: ':' }));
    self.connections.forEach(function(node, id){
      //console.log('Rebroadcasting');
      //console.log('--------------');
      //console.log('Connection identity = ' + biguintformat(connection.identity.id, 'hex', { groupsize: 4, delimiter: ':' }));
      if (node.state === node.STATES.CONNECTION_UP) {
        if (!Payload.compareBuffer8(payload_source_id, node.endpoint.identity.id) && !Payload.compareBuffer8(payload_owner_id, node.endpoint.identity.id)) {
          node.send(payload);
        }
      }
    });
  }
};

Matrix.prototype.broadcast = function(event, data) {
  var self = this;
  var binary_payload = Payload.create(self.identity.id, self.identity.name, idGenerator.next(), event, JSON.stringify(data));
  var payload = Payload.parse(binary_payload);
  if (self.debug) {
    console.log(biguintformat(self.identity.id, 'hex', { groupsize: 4, delimiter: ':' }).inverse.red + ' ' + ('[' + self.identity.name + ']').red + ' node::broadcast ', event, data);
  }
  // broadcast to all nodes
  self.connections.forEach(function(node, id){
    if (node.state === node.STATES.CONNECTION_UP) {
      node.send(binary_payload);
    }
  });
};

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
