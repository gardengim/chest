export interface MessageAction {
  label:string;
  onclick:()=>unknown;
  disabled?:boolean;
  persistent?:boolean;
  dismiss?:boolean;
}
export interface MessageInput {
  text:string;
  title?:string;
  instanceId?:string;
  tone:'error'|'success'|'warning';
  actions?:MessageAction[];
  htmlId?:string;
  ondismiss?:()=>unknown;
}
export interface MessageEntry extends MessageInput {id:symbol;}
export const messages=$state<{items:MessageEntry[]}>({items:[]});

export function updateMessage(id:symbol,input:MessageInput,create:boolean){
  const text=input.text.trim(),title=input.title?.trim();
  if(!text && !title)return id;
  const entry={...input,text,title,id,actions:[...(input.actions || [])]};
  const index=messages.items.findIndex(item=>item.id===id);
  if(index>=0)messages.items[index]=entry;
  else if(create){
    const duplicate=messages.items.find(item=>item.text===text && item.title===title && item.tone===input.tone && item.instanceId===input.instanceId);
    if(duplicate){
      Object.assign(duplicate,{...entry,id:duplicate.id});
      return duplicate.id;
    }
    messages.items=[...messages.items.slice(-49),entry];
  }
  return id;
}
export async function dismissMessage(id:symbol,acknowledge=true){
  const message=messages.items.find(item=>item.id===id);
  messages.items=messages.items.filter(item=>item.id!==id);
  if(acknowledge && message?.ondismiss){
    try{await message.ondismiss();}
    catch(error){updateMessage(Symbol(),{text:String(error),tone:'error'},true);}
  }
}
export function detachMessage(id:symbol){
  const message=messages.items.find(item=>item.id===id);
  if(message){
    message.actions=message.actions?.filter(action=>action.persistent);
    delete message.htmlId;
  }
}
