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
	create: function(b_owner_id, b_msg_id, event, msg) {
		if (event.length > 255) {
			throw new Error('Fatal Error: event string is too long (> 255 chars)');
		}
		if (msg.length > 65535) {
			throw new Error('Fatal Error: msg string is too long (> 65535 chars)');
		}
		var b_source_id = new Buffer(8);
		b_owner_id.copy(b_source_id, 0, 0, 8);
		var b_hops = new Buffer(1);
		b_hops.writeUInt8(0, 0);
		var b_event_len = new Buffer(1);
		var b_event = new Buffer(event, 'ascii');
		b_event_len.writeUInt8(event.length, 0);
		var b_msg_len = new Buffer(2);
		var b_msg = new Buffer(msg, 'utf8');
		b_msg_len.writeUInt16BE(msg.length, 0);
		return Buffer.concat([b_source_id, b_hops, b_owner_id, b_msg_id, b_event_len, b_event, b_msg_len, b_msg]);
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
		var source_id = new Buffer(8);
		payload.copy(source_id, 0, i, i+8);
		i+=8;
		var hops = payload.readUInt8(i);
		i++;
		var owner_id = new Buffer(8);
		payload.copy(owner_id, 0, i, i+8);
		i+=8;
		var msg_id = new Buffer(8);
		payload.copy(msg_id, 0, i, i+8);
		i+=8;
		var event_len = payload.readUInt8(i);
		i++;
		var event = payload.toString('utf8', i, i+event_len);
		i+=event_len;
		var msg_len = payload.readUInt16BE(i);
		i+=2;
		var msg = payload.toString('utf8', i, i+msg_len);
		return { source_id: source_id, owner_id: owner_id, msg_id: msg_id, hops: hops, event: event, msg: msg };
	}
};

try { module.exports = Export; }
catch (e) {}
