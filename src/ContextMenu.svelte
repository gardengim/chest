<script lang="ts">
  import ArtworkImage from './ArtworkImage.svelte';
  import type {Snippet} from 'svelte';
  let {title,icon,heading,trigger,x,y,children,onclose,ignoreTrigger=false}:{title:string;icon?:string|null;heading?:Snippet;trigger:HTMLElement;x:number;y:number;children:Snippet;onclose:()=>void;ignoreTrigger?:boolean}=$props();
  function close(){const anchor=trigger;onclose();anchor.focus({preventScroll:true});}
  function attach(node:HTMLElement){
    const rect=node.getBoundingClientRect();node.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;node.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{if(!node.contains(event.target as Node) && !(ignoreTrigger && trigger.contains(event.target as Node)))onclose();};const dismiss=(event:Event)=>{if(event.target instanceof Node && node.contains(event.target))return;onclose();};
    document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',dismiss);const scrollFrame=requestAnimationFrame(()=>document.addEventListener('scroll',dismiss,true));
    return {destroy(){cancelAnimationFrame(scrollFrame);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',dismiss);document.removeEventListener('scroll',dismiss,true);}};
  }
  function keys(event:KeyboardEvent){
    if(event.key==='Escape' || event.key==='Tab'){if(event.key==='Escape')event.preventDefault();event.stopPropagation();close();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  }
</script>
<div class="instance-context-menu" role="menu" tabindex="-1" aria-label={title} use:attach onkeydown={keys} oncontextmenu={event=>event.preventDefault()}><div class="instance-menu-title"><ArtworkImage source={icon} fallback="none"/>{#if heading}{@render heading()}{:else}{title}{/if}</div>{@render children()}</div>
