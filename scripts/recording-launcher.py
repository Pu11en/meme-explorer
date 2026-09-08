#!/usr/bin/env python3
"""Run one installed recording job and remove only its own LaunchAgent afterward."""
import json
import os
from pathlib import Path
import subprocess
import sys

job_path, node, cli, label, plist_path = sys.argv[1:]
job = json.loads(Path(job_path).read_text())
try:
    result = subprocess.run(['/usr/bin/caffeinate', '-i', node, cli, job_path], check=False)
    code = result.returncode
finally:
    # The JSON job has an absolute date and an exclusive attempt marker as a second guard.
    Path(plist_path).unlink(missing_ok=True)
    sys.stdout.flush()
    sys.stderr.flush()
    subprocess.Popen(['/bin/launchctl', 'bootout', f'gui/{os.getuid()}/{label}'],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
sys.exit(code)
