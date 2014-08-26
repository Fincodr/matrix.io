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
    colors        = require('colors2'),
    winston       = require('winston');

/**
 * Pad string and limit to len
 */
function padRight(str, len, chr) {
   var s = str || '';
   if (len===0) {
    return s;
   }
   if (s.length>len) {
    s = s.substr(0, len-3) + '...';
   }
   var l = s.length;
   chr = chr || ' ';
   if (len-l>0) {
      for (var i=0; i<len-l; ++i) {
         s += chr;
      }
   }
   return s;
}

/**
 * Builds a winston transports collection from simple list with options
 * simply by converting:
 *   { Console: {option:'1'}, ... }
 * into:
 *   [ new (winston.transports.Console)({option:'1'}), ... ]
 * @param  {object} simple javascript object
 * @return {object} winston transports
 */
function buildWinstonTransports(transports) {
  var arr = [];
  _.forEach(transports, function(config, name){
    arr.push(new winston.transports[name](config));
  });
  return arr;
}

/**
 * Simple logger class that inherits winston
 * @param {object} options Settings that will be passed for the winston instance
 */
var Log = function(options) {
  'use strict';
  var self = this;

  self.options = _.clone(options);

  // expand transports to actual winston transports
  options.transports = buildWinstonTransports(options.transports);
  options.exceptionHandlers = buildWinstonTransports(options.exceptionHandlers);

  self.winston = new (winston.Logger)(options);

  self.winston.cli();
};

Log.prototype.format = function(data) {
  var o = '';
  var i = 0;
  _.forEach(data, function(value, key){
    ++i;
    if (i>1) {
      o += ' ';
    }
    o += key + ': ' + colors[value.color?value.color:'reset'](padRight(value.content, value.len!==null?value.len:25));
  });
  return o;
};

Log.prototype.error = function(msg) {
  var self = this;
  self.winston.error(self.format(msg));
};

Log.prototype.warn = function(msg) {
  var self = this;
  self.winston.warn(self.format(msg));
};

Log.prototype.debug = function(msg) {
  var self = this;
  self.winston.debug(self.format(msg));
};

Log.prototype.info = function(msg) {
  var self = this;
  self.winston.info(self.format(msg));
};

// Aliases
Log.prototype.write = Log.prototype.info;
Log.prototype.print = Log.prototype.info;

try { module.exports = Log; }
catch (e) {}
