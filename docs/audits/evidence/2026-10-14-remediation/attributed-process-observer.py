import json,subprocess,time,statistics,tempfile
from pathlib import Path
pids=[23115,23239,23243,23252]
roles=['main','GPU (inferred from new-process and owner lifetime)','WebContent (isolated profile UUID verified)','Networking (isolated profile UUID verified)']
output=Path('/private/tmp/chest-frozen-attributed-group.json')
readings=[];footprints=[];errors=[]
import re
profile_ids=[]
for pid in [pids[0],pids[2],pids[3]]:
 paths=subprocess.check_output(['lsof','-p',str(pid),'-Fn'],text=True)
 identifiers=set(re.findall(r'WebsiteDataStore/([0-9a-f-]{36})/',paths))
 assert len(identifiers)==1,(pid,identifiers)
 profile_ids.append(identifiers.pop())
assert len(set(profile_ids))==1
start=time.monotonic()
def process_rows():
 text=subprocess.run(['ps','-p',','.join(map(str,pids)),'-o','pid=,rss=,time=,comm='],capture_output=True,text=True).stdout
 rows={}
 for line in text.splitlines():
  pid,rss,cpu,command=line.split(None,3)
  if int(pid)==pids[0]:assert command.endswith('/Chest.app/Contents/MacOS/chest')
  else:assert '/WebKit.framework/' in command
  days=0
  if '-' in cpu:day,cpu=cpu.split('-',1);days=int(day)
  seconds=sum(float(v)*60**i for i,v in enumerate(reversed(cpu.split(':'))))+days*86400
  rows[int(pid)]={'rssKiB':int(rss),'cpuSeconds':seconds}
 return rows
while True:
 rows=process_rows()
 if pids[0] not in rows:break
 readings.append({'seconds':time.monotonic()-start,'processes':rows})
 if len(readings)%2==1:
  with tempfile.TemporaryDirectory(prefix='chest-footprint-') as directory:
   path=Path(directory)/'sample.json'
   result=subprocess.run(['footprint',*[arg for pid in rows for arg in ['-p',str(pid)]],'--noCategories','--json',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
   if result.returncode or not path.exists():errors.append(result.stderr[:200])
   else:
    data=json.loads(path.read_text());footprints.append({'seconds':time.monotonic()-start,'totalBytes':data['total footprint'],'processes':[{k:v for k,v in p.items() if k in ['pid','name','footprint']} for p in data['processes']]})
 time.sleep(5)
remaining=process_rows()
for _ in range(5):
 if not remaining:break
 time.sleep(2);remaining=process_rows()
last={}
for reading in readings:
 for pid,values in reading['processes'].items():last[pid]=values
first=readings[0]['processes'];duration=readings[-1]['seconds']-readings[0]['seconds']
rss=[sum(p['rssKiB'] for p in row['processes'].values())/1024 for row in readings]
result={'sourceCommit':'2326cb2cfb9b1cd6fd08ec9570f85c7e22ef99df','isolatedWebViewUuid':profile_ids[0],'boundary':'Owned main process and isolated-profile WebContent/Networking; GPU attribution inferred from exclusive new-process timing and verified owner exit. Excludes transient OS helpers, observer overhead, other apps and JVM. RSS includes shared mappings and excludes compressed memory; footprint is separately collected. This observer began after readiness and therefore is shorter than the parallel one-hour main-process run.','pids':dict(zip(pids,roles)),'seconds':duration,'meanRssMiB':statistics.mean(rss),'peakRssMiB':max(rss),'cpuPercentOneCore':100*sum(last[pid]['cpuSeconds']-values['cpuSeconds'] for pid,values in first.items())/duration,'meanPhysicalFootprintMiB':statistics.mean(row['totalBytes'] for row in footprints)/1024/1024 if footprints else None,'peakPhysicalFootprintMiB':max((row['totalBytes'] for row in footprints),default=0)/1024/1024,'ownerExitConfirmed':not remaining,'processTreeComplete':False,'errors':errors,'readings':readings,'footprints':footprints}
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['readings','footprints']},indent=2))
