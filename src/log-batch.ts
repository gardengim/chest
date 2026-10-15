// Bound pending IPC strings as well as displayed/native log history.
export function createLogBatch(flush:(entries:Map<string,string[]>)=>void){
  const pending=new Map<string,{lines:string[];bytes:number;omitted:boolean}>();
  const limit=16*1024*1024;
  let bytes=0;
  let timer:ReturnType<typeof setTimeout>|undefined;
  function deliver(){
    timer=undefined;
    const entries=new Map([...pending].map(([id,entry])=>[id,entry.omitted?['Earlier logs omitted.',...entry.lines.slice(-1999)]:entry.lines]));
    pending.clear();bytes=0;
    flush(entries);
  }
  return {
    push({id,line}:{id:string;line:string}){
      const entry=pending.get(id) || {lines:[],bytes:0,omitted:false};
      entry.lines.push(line);entry.bytes+=line.length*2;bytes+=line.length*2;
      if(entry.lines.length>2000){const removed=entry.lines.shift()!;entry.bytes-=removed.length*2;bytes-=removed.length*2;entry.omitted=true;}
      pending.delete(id);
      pending.set(id,entry);
      while(pending.size>1000){
        const [oldest,buffer]=pending.entries().next().value!;
        bytes-=buffer.bytes;pending.delete(oldest);entry.omitted=true;
      }
      while(bytes>limit){
        const [oldest,buffer]=pending.entries().next().value!;
        bytes-=buffer.bytes;
        pending.delete(oldest);
        // Retain an explicit omission marker, without retaining dropped strings.
        pending.set(oldest,{lines:[],bytes:0,omitted:true});
      }
      timer ??= setTimeout(deliver,50);
    },
    dispose(){clearTimeout(timer);timer=undefined;pending.clear();bytes=0;},
  };
}
