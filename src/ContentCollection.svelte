<script lang="ts" module>
  export interface ContentEntry {id:string;name:string;kind:string;subtitle?:string;enabled?:boolean;removable?:boolean;toggleable?:boolean;icon?:string|null;background?:string|null;}
</script>
<script lang="ts">
  import CardGrid from './CardGrid.svelte';
  import Pagination from './Pagination.svelte';
  import {collectionPageSize as pageSize} from './collection-page';
  import Toolbar from './Toolbar.svelte';
  import AddButton from './AddButton.svelte';
  import {t} from './i18n';
  import Card from './Card.svelte';
  import Tabs from './Tabs.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import Select from './Select.svelte';
  let {entries,busy=false,onremove=()=>{},ontoggle=()=>{},prefix='content',onadd,addDisabled=false,onrefresh}:{entries:ContentEntry[];busy?:boolean;onremove?:(entry:ContentEntry)=>void;ontoggle?:(entry:ContentEntry)=>void;prefix?:string;onadd?:(kind:string)=>void;addDisabled?:boolean;onrefresh?:()=>Promise<unknown>}=$props();
  let kind=$state('Mods'),layout=$state<'gallery'|'list'>('list');
  const kinds:Record<string,string>={'Mods':'mods','Resource packs':'resourcepacks','Shaders':'shaderpacks'};
  let search=$state(''),status=$state('all'),refreshing=$state(false);
  const category=$derived(entries.filter(entry=>entry.kind===kinds[kind]));
  const query=$derived(search.trim().toLocaleLowerCase());
  const visible=$derived(category.filter(entry=>(status==='all' || kind!=='Mods' || (entry.enabled!==false)===(status==='enabled')) && (!query || `${entry.name} ${entry.subtitle || ''}`.toLocaleLowerCase().includes(query))));
  let page=$state(0);
  const pages=$derived(Math.max(1,Math.ceil(visible.length/pageSize)));
  const shown=$derived(visible.slice(page*pageSize,(page+1)*pageSize));
  $effect(()=>{query;kind;status;page=0;});
  $effect(()=>{page=Math.min(page,pages-1);});
  async function refresh(){if(!onrefresh || refreshing)return;refreshing=true;try{await onrefresh();}finally{refreshing=false;}}

</script>
<section class="content-tabs">
  <div><Tabs options={Object.keys(kinds)} value={kind} {prefix} label={$t('Content types')} onchange={value=>kind=value}/></div>
  <div id={`${prefix}-panel-${encodeURIComponent(kind)}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${encodeURIComponent(kind)}`} class="collection-panel">
    <Toolbar trailing={layoutButton} searchLabel={$t('Search content')} bind:value={search} items={[
      ...(onadd?[{id:'add',label:$t('Add'),priority:100,content:addButton}]:[]),
      ...(onrefresh?[{id:'refresh',label:$t('Refresh'),priority:0,content:refreshButton}]:[]),
      ...(kind==='Mods'?[{id:'status',label:$t('Status'),priority:10,content:statusFilter}]:[])
    ]}/>
    <p class="hint" role="status">{$t('{shown} of {total}',{shown:visible.length,total:category.length})}</p>
    <CardGrid class="content-collection" {layout}>
      {#each shown as entry (entry.id)}
        <Card interactive={false} class={['content-entry','creation-file',entry.enabled===false?'disabled-entry':'']} title={entry.name} icon={entry.icon} background={entry.background} {layout}>
          {#if entry.subtitle}<span class="catalog-author">{entry.subtitle}</span>{/if}
          {#if entry.enabled===false}<span class="catalog-author">{$t('Disabled')}</span>{/if}
          {#snippet actions()}
            {#if entry.toggleable}<Button disabled={busy} onclick={()=>ontoggle(entry)}>{$t(entry.enabled?'Disable':'Enable')}</Button>{/if}
            {#if entry.removable}<Button disabled={busy} aria-label={$t('Remove {name}',{name:entry.name})} onclick={()=>onremove(entry)}><Icon name="close" size={16}/>{$t('Remove')}</Button>{/if}
          {/snippet}
        </Card>
      {:else}<p class="muted">{$t(category.length?'No results':'No content')}</p>{/each}
    </CardGrid>
    <Pagination label={$t('Contents')} {page} {pages} onchange={value=>page=value}/>
  </div>
</section>
<style>
.content-tabs{margin-top:1.42857143rem;min-width:0}
.collection-panel{position:relative;background:var(--inventory);border:var(--stroke) solid var(--frame);padding:1.42857143rem;box-shadow:var(--bevel-inventory),var(--shadow-drop)}
@media(max-width:46.875em){.collection-panel{padding:1rem}}
</style>

{#snippet addButton()}<AddButton disabled={busy || addDisabled} onclick={()=>onadd?.(kinds[kind])}/>{/snippet}
{#snippet refreshButton()}<Button disabled={refreshing} onclick={refresh}>{$t('Refresh')}</Button>{/snippet}
{#snippet layoutButton()}<LayoutSwitch bind:value={layout} label={$t('Content view')}/>{/snippet}
{#snippet statusFilter()}<Select aria-label={$t('Status')} bind:value={status}><option value="all">{$t('All')}</option><option value="enabled">{$t('Enabled')}</option><option value="disabled">{$t('Disabled')}</option></Select>{/snippet}
