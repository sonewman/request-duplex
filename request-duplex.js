var Duplex = require('readable-stream/duplex')
var http = require('http')
var inherits = require('inherits')

function makeRequest(duplex, options) {
  function onerror(err) {
    duplex.emit('error', err)
  }
  
  function endReq() {
    req.removeListener('error', onerror)
  }

  var req
  = duplex._req 
  = http.request(options, function (res) {
    duplex._res = res
    duplex.emit('status', res.statusCode)
    duplex.emit('response', res)
    
    function resErr(err) { onerror(err) }

    function endRes() {
      res.removeListener('data', ondata)
      res.removeListener('error', resErr)
      endReq()
    }

    function ondata(data) {
      duplex.push(data)
    }

    res.once('error', resErr)
    res.on('data', ondata)
    res.once('end', function () {
      duplex.push(null)
      endRes()
    })
  })
  
  function reqErr(err) { onerror(err) }
  req.once('error', reqErr)
}

function RequestDuplex(options) {
  if (!(this instanceof RequestDuplex))
    return new RequestDuplex(options)

  this._options = options || {}
  var streamOpts = {}
  this._responded = false
  this._fwdStatus = options.status === false ? false : true
  this._fwdHeaders = options.headers === false ? false : true
  this._statusCode = 0

  if (this._options.objectMode === true) {
    streamOpts.objectMode = true
    delete this._options.objectMode
  }

  Duplex.call(this, streamOpts)
}

inherits(RequestDuplex, Duplex)

module.exports = RequestDuplex

Object.defineProperty(RequestDuplex.prototype, 'statusCode', {
  get: function () { return this._res && this._res.statusCode }
})

Object.defineProperty(RequestDuplex.prototype, 'responded', {
  get: function () { return !!this._res }
})

Object.defineProperty(RequestDuplex.prototype, 'headers', {
  get: function () {
    return this._res ? this._res.headers : {}
  }
})

// this has to be here if we want to send body data
// in a `get` request else it will not actually send
// the data this avoids users from dealing with this
function transEnc(options) {
  options.headers = options.headers || {}
  var currentEnc = options.headers['Transfer-Encoding']
  options.headers['Transfer-Encoding'] = currentEnc || 'chunked'
}

function maybeMakeReq(duplex, data) {
  if (!duplex._req) {
    if (data) transEnc(duplex._options)
    makeRequest(duplex, duplex._options)
  }
}

RequestDuplex.prototype._write = function (data, enc, next) {
  maybeMakeReq(this, data)
  this._req.write(data)
  next()
}

var end = RequestDuplex.prototype.end
RequestDuplex.prototype.end = function (data, enc) {
  maybeMakeReq(this, data)
  end.call(this, data, enc)
  this._req.end()
}

RequestDuplex.prototype._read = function (n) {
  return this._res && this._res.read(n)
}

function extend(a, b) {
  for (var i in b) a[i] = b[i]
  return a
}

var pipe = RequestDuplex.prototype.pipe
RequestDuplex.prototype.pipe = function (writable) {
  if (this._fwdStatus === true) {
    if (this.responded) {
      Object.defineProperty(writable, 'statusCode', {
        get: function () { return code }
      })
    } else {
      this.once('status', function (code) {
        Object.defineProperty(writable, 'statusCode', {
          get: function () { return code }
        })
      })
    }
  }

  if (this._fwdHeaders === true) {
    writable.headers = writable.headers || {}
    if (this.responded) {
      writable.headers = extend(writable.headers, this._res.headers)
    } else {
      this.on('response', function (res) {
        writable.headers = extend(writable.headers, res.headers)
      })
    }
  }

  pipe.call(this, writable)
}

