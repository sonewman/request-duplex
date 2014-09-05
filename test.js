var RequestDuplex = require('./')
var should = require('should')
var sinon = require('sinon')
var stream = require('readable-stream')
var http = require('http')

describe('RequestDuplex!', function () {

  beforeEach(function () {
    var self = this
    var i = 0
    self.data = [
      'some'
      , 'data'
    ]

    self.input = new stream.Readable()
    self.input._read = function () {
      i < self.data.length
        ? this.push(self.data[i++])
        : this.push(null);
    }
    
    self.result = ''
    self.output = new stream.Writable()
    self.output._write = function (chunk, enc, next) {
      if (chunk) self.result += chunk
      next()
    }

  })

  it('Should handle successful request', function (done) {
    var self = this
    var responseData = "response from webserver"
    var responseCode = 200

    var server = http.createServer(function (req, res) {
      var incomingData = "";
      req.on('data', function (d) {
        incomingData += d
      })
      req.on('end', function () {
        incomingData.should.equal(self.data.join(''))
      })

      res.statusCode = responseCode
      res.end(responseData)
    })
    
    var port
    server.listen(function () {
      port = server.address().port
      
      var options = {
        port: port
        , method: "GET"
      }
      
      var r = new RequestDuplex(options)

      self.output.on('finish', function () {
        self.result.should.equal(responseData)
        self.output.statusCode.should.equal(200)
        r.statusCode.should.equal(200)
        done();
        server.close()
      })

      r.on('error', function (err) {
        console.error(err)
      })
      
      self.input.pipe(r).pipe(self.output)
    })
  })
  
  it('Should take a stream piped into it', function (done) {
    var responseData = "response from webserver"
    var responseCode = 500

    var server = http.createServer(function (req, res) {
      res.statusCode = responseCode
      res.end(responseData)
    })
    
    var port
    var self = this
    server.listen(function () {
      port = server.address().port
      
      var options = {
        port: port
        , method: "GET"
      }
      
      // should still work without new
      var r = RequestDuplex(options)

      self.output.on('finish', function () {
        self.output.statusCode.should.equal(500)
        r.statusCode.should.equal(500)
        done();
        server.close()
      })
      
      self.input.pipe(r).pipe(self.output)
    })
  })
  
  it('Should emit error on request error', function (done) {
    var responseData = "response from webserver"
    var options = {
      port: 38711
      , method: "GET"
    }
      
    // should still work without new
    var r = RequestDuplex(options)
    r.on('error', function (err) {
      (err instanceof Error).should.equal(true)
      done()
    })

    this.input.pipe(r).pipe(this.output)
  })
  
  it('Should emit error if response from resource errors', function (done) {
    var mockRequest = new stream.Writable()
    mockRequest._write = function (d, e, n) { n() }
    var mockResponse = new stream.Writable()
    
    sinon.stub(http, 'request')
      .returns(mockRequest)
      .callsArgWithAsync(1, mockResponse)

    var server = http.createServer(function (req, res) {
      res.statusCode = 500
      res.end('NOT OK!')
    })
    
    var port
    var self = this
    server.listen(function () {
      port = server.address().port
      
      var options = {
        port: port
        , method: "GET"
      }
      
      var r = new RequestDuplex(options)
      r.on('error', function (err) {
        (err instanceof Error).should.equal(true)
        done()
      })
      
      self.input.pipe(r).pipe(self.output)

      setImmediate(function () {
        mockResponse.emit('error', new Error())
      })
    })
  })
  
})

