<script lang="ts">
  import InstanceName from './InstanceName.svelte';
  import Button from './Button.svelte';
  import {api} from './api';
  import {loadCardArtwork} from './card-artwork';
  import {t} from './i18n';
  import {observeVisibility} from './visibility';
  import type {LibraryScreenshot,Instance} from './types';
  let {screenshot,instance,owner,onopen}:{screenshot:LibraryScreenshot;instance:string;owner?:Instance;onopen:(source:string)=>void}=$props();
  let visible=$state(false),source=$state(''),error=$state('');
  let loadedKey=$state('');
  let edge=$state(512);
  const key=$derived(`thumbnail:${screenshot.instance_id}:${screenshot.name}:${screenshot.modified}:${edge}`);
  function observe(node:HTMLElement){
    const stop=observeVisibility(node,value=>visible=value);
    const resize=new ResizeObserver(()=>{const width=node.clientWidth*window.devicePixelRatio;edge=width<=256?256:width<=512?512:1024;});
    resize.observe(node);
    return {destroy(){stop();resize.disconnect();}};
  }
  $effect(()=>{
    const {instance_id,name}=screenshot;
    const requestKey=key;
    if(loadedKey!==requestKey)error='';
    if(!visible){source='';loadedKey='';return;}
    if(loadedKey===requestKey)return;
    let alive=true;
    void loadCardArtwork(requestKey,()=>api.screenshotThumbnail(instance_id,name,edge)).then(image=>{
      if(!alive)return;
      loadedKey=requestKey;source=image || '';if(!image)error=$t('Could not load screenshot');
    });
    return()=>{alive=false;};
  });
</script>
<div class="screenshot-tile" use:observe>
  <Button shape="card" class="screenshot-card" disabled={!source || !!error} onclick={()=>onopen(source)} aria-label={`${screenshot.name} · ${instance}`}>
    {#if source && !error}
      <img class="screenshot-image" src={source} alt="" onerror={()=>error=$t('Could not load screenshot')}/>
    {:else}
      <span class="screenshot-placeholder" role="status">{error?$t('Could not load screenshot'):$t('Loading…')}</span>
    {/if}
    <span class="screenshot-caption">
      <strong class="screenshot-title"><bdi>{screenshot.name.replace(/\.png$/i,'')}</bdi></strong>
      <span class="catalog-author">{#if owner}<InstanceName instance={owner}/>{:else}{instance}{/if}</span>
    </span>
  </Button>
  {#if error}<Button onclick={async()=>{try{await api.openInstanceFile(screenshot.instance_id,'screenshots',screenshot.name);}catch(reason){error=String(reason);}}}>{$t('Open')}</Button>{/if}
</div>
<style>
.screenshot-tile{display:flex;flex-direction:column;gap:.57142857rem;min-width:0}
:global(.screenshot-card){position:relative;isolation:isolate;width:100%;aspect-ratio:4 / 3;min-width:0;flex:1;color:var(--theme-overlay-text);background:var(--theme-card);font-size:.85714286rem}
:global(.screenshot-card)::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:var(--bevel-raised)}
:global(.screenshot-card:not(:disabled):active)::after{box-shadow:var(--bevel-pressed)}
.screenshot-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;image-rendering:auto}
.screenshot-caption{position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:.57142857rem;min-height:100%;padding:var(--card-padding);background:linear-gradient(180deg,transparent 25%,#0009 75%,#000c);text-shadow:0 .07142857rem .21428571rem #0008}
.screenshot-title{font-size:1.28571429rem;overflow-wrap:anywhere}
.catalog-author{color:var(--theme-overlay-muted)}
.screenshot-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:var(--card-padding);color:var(--theme-card-text)}
</style>
