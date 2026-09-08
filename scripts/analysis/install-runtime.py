#!/usr/bin/env python3
"""Install the built, dependency-free analysis entry points outside Git worktrees."""
import argparse,hashlib,json,pathlib,shutil,uuid
p=argparse.ArgumentParser();p.add_argument('--destination',required=True);a=p.parse_args()
repo=pathlib.Path(__file__).resolve().parents[2];lib=repo/'lib'
if not (lib/'analysis/filters/run-cli.js').is_file():raise SystemExit('Build the project before installing analysis')
files={str(f.relative_to(lib)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(lib.rglob('*.js'))}
version=hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()[:16]
base=pathlib.Path(a.destination).resolve();base.mkdir(parents=True,exist_ok=True)
if shutil.disk_usage(base).free<15*1024**3:raise SystemExit('Preserve the recorder free-space reserve')
installed=base/version
if not installed.exists():
 staging=base/('.pending-'+uuid.uuid4().hex);staging.mkdir(mode=0o700)
 for relative in files:
  dest=staging/'lib'/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(lib/relative,dest)
 (staging/'package.json').write_text('{"type":"module"}\n')
 (staging/'runtime-manifest.json').write_text(json.dumps({'runtime_id':version,'source_worktree':str(repo),'files':files},indent=2)+'\n')
 staging.rename(installed)
for relative,expected in files.items():
 if hashlib.sha256((installed/'lib'/relative).read_bytes()).hexdigest()!=expected:raise SystemExit('Installed runtime checksum mismatch: '+relative)
print(json.dumps({'runtime_id':version,'runtime_root':str(installed),'entry':str(installed/'lib/analysis/filters/run-cli.js'),'files_verified':len(files)}))
