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

var _             = require('lodash');

var Export = {
	compareBuffer8: function(a,b) {
		if (a && b) {
			var a_1 = a.readUInt32BE(0);
			var a_2 = a.readUInt32BE(4);
			var b_1 = b.readUInt32BE(0);
			var b_2 = b.readUInt32BE(4);
			return (a_1===b_1 && a_2===b_2);
		}
		return false;
	},
	create: function(b_owner_id, owner_name, b_msg_id, event, data) {
		if (event.length > 255) {
			throw new Error('Fatal Error: event string is too long (> 255 chars)');
		}
		var data_str = JSON.stringify(data);
		if (data_str.length > 65535) {
			throw new Error('Fatal Error: data string is too long (> 65535 chars)');
		}
		/** Source ID */
		var b_source_id = new Buffer(8);
		/** Hops */
		var b_hops = new Buffer(1);
		b_hops.writeUInt8(0, 0);
		/** Owner ID */
		b_owner_id.copy(b_source_id, 0, 0, 8);
		/** Msg ID */
		/** Owner Name */
		var b_owner_name_len = new Buffer(1);
		var b_owner_name = new Buffer(owner_name, 'ascii');
		b_owner_name_len.writeUInt8(owner_name.length, 0);
		/** Event */
		var b_event_len = new Buffer(1);
		var b_event = new Buffer(event, 'ascii');
		b_event_len.writeUInt8(event.length, 0);
		/** Data */
		var b_data_len = new Buffer(2);
		var b_data = new Buffer(data_str, 'utf8');
		b_data_len.writeUInt16BE(data_str.length, 0);
		return Buffer.concat([
			b_source_id,
			b_hops,
			b_owner_id,
			b_owner_name_len,
			b_owner_name,
			b_msg_id,
			b_event_len,
			b_event,
			b_data_len,
			b_data
		]);
	},
	getHops: function(payload) {
		var hops = payload.readUInt8(8);
		return hops;
	},
	incrementHops: function(payload) {
		var hops = payload.readUInt8(8) + 1;
		payload.writeUInt8(hops, 8);
		return hops;
	},
	setSourceId: function(payload, source_id) {
		source_id.copy(payload, 0, 0, 8);
		return payload;
	},
	parse: function(payload) {
		var i = 0;
		/** Source ID */
		var source_id = new Buffer(8);
		payload.copy(source_id, 0, i, i+8); i+=8;
		/** Hops */
		var hops = payload.readUInt8(i); i++;
		/** Owner ID */
		var owner_id = new Buffer(8);
		payload.copy(owner_id, 0, i, i+8); i+=8;
		/** Owner Name */
		var owner_name_len = payload.readUInt8(i); i++;
		var owner_name = payload.toString('utf8', i, i+owner_name_len); i+=owner_name_len;
		/** Msg ID */
		var msg_id = new Buffer(8);
		payload.copy(msg_id, 0, i, i+8); i+=8;
		/** Event **/
		var event_len = payload.readUInt8(i); i++;
		var event = payload.toString('utf8', i, i+event_len); i+=event_len;
		/** Data */
		var data_len = payload.readUInt16BE(i); i+=2;
		var data = payload.toString('utf8', i, i+data_len);
		return { source_id: source_id, owner_id: owner_id, owner_name: owner_name, msg_id: msg_id, hops: hops, event: event, data: data };
	}
};

try { module.exports = Export; }
catch (e) {}
