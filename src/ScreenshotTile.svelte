<script lang="ts">
  import InstanceName from './InstanceName.svelte';
  import Card from './Card.svelte';
  import {api} from './api';
  import {loadCardArtwork} from './card-artwork';
  import {t} from './i18n';
  import {observeVisibility} from './visibility';
  import type {LibraryScreenshot,Instance} from './types';
  let {screenshot,instance,owner,onopen}:{screenshot:LibraryScreenshot;instance:string;owner?:Instance;onopen:(source:string)=>void}=$props();
  let visible=$state(false),source=$state(''),error=$state('');
  let loadedKey=$state('');
  const key=$derived(`screenshot:${screenshot.instance_id}:${screenshot.name}:${screenshot.modified}`);
  function observe(node:HTMLElement){return {destroy:observeVisibility(node,value=>visible=value)};}
  $effect(()=>{
    const {instance_id,name}=screenshot;
    const requestKey=key;
    if(loadedKey!==requestKey){source='';error='';}
    if(!visible || loadedKey===requestKey)return;
    let alive=true;
    void loadCardArtwork(requestKey,()=>api.screenshotImage(instance_id,name)).then(image=>{
      if(!alive)return;
      loadedKey=requestKey;source=image || '';if(!image)error=$t('Could not load screenshot');
    });
    return()=>{alive=false;};
  });
</script>
<div class="screenshot-tile" use:observe>
  <Card media="image" class="screenshot-card" title={screenshot.name.replace(/\.png$/i,'')} background={!error && source || undefined} disabled={!source || !!error} onclick={()=>onopen(source)} aria-label={`${screenshot.name} · ${instance}`}>
    {#snippet art()}{#if source && !error}<img src={source} alt="" onerror={()=>error=$t('Could not load screenshot')}/>{:else}<span>{error?$t('Could not load screenshot'):$t('Loading…')}</span>{/if}{/snippet}
    <span class="catalog-author">{#if owner}<InstanceName instance={owner}/>{:else}{instance}{/if}</span>
  </Card>
</div>
<style>.screenshot-tile{display:flex;min-width:0}</style>
