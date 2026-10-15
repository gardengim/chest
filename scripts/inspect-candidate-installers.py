"""Read-only macOS inspection of previously hash-verified candidate installers."""
from pathlib import Path
import argparse
import subprocess,json,io,tarfile,plistlib,tempfile
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundle',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args()
root=args.bundle.resolve(strict=True)
rows=[]
for image in root.rglob('*.dmg'):
 verify=subprocess.run(['hdiutil','verify',str(image)],capture_output=True,text=True,check=True)
 with tempfile.TemporaryDirectory(prefix='chest-candidate-mount-') as directory:
  mount=Path(directory)/'volume';mount.mkdir()
  try:
   subprocess.run(['hdiutil','attach','-readonly','-nobrowse','-noautoopen','-mountpoint',str(mount),str(image)],capture_output=True,text=True,check=True)
   app=mount/'Chest.app';info=plistlib.loads((app/'Contents/Info.plist').read_bytes())
   exe=app/'Contents/MacOS'/info['CFBundleExecutable']
   arch=subprocess.check_output(['lipo','-archs',str(exe)],text=True).strip()
   expected='arm64' if 'aarch64' in image.name else 'x86_64'
   assert arch==expected,(image,arch)
   assert info['CFBundleShortVersionString']=='0.1.0'
   signing=subprocess.run(['codesign','-dv','--verbose=2',str(app)],capture_output=True,text=True)
   fields=[line for line in signing.stderr.splitlines() if line.startswith(('Signature=','TeamIdentifier=','Sealed Resources='))]
   rows.append({'installer':image.name,'integrity':'hdiutil verify passed','payloadArchitecture':arch,'version':info['CFBundleShortVersionString'],'logicalAppBytes':sum(p.stat().st_size for p in app.rglob('*') if p.is_file()),'signing':fields})
  finally:
   subprocess.run(['hdiutil','detach',str(mount)],capture_output=True,text=True,check=True)
for package in root.rglob('*.deb'):
 members=subprocess.check_output(['ar','t',str(package)],text=True).splitlines()
 control=next(name for name in members if name.startswith('control.tar'))
 data=subprocess.check_output(['ar','p',str(package),control])
 with tarfile.open(fileobj=io.BytesIO(data)) as archive:
  member=next(item for item in archive if item.name in ['control','./control'])
  assert member.size<1024*1024
  text=archive.extractfile(member).read().decode()
  fields=dict(line.split(': ',1) for line in text.splitlines() if ': ' in line and not line.startswith(' '))
  assert fields['Architecture']=='amd64' and fields['Version']=='0.1.0'
  rows.append({'installer':package.name,'architecture':fields['Architecture'],'version':fields['Version'],'depends':fields.get('Depends')})
for image in root.rglob('*.AppImage'):
 with image.open('rb') as source:header=source.read(64)
 assert header[:4]==b'\x7fELF' and header[4]==2 and int.from_bytes(header[18:20],'little')==62
 rows.append({'installer':image.name,'payloadArchitecture':'ELF64 x86_64'})
args.output.write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
