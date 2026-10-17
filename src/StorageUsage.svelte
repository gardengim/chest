<script lang="ts">
  import Message from './Message.svelte';
  import {api,native} from './api';
  import {t} from './i18n';
  import {locale} from './preferences';
  import Button from './Button.svelte';
  import {showDialog} from './dialog';
  let usage=$state<Awaited<ReturnType<typeof api.storageUsage>>|null>(null);
  let pending=$state(false),error=$state(''),confirm=$state(false);
  const size=(bytes:number)=>`${new Intl.NumberFormat($locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(bytes/1024/1024)} MiB`;
  async function scan(){
    pending=true;error='';
    try{usage=await api.storageUsage();}catch(reason){error=String(reason);}finally{pending=false;}
  }
  async function clear(){
    pending=true;error='';
    try{await api.clearImageCache();confirm=false;usage=await api.storageUsage();}
    catch(reason){error=String(reason);}finally{pending=false;}
  }
</script>
<div class="storage-usage">
  <div class="form-actions">
    <Button disabled={!native || pending} onclick={scan}>{$t(pending?'Checking…':'Check storage')}</Button>
    {#if usage}<Button disabled={pending || !usage.clearable_bytes} onclick={()=>confirm=true}>{$t('Clear image cache')}</Button>{/if}
  </div>
  {#if usage}<dl>
    <div><dt>{$t('Instances')}</dt><dd>{size(usage.instance_bytes)}</dd></div>
    <div><dt>{$t('Shared game files')}</dt><dd>{size(usage.shared_bytes)}</dd></div>
    <div><dt>{$t('Image cache')}</dt><dd>{size(usage.cache_bytes)}</dd></div>
    <div><dt>{$t('Other files')}</dt><dd>{size(usage.other_bytes)}</dd></div>
  </dl>{#if !usage.complete}<p role="status">{$t('Storage scan is incomplete.')}</p>{/if}{/if}
  {#if error}<Message tone="error" text={$t(error)}/>{/if}
</div>
{#if confirm}<dialog class="modal" aria-labelledby="clear-cache-title" use:showDialog oncancel={event=>{event.preventDefault();if(!pending)confirm=false;}}>
  <h2 id="clear-cache-title">{$t('Clear image cache?')}</h2>
  <p>{size(usage?.clearable_bytes || 0)}</p>
  {#if error}<Message tone="error" text={$t(error)}/>{/if}
  <div class="form-actions"><Button disabled={pending} onclick={()=>confirm=false}>{$t('Cancel')}</Button><Button disabled={pending} onclick={clear}>{$t('Clear')}</Button></div>
</dialog>{/if}
<style>
.storage-usage{margin-top:1rem}
.form-actions{justify-content:flex-start;flex-wrap:wrap}
dl{display:grid;gap:.5rem;margin-bottom:0}dl>div{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}dd{margin:0;font-variant-numeric:tabular-nums}
</style>
