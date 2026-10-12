<script lang="ts">
  import { untrack } from 'svelte';
  import { api } from './api';
  let { id, sources, variant='header' }: { id?:string; sources?:string[]; variant?:'header'|'card' } = $props();
  let images=$state<string[]>([]);
  let index=$state(0);
  // Compare actual inputs, rather than the identity of a refreshed instance/array.
  const input=$derived(JSON.stringify(sources===undefined?{id:id || ''}:{sources}));
  function update(next:string[]){
    const unique=[...new Set(next)];
    if(unique.length===images.length && unique.every((source,i)=>source===images[i]))return;
    const current=images[index];
    images=unique;index=Math.max(0,unique.indexOf(current));
  }
  $effect(()=>{
    const source=JSON.parse(input) as {id?:string;sources?:string[]};
    if(source.sources!==undefined){untrack(()=>update(source.sources!));return;}
    images=[];index=0;
    if(!source.id)return;
    const instanceId=source.id;
    let alive=true;
    let request=0;
    async function refresh() {
      const ticket=++request;
      try {
        const next=await api.screenshots(instanceId) || [];
        if(alive && ticket===request)update(next);
      } catch { /* Keep the current backdrop if a refresh fails. */ }
    }
    void refresh();
    window.addEventListener('focus',refresh);
    return ()=>{alive=false;window.removeEventListener('focus',refresh);};
  });
  $effect(()=>{
    if(images.length<2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>{index=(index+1)%images.length;},8000);
    return ()=>clearInterval(timer);
  });
</script>

<div class="instance-backdrop" class:card-backdrop={variant==='card'} aria-hidden="true">
  {#each images as source (source)}
    <img src={source} alt="" loading={variant==='card'?'lazy':'eager'} class:visible={images[index]===source} onerror={()=>{images=images.filter(image=>image!==source);index=0;}}/>
  {/each}
</div>
