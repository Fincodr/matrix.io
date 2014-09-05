/*global require, define, console*/

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

var Connection    = require('./Connection'),
    HashMap       = require('hashmap').HashMap;

var Connections = function(main) {
  'use strict';
  var self = this;
  self.main = main;

  self.connections = new HashMap();
};

Connections.prototype.create = function(id, parent) {
  var self = this;
  if (!self.connections.has(id)) {
    // add new connection and return it
    var connection = new Connection(parent, self.main);
    self.connections.set(id, connection);
    return connection;
  } else {
    // return null
    return null;
  }
};

Connections.prototype.remove = function(id) {
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

Connections.prototype.get = function(id) {
  var self = this;
  if (self.connections.has(id)) {
    return self.connections.get(id);
  } else {
    return null;
  }
};

Connections.prototype.forEach = function(cb) {
  var self = this;
  self.connections.forEach(cb);
};

try { module.exports = Connections; }
catch (e) {}
