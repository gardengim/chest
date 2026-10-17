<script lang="ts">
  import { untrack,onDestroy } from 'svelte';
  import {instanceBackgrounds,backgroundImage,backgroundKey} from './instance-backgrounds';
  import type {InstanceBackground} from './types';
  import {presentation,observeVisibility} from './visibility';
  let { id, sources, fallback, variant='header' }: { fallback?:string;id?:string; sources?:string[]; variant?:'header'|'card' } = $props();
  let inView=$state(false);
  function observe(node:HTMLElement){
    $effect(()=>{
      if(!id && (sources?.length || 0)<2)return;
      return observeVisibility(node,visible=>inView=visible);
    });
  }
  let images=$state<InstanceBackground[]>([]);
  let ready=$state<{image:InstanceBackground;source:string}[]>([]);
  let failedFallback=$state('');
  let index=$state(0);
  let shown=$state(''),outgoing=$state('');
  let fadeFrame=0,fadeTimer:ReturnType<typeof setTimeout>;
  onDestroy(()=>{cancelAnimationFrame(fadeFrame);clearTimeout(fadeTimer);});
  function reveal(image:InstanceBackground){
    const key=backgroundKey(image);
    if(!images[index] || backgroundKey(images[index])!==key || shown===key)return;
    cancelAnimationFrame(fadeFrame);
    // Paint the incoming image at zero opacity before changing either layer.
    fadeFrame=requestAnimationFrame(()=>{fadeFrame=requestAnimationFrame(()=>{
      if(images[index] && backgroundKey(images[index])===key){
        outgoing=shown;shown=key;clearTimeout(fadeTimer);
        fadeTimer=setTimeout(()=>outgoing='',1500);
      }
    });});
  }
  let loadedId='';
  let loaded=false;
  const rendered=$derived(images.filter((image,i)=>i===index || backgroundKey(image)===shown || backgroundKey(image)===outgoing));
  // Compare actual inputs, rather than the identity of a refreshed instance/array.
  const input=$derived(JSON.stringify(sources===undefined?{id:id || ''}:{sources}));
  function update(next:InstanceBackground[]){
    const unique=[...new Map(next.map(image=>[backgroundKey(image),image])).values()];
    if(unique.length===images.length && unique.every((image,i)=>backgroundKey(image)===backgroundKey(images[i])))return;
    const current=images[index];
    images=unique;index=Math.max(0,unique.findIndex(image=>current && backgroundKey(image)===backgroundKey(current)));
  }
  function remove(image:InstanceBackground){update(images.filter(entry=>backgroundKey(entry)!==backgroundKey(image)));}
  $effect(()=>{
    const visible=rendered,instanceId=id || '';
    let alive=true;
    if(variant==='card' && (id || (sources?.length || 0)>1) && !inView){ready=[];return;}
    // Resolve only the current/previous frames, never an entire screenshot folder.
    void Promise.all(visible.map(async image=>({image,source:await backgroundImage(instanceId,image,variant==='card'?512:1024)}))).then(frames=>{
      if(!alive)return;
      const next=frames.filter((frame):frame is {image:InstanceBackground;source:string}=>!!frame.source);
      const current=untrack(()=>ready.find(frame=>backgroundKey(frame.image)===shown));
      if(current && !next.some(frame=>backgroundKey(frame.image)===backgroundKey(current.image)))next.unshift(current);
      ready=next;
      for(const frame of frames)if(!frame.source)remove(frame.image);
    });
    return()=>{alive=false;};
  });
  $effect(()=>{
    const source=JSON.parse(input) as {id?:string;sources?:string[]};
    if(source.sources!==undefined){untrack(()=>update(source.sources!.map(url=>({kind:'provider',url}))));return;}
    if(!source.id)return;
    if(variant==='card' && !inView)return;
    // Ignore old artwork when the instance itself changes, but keep nodes on focus/visibility refresh.
    const instanceId=source.id;
    untrack(()=>{if(loadedId!==instanceId){images=[];ready=[];shown='';outgoing='';index=0;loadedId=instanceId;loaded=false;}});
    let alive=true;
    let request=0;
    async function refresh() {
      const ticket=++request;
      try {
        const next=await instanceBackgrounds(instanceId) || [];
        if(alive && ticket===request){update(next);loaded=true;}
      } catch { /* Keep the current backdrop if a refresh fails. */ }
    }
    if(!loaded)void refresh();
    window.addEventListener('focus',refresh);
    return ()=>{alive=false;window.removeEventListener('focus',refresh);};
  });
  $effect(()=>{
    if(images.length<2 || !$presentation.visible || !$presentation.motion || !inView)return;
    const timer=setInterval(()=>{if(images[index] && backgroundKey(images[index])===shown)index=(index+1)%images.length;},8000);
    return ()=>clearInterval(timer);
  });
</script>

<div use:observe class="instance-backdrop" class:card-backdrop={variant==='card'} aria-hidden="true">
  {#if !images.length && fallback && fallback!==failedFallback}
    <img class="visible icon-backdrop" src={fallback} alt="" loading="lazy" onerror={()=>failedFallback=fallback || ''}/>
  {/if}
  {#each ready as frame (backgroundKey(frame.image))}
    <img src={frame.source} alt="" loading={variant==='card'?'lazy':'eager'} class:visible={shown===backgroundKey(frame.image)} onload={()=>reveal(frame.image)} onerror={()=>remove(frame.image)}/>
  {/each}
</div>

<style>
  .icon-backdrop{filter:blur(1.14285714rem);transform:scale(1.16);image-rendering:auto}
</style>
