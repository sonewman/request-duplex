# Request-Duplex

```bash
$ npm install --save request-duplex
```

Request duplex is a simple module which removes the boilerplate around http requests exposing a simple duplex stream.

Unless specified in the options Request-Duplex will also impose it's returing statusCode and headers to whatever the stream is being piped into.

This stream extends from the Node Core Streams 3 implementation which means that it can used as a push stream (`.on('data', function (data) {  })`) or as a pull stream (`.on('readable', function () { this.read()  })`)

The following simple example create a simple web proxy:
```javascript
var http = require('http')
var RequestDuplex = require('request-duplex')

var BE = {
  host: '10.12.35.827',
  port: 8080,
  path: '/resource/endpoint',
  method: 'GET',
}

var server = http.createServer()
server.on('request', function (req, res) {
  var rd = new RequestDuplex(BE)
  req.pipe(rd).pipe(res)
})

server.listen(8888)

```


