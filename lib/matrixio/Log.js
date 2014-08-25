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
    colors        = require('colors2'),
    winston       = require('winston');

/**
 * Pad string
 */
function pad(str, len, chr) {
   var s = '';
   if (str) {
      s = str;
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
  })
  return arr;
}

/**
 * Simple logger class that inherits winston
 * @param {object} options Settings that will be passed for the winston instance
 */
var Log = function(options) {
  var self = this;

  self.options = _.clone(options);

  // expand transports to actual winston transports
  options.transports = buildWinstonTransports(options.transports);
  options.exceptionHandlers = buildWinstonTransports(options.exceptionHandlers);

  self.winston = new (winston.Logger)(options);

  self.winston.cli();
};

Log.prototype.error = function() {
  var self = this;
  self.winston.error(arguments[0]);
}

Log.prototype.warn = function() {
  var self = this;
  self.winston.warn(arguments[0]);
}

Log.prototype.debug = function() {
  var self = this;
  self.winston.debug(arguments[0]);
}

Log.prototype.info = function() {
  var self = this;
  self.winston.info(arguments[0]);
}

// Aliases
Log.prototype.write = Log.prototype.info;
Log.prototype.print = Log.prototype.info;

try { module.exports = Log; }
catch (e) {}