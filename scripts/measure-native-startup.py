#!/usr/bin/env python3
"""Measure a packaged executable in a disposable Chest test profile.

No real account/config is read. Each sample terminates only its own subprocess.
Results include process creation/dynamic loading, but not Finder/LaunchServices.
On macOS use Chest.app/Contents/MacOS/chest so AppKit has its bundle context.
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
import hashlib
import platform
import shutil
import statistics
import struct
import zlib

def ignore_already_removed(_function, _path, error):
    # WebView may remove its own lockfiles during profile teardown. Ignore only
    # an already-removed entry; permissions and other cleanup failures still fail.
    if not isinstance(error[1], FileNotFoundError):
        raise error[1]

def remove_owned_profile(path):
    # Windows WebView shutdown can briefly outlive its host. Wait only for
    # sharing/directory teardown races; do not hide access-denied or other errors.
    deadline = time.monotonic() + 10
    while True:
        try:
            shutil.rmtree(path, onerror=ignore_already_removed)
            return
        except OSError as error:
            if platform.system() != 'Windows' or getattr(error, 'winerror', None) not in (32, 145) or time.monotonic() >= deadline:
                raise
            time.sleep(.1)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--executable', required=True, type=Path)
parser.add_argument('--instances', type=int, default=0)
parser.add_argument('--icons', action='store_true', help='Add a valid 256x128 PNG padded to 1 MiB per synthetic instance')
parser.add_argument('--samples', type=int, default=3)
parser.add_argument('--output', type=Path)
parser.add_argument('--idle-seconds', type=int, default=0)
parser.add_argument('--keep-profile', action='store_true')
args = parser.parse_args()
if not 0 <= args.instances <= 1000 or not 1 <= args.samples <= 30 or not 0 <= args.idle_seconds <= 3600:
    parser.error('Use 0–1000 instances and 1–30 samples')
if args.icons and not args.instances:
    parser.error('--icons requires at least one synthetic instance')
executable = args.executable.resolve(strict=True)
profile = Path(tempfile.mkdtemp(prefix='chest-native-startup-')).resolve()
config = dict(instances=[dict(id=str(uuid.uuid4()), name=f'World {n:04}', version='1.21.4', loader='vanilla', loader_version='', artwork='grass', memory_mb=4096, java_path='', installed=False) for n in range(args.instances)], accounts=[], active_account=None, client_id='', java_path='', memory_mb=4096)
# Initialize a valid profile marker before supplying synthetic config data.
# The app rejects unmarked nonempty directories, so use the same Rust-created
# marker by first launching with the empty directory.
env = {**os.environ, 'CHEST_TEST_PROFILE': str(profile), 'CHEST_STARTUP_TRACE': '1'}

def launch(measure_idle=True):
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
            try:
                when, line = events.get(timeout=max(.01, deadline - time.perf_counter()))
            except queue.Empty as error:
                raise TimeoutError(f'No library-ready trace; stages={stages}, diagnostics={diagnostics[-10:]}') from error
            if line is None:
                raise RuntimeError(f'App exited before readiness: {diagnostics[-10:]}')
            if line.startswith('CHEST_STARTUP '):
                stage = json.loads(line[len('CHEST_STARTUP '):])
                stages.append(stage)
                if stage['stage'] == 'library-rendered':
                    if process.poll() is not None:
                        raise RuntimeError('App exited at readiness')
                    result = dict(processToLibraryMs=(when-started)*1000, stages=stages)
                    if args.idle_seconds and measure_idle:
                        time.sleep(5)  # Exclude immediate post-readiness initialization.
                        if platform.system() == 'Windows':
                            raise RuntimeError('Idle process sampling currently requires macOS/Linux; startup sampling remains portable')
                        def sample():
                            if process.poll() is not None:
                                raise RuntimeError('App exited during sampling')
                            fields = subprocess.check_output(['ps','-p',str(process.pid),'-o','rss=,time='],text=True).split()
                            cpu = fields[1]
                            days = 0
                            if '-' in cpu:
                                day, cpu = cpu.split('-',1); days = int(day)
                            pieces = [float(piece) for piece in cpu.split(':')]
                            seconds = sum(value*60**index for index,value in enumerate(reversed(pieces))) + days*86400
                            rss = int(fields[0])
                            if rss <= 0: raise RuntimeError('Invalid process RSS sample')
                            return dict(rssKiB=rss,cpuSeconds=seconds)
                        readings = [sample()]
                        idle_start = time.perf_counter()
                        for _ in range(args.idle_seconds):
                            time.sleep(1);readings.append(sample())
                        duration = time.perf_counter()-idle_start
                        result['idle'] = dict(seconds=duration,settleSeconds=5,meanRssMiB=statistics.mean(row['rssKiB'] for row in readings)/1024,
                            peakRssMiB=max(row['rssKiB'] for row in readings)/1024,
                            cpuPercent=100*(readings[-1]['cpuSeconds']-readings[0]['cpuSeconds'])/duration,
                            processTreeComplete=False,boundary='Owned main process only; excludes WebView/GPU/network subprocesses and game JVM',samples=readings)
                    return result
            else:
                diagnostics.append(line)
            if time.perf_counter() >= deadline:
                raise TimeoutError(f'No library-ready trace; stages={stages}, diagnostics={diagnostics[-10:]}')
    finally:
        if process.poll() is None: process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        reader.join(timeout=2)
        process.stderr.close()

try:
    if args.instances:
        launch(measure_idle=False)  # Rust initializes the empty isolated profile before adding fixtures.
        (profile/'config.json').write_text(json.dumps(config))
        if args.icons:
            def chunk(kind, data):
                return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
            png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 256, 128, 8, 6, 0, 0, 0))
                   + chunk(b'IDAT', zlib.compress((b'\x00' + b'\x40\x80\x40\xff' * 256) * 128)) + chunk(b'IEND', b''))
            png += b'\x00' * (1024 * 1024 - len(png))
            for instance in config['instances']:
                game = profile/'instances'/instance['id']/'game'
                game.mkdir(parents=True, exist_ok=True)
                (game/'icon.png').write_bytes(png)
    samples = [launch() for _ in range(args.samples)]
    result = dict(executable=str(executable), executableSha256=hashlib.sha256(executable.read_bytes()).hexdigest(),
        platform=platform.platform(), profile=str(profile), profileRetained=args.keep_profile, instances=args.instances, iconFixture=args.icons,
        samples=samples,medianProcessToLibraryMs=statistics.median(sample['processToLibraryMs'] for sample in samples),
        boundary='Parent Popen to library-rendered IPC after two frames; no Finder/LaunchServices; isolated profile; optional idle sampling includes main process only')
    if args.output:
        if args.output.resolve().is_relative_to(profile): raise ValueError('Output must be outside the test profile')
        args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))
finally:
    if not args.keep_profile:
        # macOS stores the isolated WebView beside normal WebKit data, rather
        # than inside Core's disposable directory. Remove only our fresh UUID.
        marker = profile / '.chest-test-profile'
        if platform.system() == 'Darwin' and marker.exists():
            identifier = str(uuid.UUID(marker.read_text().strip()))
            stores = Path.home() / 'Library/WebKit/app.chest.launcher/WebsiteDataStore'
            owned = stores / identifier
            if owned.exists():
                if owned.is_symlink() or owned.resolve().parent != stores.resolve():
                    raise RuntimeError('Refusing to clean an unconfined WebView profile')
                shutil.rmtree(owned)
        remove_owned_profile(profile)
