<script lang="ts">
  import {pixelIcon,iconResolution} from './pixel-icons';
  import {symbolBody,symbolAccent} from './symbols';
  let {name,size=20}:{name:string;size?:number}=$props();
  let rendered=$state<{name:string;path:string;accent:string;color:string}|null>(null);
  $effect(()=>{
    const selected=name;
    if(selected==='chest')return;
    let alive=true;
    const accent=symbolAccent(selected);
    void Promise.all([pixelIcon(selected),accent?pixelIcon(selected,true):Promise.resolve('')]).then(([path,accentPath])=>{if(alive)rendered={name:selected,path,accent:accentPath,color:accent?.color??'currentColor'};}).catch(()=>{/* Keep the source vector if rasterization is unavailable. */});
    return()=>{alive=false;};
  });
</script>
{#if name==='chest'}
  <img src="/chest.svg" width={size} height={size} style:--icon-size={`${size/14}rem`} alt="" aria-hidden="true" draggable="false"/>
{:else}
  <svg width={size} height={size} style:--icon-size={`${size/14}rem`} viewBox={`0 0 ${iconResolution} ${iconResolution}`} aria-hidden="true" focusable="false" data-symbol={name}>
    {#if rendered?.name===name}<path d={rendered.path} fill="currentColor" shape-rendering="crispEdges"/>
      {#if rendered.accent}<path d={rendered.accent} fill={rendered.color} shape-rendering="crispEdges"/>{/if}
    {:else}{@html symbolBody(name)}{/if}
  </svg>
{/if}

<style>svg{color:var(--icon-ink)}svg,img{width:var(--icon-size);height:var(--icon-size);flex-shrink:0}</style>
