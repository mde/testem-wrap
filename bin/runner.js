#!/usr/bin/env node

var log = require('npmlog')
var spawn = require('child_process').spawn;
var path = require('path');
var args = process.argv.slice(3);
var projectPath = process.argv[2];
var Bridge = require('../lib/proxy_bridge').Bridge;
var bridge = new Bridge();
var testemPath = '../node_modules/testem';
var program = require('commander')
var progOptions = program
var Config = require(path.join(testemPath, 'lib/config'));
var Api = require(path.join(testemPath, 'lib/api'));
var appMode = 'dev'
var proc;

process.chdir(path.join(process.cwd(), projectPath));

args.unshift('node');
args.unshift(path.join(process.cwd(), './node_modules/.bin/testem'));

bridge.start();

program
  .version(require(testemPath + '/package').version)
  .usage('[options]')
  .option('-f, --file [file]', 'config file - defaults to testem.json or testem.yml')
  .option('-p, --port [num]', 'server port - defaults to 7357', Number)
  .option('--host [hostname]', 'host name - defaults to localhost', String)
  .option('-l, --launch [list]', 'list of launchers to launch(comma separated)')
  .option('-s, --skip [list]', 'list of launchers to skip(comma separated)')
  .option('-d, --debug', 'output debug to debug log - testem.log')
  .option('-t, --test_page [page]', 'the html page to drive the tests')
  .option('-g, --growl', 'turn on growl notifications')


program
  .command('launchers')
  .description('Print the list of available launchers (browsers & process launchers)')
  .action(act(function(env){
    env.__proto__ = program
    progOptions = env
    appMode = 'launchers'
  }))

program
  .command('ci')
  .description('Continuous integration mode')
  .option('-T, --timeout [sec]', 'timeout a browser after [sec] seconds', null)
  .option('-P, --parallel [num]', 'number of browsers to run in parallel, defaults to 1', Number)
  .option('-b, --bail_on_uncaught_error', 'Bail on any uncaught errors')
  .option('-R, --reporter [reporter]', 'Test reporter to use [tap|dot|xunit]', 'tap')
  .action(act(function(env){
    env.__proto__ = program
    progOptions = env
    appMode = 'ci'
  }))

program
  .command('server')
  .description('Run just the server')
  .action(act(function(env){
    env.__proto__ = program
    progOptions = env
    appMode = 'server'
  }))


main()
function main(){
  program.parse(args)

  var config = new Config(appMode, progOptions)

  if (appMode === 'launchers'){
    config.read(function(){
      config.printLauncherInfo()
    })
  }
  else {
    var api = new Api();

	var writer = process.stdout.write;
	process.stdout.write = function () {
	  //writer.apply(process.stdout, arguments);
	};

    api.setup = function(mode, dependency, finalizer){
	  var self = this;
	  var App = require(path.join(testemPath, 'lib', dependency))
	  var config = this.config = new Config(mode, this.options)
	  this.configureLogging()
	  config.read(function() {
		self.app = new App(config, finalizer)
		self.app.start()
	    server = self.app.server;
	  	server.on('server-start', function () {
	      server.io.on('connection', function (socket) {
            socket.on('test-result', function (data) {
              writer.call(process.stdout, '{"result": ' + JSON.stringify(data) + '}\n');
			});
            socket.on('all-test-results', function (data) {
              bridge.sendCmd({command: 'done'});
              bridge.stop();
              writer.call(process.stdout, '{"results": ' + JSON.stringify(data) + '}\n');
			});
		  });
		});
	  })
	}

    if (appMode === 'ci'){
      api.startCI(progOptions)
    }else if (appMode === 'dev'){
      api.startDev(progOptions)
    }else if (appMode === 'server'){
      api.startServer(progOptions)
    }
  }
}

// this is to workaround the weird behavior in command where
// if you provide additional command line arguments that aren't
// options, it goes in as a string as the 1st arguments of the 
// "action" callback, we don't want this
function act(fun){
  return function(){
    var options = arguments[arguments.length - 1]
    fun(options)
  }
}

process.on('SIGINT', function () {
  bridge.sendCmd({command: 'done'});
  bridge.stop();
});

