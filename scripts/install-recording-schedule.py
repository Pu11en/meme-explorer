#!/usr/bin/env python3
"""Install two date-specific hourly captures using a frozen build outside Git worktrees."""
import argparse
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
from zoneinfo import ZoneInfo

parser = argparse.ArgumentParser()
parser.add_argument('--date', required=True)
parser.add_argument('--hours', type=int, nargs='+', required=True)
parser.add_argument('--timezone', default='America/Chicago')
parser.add_argument('--destination', required=True)
parser.add_argument('--node', required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
root = Path(args.destination).resolve()
node = str(Path(args.node).resolve())
zone = ZoneInfo(args.timezone)
now = datetime.now(zone)
starts = [datetime.fromisoformat(f'{args.date}T{hour:02}:00:00').replace(tzinfo=zone) for hour in args.hours]
if len(set(starts)) != len(starts) or any(start <= now for start in starts):
    raise SystemExit('Jobs must be distinct future starts')
if any(abs((a-b).total_seconds()) < 3600 for a in starts for b in starts if a != b):
    raise SystemExit('Jobs must not overlap')
if not root.is_absolute() or root.exists():
    raise SystemExit('Use a new absolute installation directory')
if not (repo/'lib/scheduled-recording-cli.js').is_file():
    raise SystemExit('Build the project first')
# Launchd calendar values use the Mac timezone. Refuse an ambiguous local schedule.
if datetime.now().astimezone().utcoffset() != now.utcoffset():
    raise SystemExit('Mac timezone differs from requested timezone')
root.mkdir(parents=True, mode=0o700)
shutil.copytree(repo/'lib', root/'lib')
(root/'package.json').write_text('{"type":"module"}\n')
shutil.copy2(repo/'scripts/recording-launcher.py', root/'recording-launcher.py')
launch_agents = Path.home()/'Library/LaunchAgents'
launch_agents.mkdir(parents=True, exist_ok=True)
jobs = []
for start in starts:
    batch_id = f'batch-{start:%Y%m%d}-{start:%H%M}-central'
    label = f'com.meme-explorer.recording.{start:%Y%m%d}.{start:%H%M}'
    job = {
        'schema': 'pump.scheduled-recording/1', 'batch_id': batch_id,
        'label': f'Pump.fun {start:%Y-%m-%d %H:%M}–{start+timedelta(hours=1):%H:%M} Central',
        'starts_at': start.isoformat(), 'ends_at': (start+timedelta(hours=1)).isoformat(),
        'data_root': str(root/'batches'/batch_id),
        'minimum_free_bytes': 15*1024**3, 'maximum_batch_bytes': 12*1024**3,
    }
    job_path = root/f'{batch_id}.json'
    job_path.write_text(json.dumps(job, indent=2)+'\n')
    os.chmod(job_path, 0o600)
    subprocess.run([node, str(root/'lib/scheduled-recording-cli.js'), str(job_path), '--check'], check=True, stdout=subprocess.DEVNULL)
    plist_path = launch_agents/f'{label}.plist'
    if plist_path.exists():
        raise SystemExit(f'Existing job must be inspected before replacing: {plist_path}')
    plist = {
        'Label': label,
        'ProgramArguments': [str(Path(os.sys.executable).resolve()), str(root/'recording-launcher.py'),
                             str(job_path), node, str(root/'lib/scheduled-recording-cli.js'), label, str(plist_path)],
        'WorkingDirectory': str(root),
        'StartCalendarInterval': {'Month': start.month, 'Day': start.day, 'Hour': start.hour, 'Minute': 0},
        'RunAtLoad': False, 'KeepAlive': False, 'ProcessType': 'Background',
        'StandardOutPath': str(root/f'{batch_id}.stdout.log'),
        'StandardErrorPath': str(root/f'{batch_id}.stderr.log'),
        'EnvironmentVariables': {'PATH': '/Users/drewp/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'TZ': args.timezone},
    }
    with plist_path.open('wb') as stream:
        plistlib.dump(plist, stream)
    os.chmod(plist_path, 0o600)
    subprocess.run(['/usr/bin/plutil', '-lint', str(plist_path)], check=True)
    subprocess.run(['/bin/launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist_path)], check=True)
    subprocess.run(['/bin/launchctl', 'print', f'gui/{os.getuid()}/{label}'], check=True, stdout=subprocess.DEVNULL)
    jobs.append({'launch_agent_label': label, 'job_path': str(job_path), 'plist_path': str(plist_path), **job})
    (root/'schedule.json').write_text(json.dumps({'jobs': jobs}, indent=2)+'\n')
print(json.dumps({'installed': jobs}, indent=2))
