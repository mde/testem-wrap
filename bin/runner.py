#!/usr/bin/env python

import os
import subprocess
import redis
import sys

runner_path = os.path.join(os.path.dirname(__file__),'runner.js')
p = subprocess.Popen(('node', runner_path, 'ci'), stdin=None,
        stderr=sys.stderr, stdout=sys.stdout)

