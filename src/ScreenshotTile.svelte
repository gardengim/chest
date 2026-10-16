<script lang="ts">
  import InstanceName from './InstanceName.svelte';
  import Card from './Card.svelte';
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
  <Card interactive={!error} media="image" aspectRatio="4 / 3" class="screenshot-card" title={screenshot.name.replace(/\.png$/i,'')} background={!error && source || undefined} disabled={!source || !!error} onclick={()=>onopen(source)} aria-label={`${screenshot.name} · ${instance}`}>
    {#snippet art()}{#if source && !error}<img src={source} alt="" onerror={()=>error=$t('Could not load screenshot')}/>{:else}<span>{error?$t('Could not load screenshot'):$t('Loading…')}</span>{/if}{/snippet}
    {#snippet actions()}{#if error}<Button onclick={async()=>{try{await api.openInstanceFile(screenshot.instance_id,'screenshots',screenshot.name);}catch(reason){error=String(reason);}}}>{$t('Open')}</Button>{/if}{/snippet}
    <span class="catalog-author">{#if owner}<InstanceName instance={owner}/>{:else}{instance}{/if}</span>
  </Card>
</div>
<style>.screenshot-tile{display:flex;min-width:0}</style>
