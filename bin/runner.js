#!/usr/bin/env node

var spawn = require('child_process').spawn;
var path = require('path');
var args = process.argv.slice(2);
var Bridge = require('../lib/proxy_bridge').Bridge;
var bridge = new Bridge();
var proc;

args.unshift(path.join(process.cwd(), './node_modules/.bin/testem'));

bridge.start();

proc = spawn(process.execPath, args, { stdio: 'inherit' });

// Kill bridge, forward child proc exit signal to parent
proc.on('exit', function (code, signal) {
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
  // Try to kill child proc gracefully
  proc.kill('SIGINT');
  // Fall back to kill -9 if that fails
  proc.kill('SIGTERM');
});
