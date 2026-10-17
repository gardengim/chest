<script lang="ts">
  import {minecraftArtwork} from './builtin-artwork';
  import CardGrid from './CardGrid.svelte';
  import Pagination from './Pagination.svelte';
  import {collectionPageSize as pageSize} from './collection-page';
  import Toolbar from './Toolbar.svelte';
  import AddButton from './AddButton.svelte';
  import {onDestroy} from 'svelte';
  import HomeShelf from './HomeShelf.svelte';
  import {t} from './i18n';
  import Button from './Button.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import Card from './Card.svelte';
  import InstanceBrief from './InstanceBrief.svelte';
  import type { Instance } from './types';
  import type { LibraryView } from './ui-state';

  let {instances,icons,view=$bindable(),statusText,full=false,onviewall,oncreate,onselect,ondoubleclick,onmenu,onmenukeys,menuId}:{
    instances:Instance[];icons:Record<string,string>;view:LibraryView;statusText:(instance:Instance)=>string;
    full?:boolean;onviewall?:()=>void;oncreate:()=>void;onselect:(id:string)=>void;ondoubleclick:(instance:Instance)=>void;
    onmenu:(event:MouseEvent,instance:Instance)=>void;onmenukeys:(event:KeyboardEvent,instance:Instance)=>void;menuId?:string;
  }=$props();
  let selectionTimer:ReturnType<typeof setTimeout>|undefined;
  function cancelSelection(){clearTimeout(selectionTimer);selectionTimer=undefined;}
  onDestroy(cancelSelection);
  function clickInstance(event:MouseEvent,instance:Instance){
    cancelSelection();
    if(event.detail===0){onselect(instance.id);return;}
    selectionTimer=setTimeout(()=>onselect(instance.id),250);
  }
  function doubleClickInstance(instance:Instance){cancelSelection();onselect(instance.id);ondoubleclick(instance);}
  let page=$state(0);
  const query=$derived(view.filter.trim().toLowerCase());
  const visible=$derived(instances.filter(i=>i.name.toLowerCase().includes(query)));
  const pages=$derived(Math.max(1,Math.ceil(visible.length/pageSize)));
  const shown=$derived(visible.slice(full?page*pageSize:0,full?(page+1)*pageSize:pageSize));
  $effect(()=>{query;page=0;});
  $effect(()=>{page=Math.min(page,pages-1);});
</script>

<section class="home-library" aria-label={$t('Instances')}>
<HomeShelf section="instances" {full} count={visible.length} moreContent={visible.length>pageSize} {onviewall}>
  {#snippet tools(heading,navigation)}
    <Toolbar {heading} {navigation} trailing={layout} searchLabel={$t('Search instances')} bind:value={view.filter} items={[
      {id:'add',label:$t('Add'),priority:100,content:add}
    ]}/>
  {/snippet}
  {#if instances.length===0}
    <div class="empty library-empty">
      <h3>{$t("No instances")}</h3>

    </div>
  {:else if visible.length===0}
    <div class="empty">
      <h3>{$t("No matches")}</h3>
      <Button shape="plain" onclick={()=>view.filter=''}>{$t("Clear")}</Button>
    </div>
  {:else}
    <CardGrid class={['instance-grid',view.layout==='list' && 'library-list']} layout={view.layout}>
      {#each shown as instance (instance.id)}
        <Card class="instance-card" title={instance.name} icon={icons[instance.id]} fallbackIcon={minecraftArtwork} instanceId={instance.id} layout={view.layout} aria-haspopup="menu" aria-expanded={menuId===instance.id} oncontextmenu={event=>{cancelSelection();onmenu(event,instance);}} onkeydown={event=>onmenukeys(event,instance)} onclick={event=>clickInstance(event,instance)} ondblclick={()=>doubleClickInstance(instance)}>
            <InstanceBrief {instance}/>
        </Card>
      {/each}
    </CardGrid>
  {/if}
</HomeShelf>
{#if full}<Pagination label={$t('Instances')} {page} {pages} onchange={value=>page=value}/>{/if}
</section>

{#snippet add()}<AddButton onclick={oncreate}/>{/snippet}
{#snippet layout()}<LayoutSwitch label={$t('Library layout')} bind:value={view.layout}/>{/snippet}
