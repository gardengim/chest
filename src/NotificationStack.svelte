<script lang="ts">
  import {messages,dismissMessage,type MessageEntry,type MessageAction,updateMessage} from './messages.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import InstanceIcon from './InstanceIcon.svelte';
  import CopyButton from './CopyButton.svelte';
  import {t} from './i18n';
  async function act(message:MessageEntry,action:MessageAction){
    if(action.dismiss!==false)void dismissMessage(message.id,false);
    try{await action.onclick();}
    catch(error){updateMessage(Symbol(),{text:String(error),tone:'error'},true);}
  }
  function measure(node:HTMLDivElement){
    let frame=0;
    const home=node.parentNode!;
    function place(){
      const dialogs=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
      const host=dialogs.at(-1) || home;
      if(node.parentNode!==host)host.appendChild(node);
    }
    // Messages remain interactive when a modal makes the rest of the app inert.
    const dialogs=new MutationObserver(place);
    dialogs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    place();
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        for(const child of Array.from(node.children)){
          const message=child as HTMLElement;
          message.style.setProperty('--message-height',`${message.getBoundingClientRect().height}px`);
        }
        // At either screen edge, overflow stays inside this container.
        if(!node.contains(document.activeElement))node.scrollTop=node.scrollHeight;
      });
    };
    const resize=new ResizeObserver(update);
    function observe(){resize.disconnect();resize.observe(node);for(const child of Array.from(node.children))resize.observe(child);update();}
    const changes=new MutationObserver(observe);
    changes.observe(node,{childList:true});observe();
    return {destroy(){cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();dialogs.disconnect();node.remove();}};
  }
</script>
<div class="notification-stack" use:measure>
  {#each messages.items as message (message.id)}
    <div class="notification" class:error={message.tone==='error'} class:warning={message.tone==='warning'} role={message.tone==='error'?'alert':'status'} id={message.htmlId}>
      <div class="message-text">{#if message.title}<strong class="message-title">{#if message.instanceId}<InstanceIcon id={message.instanceId} size={20}/>{/if}<span>{message.title}</span></strong>{/if}<span>{message.text}</span></div>
      <CopyButton text={[message.title,message.text].filter(Boolean).join('\n')}/>
      {#each message.actions || [] as action}<Button disabled={action.disabled} onclick={()=>act(message,action)}>{action.label}</Button>{/each}
      <Button class="icon-button" aria-label={$t(message.tone==='error'?'Dismiss error':'Dismiss notification')} onclick={()=>dismissMessage(message.id)}><Icon name="cross" size={16}/></Button>
    </div>
  {/each}
</div>
<style>
.notification-stack{
  position:fixed;inset-block-start:.5rem;inset-inline-start:calc(var(--rail-width) + .5rem);inset-inline-end:.5rem;
  z-index:25;display:flex;flex-direction:column;align-items:stretch;max-height:calc(100dvh - 1rem);overflow:auto;
  padding:.14285714rem .14285714rem .35714286rem;pointer-events:none;
}
.notification-stack:empty{display:none}
.message-title{display:flex;align-items:center;gap:.57142857rem;min-width:0}
.message-title>span{min-width:0;overflow-wrap:anywhere}
.message-text{display:flex;flex-direction:column;gap:.5rem;flex:1 1 12rem;min-width:0}
.notification.warning{--message-fill:var(--theme-warning);--message-text:var(--theme-warning-text)}
.notification-stack > :global(*){
  position:relative;flex:none;width:100%;margin:0;pointer-events:auto;translate:none;
  box-shadow:var(--bevel-raised),var(--shadow-drop);
}
.notification-stack > :global(:not(:last-child)){margin-block-end:calc(.5rem - var(--message-height,.5rem))}
/* Keyboard users can reach every message without a hover-triggered layout change. */
.notification-stack:has(:focus-visible) > :global(:not(:last-child)){margin-block-end:.5rem}
</style>
