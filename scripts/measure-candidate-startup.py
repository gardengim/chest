#!/usr/bin/env python3
"""Verify and unpack an unsigned CI installer, then measure isolated native startup."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundle', required=True, type=Path)
parser.add_argument('--commit', required=True)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
bundle = args.bundle.resolve(strict=True)
inventory = json.loads((bundle / 'candidate-inventory.json').read_text())
if inventory['commit'] != args.commit:
    raise RuntimeError('Candidate source does not match the requested commit')
for item in inventory['files']:
    path = bundle / item['path']
    if not path.resolve().is_relative_to(bundle):
        raise RuntimeError('Candidate inventory contains an unconfined path')
    if path.is_file():
        with path.open('rb') as source:
            digest = hashlib.file_digest(source, 'sha256').hexdigest()
        if path.stat().st_size != item['bytes'] or digest != item['sha256']:
            raise RuntimeError(f'Candidate integrity failure: {item["path"]}')
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='chest-candidate-startup-') as directory:
    temporary = Path(directory)
    mounted = False
    try:
        if platform.system() == 'Darwin':
            image = next(bundle.rglob('*.dmg'))
            mount = temporary / 'volume'
            mount.mkdir()
            subprocess.run(['hdiutil', 'attach', '-readonly', '-nobrowse', '-noautoopen',
                            '-mountpoint', str(mount), str(image)], check=True)
            mounted = True
            executable = mount / 'Chest.app/Contents/MacOS/chest'
        elif platform.system() == 'Windows':
            installer = next(bundle.rglob('*.msi'))
            extracted = temporary / 'extracted'
            subprocess.run(['msiexec.exe', '/a', str(installer),
                            f'TARGETDIR={extracted}', '/qn'], check=True)
            matches = [path for path in extracted.rglob('*.exe') if path.name.lower() == 'chest.exe']
            if len(matches) != 1:
                raise RuntimeError('Expected exactly one extracted Chest executable')
            executable = matches[0]
        else:
            package = next(bundle.rglob('*.deb'))
            extracted = temporary / 'extracted'
            subprocess.run(['dpkg-deb', '-x', str(package), str(extracted)], check=True)
            executable = extracted / 'usr/bin/chest'
            if not executable.is_file():
                executable = extracted / 'usr/bin/Chest'
        for count in [0, 1000]:
            command = [sys.executable, 'scripts/measure-native-startup.py', '--executable', str(executable),
                       '--instances', str(count), '--samples', '3',
                       '--output', str(args.output / f'native-{count}.json')]
            if platform.system() == 'Linux':
                command = ['xvfb-run', '-a', 'dbus-run-session', '--', *command]
            subprocess.run(command, check=True)
        (args.output / 'identity.json').write_text(json.dumps({
            'candidateCommit': inventory['commit'], 'platform': platform.platform(),
            'architecture': platform.machine(), 'boundary': 'CI native startup only; no gameplay, credentials, signing acceptance or cold/warm classification',
        }, indent=2) + '\n')
    finally:
        if mounted:
            subprocess.run(['hdiutil', 'detach', str(mount)], check=True)
