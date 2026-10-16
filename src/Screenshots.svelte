<script lang="ts">
  import Icon from './Icon.svelte';
  import CardGrid from './CardGrid.svelte';
  import Toolbar from './Toolbar.svelte';
  import HomeShelf from './HomeShelf.svelte';
  import {untrack} from 'svelte';
  import {onFocusRefresh} from './focus-refresh';
  import {api} from './api';
  import {t} from './i18n';
  import InstanceName from './InstanceName.svelte';
  import Button from './Button.svelte';
  import Pagination from './Pagination.svelte';
  import {collectionPageSize as pageSize} from './collection-page';
  import CopyButton from './CopyButton.svelte';
  import ScreenshotTile from './ScreenshotTile.svelte';
  import {showDialog} from './dialog';
  import type {Instance,LibraryScreenshot,ScreenshotLibrary} from './types';
  let {shelf=false,onviewall,instances,full=false,screenshots,onrefresh,refreshDisabled=false}:{shelf?:boolean;onviewall?:()=>void;onrefresh?:()=>Promise<unknown>;refreshDisabled?:boolean;instances:Instance[];full?:boolean;screenshots?:LibraryScreenshot[]}=$props();
  let library=$state<ScreenshotLibrary>({screenshots:[],unavailable:[]}),loading=$state(false),error=$state(''),page=$state(0);
  let loaded=$state(false);
  let selected=$state<{screenshot:LibraryScreenshot;source:string}|null>(null);
  const entries=$derived(screenshots ?? library.screenshots);
  const pages=$derived(Math.max(1,Math.ceil(entries.length/pageSize)));
  const shown=$derived(entries.slice(full?page*pageSize:0,full?(page+1)*pageSize:pageSize));
  async function refresh(){
    if(loading || refreshDisabled)return;
    loading=true;error='';
    try{if(screenshots!==undefined)await onrefresh?.();else {library=await api.screenshotLibrary();loaded=true;}page=Math.min(page,pages-1);}catch(reason){error=String(reason);}finally{loading=false;}
  }
  $effect(()=>{if(screenshots!==undefined)return;instances.map(instance=>instance.id).join(',');untrack(()=>{void refresh();});});
  $effect(()=>{page=Math.min(page,pages-1);});
  onFocusRefresh(async()=>{if(screenshots===undefined)await refresh();});
  async function choose(screenshot:LibraryScreenshot,thumbnail:string){
    error='';
    const preview={screenshot,source:thumbnail};selected=preview;
    try{const image=await api.screenshotImage(screenshot.instance_id,screenshot.name);if(selected?.screenshot===screenshot)selected={screenshot,source:image};}
    catch(reason){if(selected?.screenshot===screenshot)error=String(reason);}
  }
  async function open(){if(!selected)return;try{await api.openInstanceFile(selected.screenshot.instance_id,'screenshots',selected.screenshot.name);}catch(reason){error=String(reason);}}
</script>
{#if shelf}<HomeShelf section="screenshots" {full} count={entries.length} moreContent={entries.length>pageSize} {onviewall}>
  {#snippet tools(heading,navigation)}<Toolbar {heading} {navigation}/>{/snippet}
  {@render body()}
</HomeShelf>{:else}<Toolbar>{#snippet status()}{entries.length} {$t('Screenshots')}{/snippet}</Toolbar>{@render body()}{/if}
{#snippet body()}
{#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
{#if library.unavailable.length}<p class="inline-error" role="alert">{$t('Could not read screenshots from {names}',{names:library.unavailable.join(', ')})}</p>{/if}
{#if loading && !loaded && screenshots===undefined && !shown.length}<p role="status">{$t('Loading…')}</p>{:else if !shown.length}<p class="muted">{$t('No screenshots')}</p>{/if}
<CardGrid class="screenshots-grid">{#each shown as screenshot (`${screenshot.instance_id}:${screenshot.name}`)}
  <ScreenshotTile {screenshot} owner={instances.find(instance=>instance.id===screenshot.instance_id)} instance={instances.find(instance=>instance.id===screenshot.instance_id)?.name || $t('Unknown')} onopen={source=>choose(screenshot,source)}/>
{/each}</CardGrid>
{#if full && entries.length}<Pagination label={$t('{name} pages',{name:$t('Screenshots')})} {page} {pages} onchange={value=>page=value}/>{/if}
{/snippet}
{#if selected}<dialog class="modal screenshot-preview" use:showDialog aria-label={selected.screenshot.name} oncancel={event=>{event.preventDefault();selected=null;}}>
  <div class="section-heading"><h2>{selected.screenshot.name}</h2><Button class="dialog-close" aria-label={$t('Close')} onclick={()=>selected=null}><Icon name="close" size={18}/></Button></div>
  {#if instances.find(instance=>instance.id===selected!.screenshot.instance_id)}<p><InstanceName instance={instances.find(instance=>instance.id===selected!.screenshot.instance_id)!}/></p>{/if}
  <img src={selected.source} alt={selected.screenshot.name}/>
  {#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
  <Button onclick={open}>{$t('Open')}</Button>
</dialog>{/if}
<style>
  .screenshot-preview{max-width:min(90vw,80rem)}
  .screenshot-preview img{display:block;max-width:100%;max-height:60dvh;object-fit:contain;margin:1.14285714rem auto}
</style>
