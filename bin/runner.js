#!/usr/bin/env node

var spawn = require('child_process').spawn;
var path = require('path');
var args = [];
var projectPath = process.argv[2];
var Bridge = require('../lib/proxy_bridge').Bridge;
var bridge = new Bridge();
var proc;

process.chdir(path.join(process.cwd(), projectPath));

args.unshift(path.join(process.cwd(), './node_modules/.bin/testem'));
args.push('ci');

bridge.start();

console.log('Running Testem in ' + projectPath);

proc = spawn(process.execPath, args, { stdio: [process.stdin, 'pipe', process.stderr]});

proc.stdout.on('data', function (d) {
	process.stdout.write(d.toString());
});

// Kill bridge, forward child proc exit signal to parent
proc.on('exit', function (code, signal) {
 	bridge.sendCmd({command: 'done'});
  	bridge.stop();
  process.on('exit', function () {
    if (signal) {
      process.kill(process.pid, signal);
    }
    else {
      process.exit(code);
    }
  });
});

// Terminate child proc
process.on('SIGINT', function () {
  console.log('Terminating Mocha JS runner...');
  // Try to kill child proc gracefully
  proc.kill('SIGINT');
  // Fall back to kill -9 if that fails
  proc.kill('SIGTERM');
});

