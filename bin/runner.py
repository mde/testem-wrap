#!/usr/bin/env python

import os
import subprocess
import json
import redis
import sys

REDIS_CHANNEL_IN = 'testem-wrap-proxy-bridge-js-python'
REDIS_CHANNEL_OUT = 'testem-wrap-proxy-bridge-python-js'

runner_path = os.path.join(os.path.dirname(__file__),'runner.js')
r = redis.StrictRedis()
pub = r.pubsub()

def handle_message_in(message):
    print '>>>>>>>>>>>>>>>>>>> GOT MESSAGE >>>>>>>>>>>>>>>>>>'
    data = json.loads(message['data'])
    #print data
    r.publish(REDIS_CHANNEL_OUT, 'Hello World\n')

pub.subscribe(**{REDIS_CHANNEL_IN: handle_message_in})
thread = pub.run_in_thread(sleep_time=0.001)

#p = subprocess.Popen(('node', runner_path, 'ci'), stdin=None,
#        stderr=sys.stderr, stdout=sys.stdout)

sub = subprocess.Popen(['node', runner_path, 'ci'], stderr=subprocess.STDOUT)
print sub.communicate()[0]

thread.stop()

