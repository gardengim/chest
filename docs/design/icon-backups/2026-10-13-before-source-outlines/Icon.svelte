<script lang="ts">
  import {pixelIcon,iconResolution,iconStrokeWidth} from './pixel-icons';
  import {symbols} from './symbols';
  let {name,size=20}:{name:string;size?:number}=$props();
  let rendered=$state<{name:string;path:string}|null>(null);
  $effect(()=>{
    const selected=name;
    if(selected==='chest')return;
    let alive=true;
    void pixelIcon(selected).then(path=>{if(alive)rendered={name:selected,path};}).catch(()=>{/* Keep the source vector if rasterization is unavailable. */});
    return()=>{alive=false;};
  });
</script>
{#if name==='chest'}
  <img src="/chest.svg" width={size} height={size} alt="" aria-hidden="true" draggable="false"/>
{:else}
  <svg width={size} height={size} viewBox={`0 0 ${iconResolution} ${iconResolution}`} aria-hidden="true" focusable="false" data-symbol={name}>
    {#if rendered?.name===name}<path d={rendered.path} fill="currentColor" shape-rendering="crispEdges"/>
    {:else}<path d={symbols[name] || symbols.cube} fill="none" stroke="currentColor" stroke-width={iconStrokeWidth} stroke-linecap="round" stroke-linejoin="round"/>{/if}
  </svg>
{/if}
