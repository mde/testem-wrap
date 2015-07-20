var http = require('http');
var redis = require('redis');
var domain = require('domain');
var REDIS_CHANNEL_IN = 'testem-wrap-proxy-bridge-python-js';
var REDIS_CHANNEL_OUT = 'testem-wrap-proxy-bridge-js-python';

var Bridge = function () {
  var inClient = redis.createClient();
  var outClient = redis.createClient();

  inClient.on('error', console.log);
  outClient.on('error', console.log);

  this.server = http.createServer();
  this.domain = domain.create();
  this.inClient = inClient;
  this.outClient = outClient;
  this.currReqId = 0;
  this.inFlight = {};
};
Bridge.prototype = new (function () {

  var _expectBody = function (req) {
    var contentType = req.headers['content-type'];
    // Buffer the body if needed
    return ((req.method == 'POST' || req.method == 'PUT') &&
        (contentType &&
          (contentType.indexOf('form-urlencoded') > -1 ||
           contentType.indexOf('application/json') > -1)));
  };

  this.start = function () {
    var server = this.server;
    var client = this.inClient;

    server.addListener('request', this.acceptRequest.bind(this));
    server.listen(9001, '127.0.0.1');

    client.subscribe(REDIS_CHANNEL_IN);
    client.on('message', this.handleInMessage.bind(this));

    console.log('Starting proxy bridge to Redis');
  };

  this.acceptRequest = function (req, resp) {
    var dmn = this.domain;
    var handle = this.handleRequest.bind(this);
    var body = '';

    dmn.on('error', function (err) {
      console.log('Bad request', err.message);
    });
    dmn.add(req);
    dmn.add(resp);

    this.currReqId++;

    // Buffer the body if needed
    if (_expectBody(req)) {
      // FIXME: Assumes the entire request body is in the buffer,
      // not streaming request
      req.addListener('readable', function (data) {
        var chunk;
        while ((chunk = req.read())) {
          body += chunk;
        }
      });

      req.addListener('end', function () {
        req.body = body;
        handle(req, resp);
      });

    }
    else {
      handle(req, resp);
    }
  };

  this.handleRequest = function  (req, resp) {
    var id = this.currReqId;
    var message = {
      reqId: id,
      method: req.method,
      contentType: req.headers['content-type'],
      url: req.url,
      body: req.body || null,
      qs: req.url.split('?')[1] || null
    }
    this.inFlight['req' + id] = {
      req: req,
      resp: resp
    };
    //this.outClient.publish(REDIS_CHANNEL_IN, 'Hello World\n');
    this.outClient.publish(REDIS_CHANNEL_OUT, JSON.stringify(message));
  };

  this.handleInMessage = function (channel, message) {
    if (channel == REDIS_CHANNEL_IN) {
      var key = 'req' + this.currReqId;
      var current = this.inFlight[key];
      delete this.inFlight[key];
      resp = current.resp;
      resp.writeHead(200, {'Content-Type': 'text/plain'});
      resp.end(message);
    }
  };

  this.stop = function () {
    this.server.close();
    this.inClient.end();
    this.outClient.end();
  };
})();

exports.Bridge = Bridge;


