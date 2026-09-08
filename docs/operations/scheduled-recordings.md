# Scheduled Pump.fun recordings

Drew authorized two one-time one-hour recordings in Discord thread 1546835989354389515: September 8, 2026, 08:00–09:00 and 13:00–14:00 America/Chicago (UTC−05:00). These are two independent batches. Analysis/dashboard work remains separate.

## Installed schedule

The macOS LaunchAgents are `com.meme-explorer.recording.20260908.0800` and `com.meme-explorer.recording.20260908.1300`. Each uses a calendar trigger and a wrapper that removes its own plist and unloads its own job after the attempt. No other services are restarted. Keep the Mac powered on, logged in, and connected to the internet. Idle system sleep is currently disabled; the wrapper also holds a caffeinate assertion while recording.

The frozen runtime, job descriptions, and `schedule.json` live at:

`/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908`

Each job records under its own `batches/batch-20260908-0800-central` or `batches/batch-20260908-1300-central` directory. Inside each directory, `batch.json` uses the existing collection-batch schema; `job-status.json` carries progress, counts, storage, stop reason, and the final manifest. This installation is independent of disposable Git worktrees. It contains compiled internal modules and does not need the DSH Host or node_modules.

## Behavior and limits

- One attempt per job: an exclusive `attempt.json` prevents duplicate/restarted captures. A failure requires inspection before any separately authorized retry.
- A start more than 60 seconds late is marked missed; there is no automatic late catch-up. No recording starts before its scheduled date/time.
- A launch within the 60-second startup grace records for 60 minutes from its actual run start. It can finish up to 60 seconds after the nominal scheduled end. Disk and interruption guards can still stop it early.
- Free disk is checked before starting and about every five seconds. A run stops early below 15 GiB free or at 12 GiB of batch files. The limits are sampled, so small overshoot is possible. Existing recordings are never deleted.
- The existing Pump.fun-origin eligibility checks and raw/normalized retention are preserved. Metadata and pair enrichment use the existing recorder enrichment path. No three-hour follow-up or new outcome data plane is added.
- The standalone runner accepts exactly one-hour jobs. The storage contract now accepts 60-minute runs alongside legacy 5/10-minute runs; existing session commands still accept only 5/10.
- Launches near the recording end can have incomplete first-minute data. Three-hour outcomes will generally be censored or unavailable.

## Inspection

```sh
launchctl print gui/501/com.meme-explorer.recording.20260908.0800
launchctl print gui/501/com.meme-explorer.recording.20260908.1300
```

Once a job finishes it is unloaded; inspect its persistent job status and stdout/stderr logs instead. An abrupt crash/power loss may leave a nonterminal status; compare logs and the recorded manifest before recovery.

## Validation on September 8

- TypeScript build and no-emit type check passed.
- `node --test test/*.test.mjs`: 41 tests passed, including seven new tests covering hour validation, storage limits, duplicate/missed starts, successful recording/finalization, and connection failure.
- A 15-second live connection check recorded six Pump.fun launches, 49 raw records, and 257 normalized records, then stopped and finalized cleanly. That small preflight corpus is separate from both scheduled batches.
- Both installed job files passed CLI validation; both plists passed `plutil -lint` and both loaded successfully through `launchctl bootstrap` and `launchctl print`.

## Installer

Build the project, then run `scripts/install-recording-schedule.py` with an explicit date, hours, timezone, a new absolute destination, and an absolute Node 22+ executable. It copies the compiled runtime, validates jobs, and registers LaunchAgents. Do not rerun the September 8 installation: both jobs are already registered. The receipt is written after each successfully registered job so a partial install can be inspected without blindly retrying.


## September 8 recovery

Drew requested two full hours again in thread 1546847282698129538 after the 08:00 job failed at 08:24. The morning partial dataset is preserved. The disk-size scan now tolerates ENOENT when an atomic-write temporary file disappears between directory listing and stat; other errors still propagate. A regression test reproduces the disappearing entry and checks that permission errors remain failures. A delayed-start test verifies a full sixty-minute run.

The replacement hour is scheduled for 10:00 Central, with the existing 13:00 hour retained and its frozen runner patched before launch. Both are planned recordings, not proof of two hours already captured. Check each final job-status and manifest after completion. The recovery installation receipt records exact paths and runtime hashes.
