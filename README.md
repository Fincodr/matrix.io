matrix.io
=========

Automatically create matrix of connected nodes and broadcast messages in the matrix.

## Features

- Lightweight
- Automatically discovers other matrix nodes on the same network (mdns)
- Uses engine.io to establish websocket connections
- Sends and receives binary data

## Installation

  ```bash
  npm install matrix.io
  ```

## Using mdns (multicast dns) to automatically discover other nodes on the same networks

### Installation on Linux

On Linux and other systems using the avahi daemon the avahi dns_sd compat library and its header files are required.  On debianesque systems the package name is @libavahi-compat-libdnssd-dev@.  On other platforms Apples "mDNSResponder":http://opensource.apple.com/tarballs/mDNSResponder/ is recommended. Care should be taken not to install more than one mDNS stack on a system.

### Installation on Windows

On Windows you are going to need Apples "Bonjour SDK for Windows". You can download it either from Apple (registration required) or various unofficial sources. Take your pick. After installing the SDK restart your shell or command prompt and make sure the @BONJOUR_SDK_HOME@ environment variable is set. You'll also need a compiler. Microsoft Visual Studio Express will do. On Windows node >=0.7.9 is required.

## Usage in your own code

  ```js
  var Matrix = require('matrix.io');

  Matrix.on('top-secret::event-name', function(data){
    console.log('Received message', data);
    Matrix.send('top-secret::event-name', {
      msg: 'Hello There ' + this.name
    });
  });
  ```

## Usage with the stand-alone matrix-client

### Run simple client that connects automatically to other matrix nodes and listens for all events and sends matrix::global events

  ```bash
  $ matrix-client --mdns
  ```

### Automatically connect to other matrix nodes and specify name and event to send

  ```bash
  $ matrix-client --mdns --name="John Doe" --event="private-chat::private-channel"
  ```

### Listen on http://localhost:33333 and connect to http://localhost:44444 and http://localhost:55555

  ```bash
  $ matrix-client --endpoint=http://localhost:33333 --connection=http://localhost:44444 --connection=http://localhost:55555
  ```

## Events

  Event format is `aa::bb::cc::..::..::zz` (default delimiter is `::`)

## Supported command line arguments

  ```
  --mdns        [=true|false]   Enable multicast DNS for automatic discovery
  --console     [=true|false]   Enable console input (default: true)
  --log         [=filename]     Set log filename (default: ./matrix.log)
  --loglevel    [=level]        Set log level (default: info, available levels: verbose, debug, error, warning, info)
  --debug       [=true|false]   Enable debug output (default: true)
  --banner      [=true|false]   Show banner (default: true)
  --name        [=name]         Set node name (default: hostname+process-pid)
  --event       [=event]        Set event name (default: matrix::global) - See Events for more information
  --connection  [=address]      Create outbound connection to the specified http:// or https:// address
  --endpoint    [=address]      Listen inbound connections in the specified http:// or https:// address
  --datacenter  [=#]            Set datacenter number (0-255, default: 0)
  --worker      [=#]            Set worker number (0-255, default: process-pid)
  --ssl         [=true|false]   Use SSL when automatically creating networks (default: false, usable with --mdns)
  --key         [=ssl.key]      SSL key to use (default: ./server.key, usable with --ssl or https:// endpoint)
  --cert        [=ssl.cert]     SSL cert to use (default: ./server.cert, usable with --ssl or https:// endpoint)
  --register    [=true|false]   Automatically register endpoints (default: true, usable with --mdns)
  ```

## TODO

  ```
  TODO: --colors    [=true|false]   Enable/disable colors in output
  TODO: --showuid   [=true|false]   Show UUID's when in debug mode (default: true)
  ```

## License

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
∏
