#!/usr/bin/env python3
"""Measure a packaged executable in a disposable Chest test profile.

No real account/config is read. Each sample terminates only its own subprocess.
Results include process creation/dynamic loading, but not Finder/LaunchServices.
"""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--executable', required=True, type=Path)
parser.add_argument('--instances', type=int, default=0)
parser.add_argument('--samples', type=int, default=3)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
if not 0 <= args.instances <= 1000 or not 1 <= args.samples <= 30:
    parser.error('Use 0–1000 instances and 1–30 samples')
executable = args.executable.resolve(strict=True)
profile = Path(tempfile.mkdtemp(prefix='chest-native-startup-')).resolve()
config = dict(instances=[dict(id=str(uuid.uuid4()), name=f'World {n:04}', version='1.21.4', loader='vanilla', loader_version='', artwork='grass', memory_mb=4096, java_path='', installed=False) for n in range(args.instances)], accounts=[], active_account=None, client_id='', java_path='', memory_mb=4096)
# Initialize a valid profile marker before supplying synthetic config data.
# The app rejects unmarked nonempty directories, so use the same Rust-created
# marker by first launching with the empty directory.
env = {**os.environ, 'CHEST_TEST_PROFILE': str(profile), 'CHEST_STARTUP_TRACE': '1'}

def launch():
    events = queue.Queue()
    started = time.perf_counter()
    process = subprocess.Popen([str(executable)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, bufsize=1)
    def read():
        for line in process.stderr:
            events.put((time.perf_counter(), line.rstrip()))
        events.put((time.perf_counter(), None))
    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    stages, diagnostics = [], []
    try:
        deadline = started + 30
        while True:
            when, line = events.get(timeout=max(.01, deadline - time.perf_counter()))
            if line is None:
                raise RuntimeError(f'App exited before readiness: {diagnostics[-10:]}')
            if line.startswith('CHEST_STARTUP '):
                stage = json.loads(line[len('CHEST_STARTUP '):])
                stages.append(stage)
                if stage['stage'] == 'library-rendered':
                    return dict(processToLibraryMs=(when-started)*1000, stages=stages)
            else:
                diagnostics.append(line)
            if time.perf_counter() >= deadline:
                raise TimeoutError(f'No library-ready trace: {diagnostics[-10:]}')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        reader.join(timeout=2)
        process.stderr.close()

if args.instances:
    launch()  # Creates isolated WebKit/profile identity; not a populated sample.
    (profile/'config.json').write_text(json.dumps(config))
samples = [launch() for _ in range(args.samples)]
result = dict(executable=str(executable), profile=str(profile), instances=args.instances, samples=samples,
              medianProcessToLibraryMs=sorted(sample['processToLibraryMs'] for sample in samples)[len(samples)//2],
              boundary='Parent Popen to native receipt of library-rendered IPC after two animation frames; no Finder/LaunchServices; test-profile isolation enabled')
if args.output:
    args.output.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
