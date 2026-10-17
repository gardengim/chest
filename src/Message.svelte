<script lang="ts">
  import {onDestroy,untrack} from 'svelte';
  import {updateMessage,detachMessage,type MessageAction} from './messages.svelte';
  let {text,title='',tone='error',actions=[],id:htmlId,source='',instanceId}: {
    text:string;title?:string;tone?:'error'|'success'|'warning';actions?:MessageAction[];id?:string;source?:string;instanceId?:string;
  }=$props();
  let id=Symbol();
  let previous='';
  $effect(()=>{
    const signature=JSON.stringify([text,title,tone,source,instanceId]);
    const input={text,title,tone,actions,htmlId,instanceId};
    untrack(()=>{
      if(signature!==previous){detachMessage(id);id=Symbol();}
      id=updateMessage(id,input,signature!==previous);
    });
    previous=signature;
  });
  // Keep the message itself. Only callbacks tied to this page are detached.
  onDestroy(()=>detachMessage(id));
</script>
