// Bound live WebView strings independently of the native log buffer.
export function trimLogs(logs:Record<string,string[]>,updated:string[]){
  const limit=16*1024*1024;
  let bytes=Object.values(logs).reduce((sum,lines)=>sum+lines.reduce((n,line)=>n+line.length*2,0),0);
  if(bytes<=limit)return;
  const keys=Object.keys(logs).sort((a,b)=>Number(updated.includes(a))-Number(updated.includes(b)));
  for(const id of keys){
    const lines=logs[id];
    let removed=0;
    while(bytes>limit && removed<lines.length){bytes-=lines[removed++].length*2;}
    if(removed)logs[id]=['Earlier logs omitted.',...lines.slice(removed)];
    if(bytes<=limit)break;
  }
}
