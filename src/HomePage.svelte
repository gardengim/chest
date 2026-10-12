<script lang="ts">
  import {onDestroy} from 'svelte';
  import { t } from './i18n';
  import News from './News.svelte';
  import Button from './Button.svelte';
  import Explore from './Explore.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import ScreenshotBackdrop from './ScreenshotBackdrop.svelte';
  import InstanceBrief from './InstanceBrief.svelte';
  import Icon from './Icon.svelte';
  import type { Instance, Version } from './types';
  import type { LibraryView } from './ui-state';

  let { instances, icons, versions, view=$bindable(), target=$bindable(''), statusText,
    oncreate, onselect, ondoubleclick, onmenu, onmenukeys, menuId, oncreated, onpackselected, isBusy, onadded }: {
    instances: Instance[]; icons: Record<string,string>; versions: Version[];
    view: LibraryView; target?: string; statusText: (instance:Instance)=>string;
    oncreate: ()=>void; onselect: (id:string)=>void; ondoubleclick: (instance:Instance)=>void;
    onmenu: (event:MouseEvent,instance:Instance)=>void; onmenukeys: (event:KeyboardEvent,instance:Instance)=>void; menuId?:string;
    onpackselected: (pack:import('./types').PackSelection)=>void;
    oncreated: (instance:Instance,icon?:string|null)=>Promise<void>;
    isBusy: (id:string)=>boolean; onadded: (id:string)=>void;
  } = $props();
  let selectionTimer:ReturnType<typeof setTimeout>|undefined;
  function cancelSelection(){clearTimeout(selectionTimer);selectionTimer=undefined;}
  onDestroy(cancelSelection);
  function clickInstance(event:MouseEvent,instance:Instance){
    cancelSelection();
    if(event.detail===0){onselect(instance.id);return;}
    selectionTimer=setTimeout(()=>onselect(instance.id),250);
  }
  function doubleClickInstance(instance:Instance){cancelSelection();onselect(instance.id);ondoubleclick(instance);}
  const visible=$derived(instances.filter(i=>i.name.toLowerCase().includes(view.filter.toLowerCase())));
</script>

<section class="home-library" aria-labelledby="library-title">
  <div class="section-heading library-heading">
    <div>
      <h1 id="library-title">{$t("Library")} <span class="count">{instances.length}</span>
      </h1>

    </div>
    <div class="library-tools">
      <Button tone="accent" onclick={oncreate}>
        <Icon name="plus" size={16}/>{$t("New")}</Button>
      <label class="search">
        <Icon name="search" size={16}/>
        <input aria-label={$t("Search instances")} placeholder={$t("Search…")} bind:value={view.filter}/>
      </label>
      <LayoutSwitch label={$t("Library layout")} bind:value={view.layout}/>
    </div>
  </div>
  {#if instances.length===0}
    <div class="empty library-empty">
      <Icon name="cube" size={32}/>
      <h3>{$t("No instances")}</h3>

      <Button shape="plain" onclick={oncreate}>{$t("Create")} <Icon name="arrow" size={16}/>
      </Button>
    </div>
  {:else if visible.length===0}
    <div class="empty">
      <h3>{$t("No matches")}</h3>
      <Button shape="plain" onclick={()=>view.filter=''}>{$t("Clear")}</Button>
    </div>
  {:else}
    <div class="instance-grid" class:library-list={view.layout==='list'}>
      {#each visible as instance (instance.id)}
        <Button shape="card" class="instance-card" aria-haspopup="menu" aria-expanded={menuId===instance.id} oncontextmenu={event=>{cancelSelection();onmenu(event,instance);}} onkeydown={event=>onmenukeys(event,instance)} onclick={event=>clickInstance(event,instance)} ondblclick={()=>doubleClickInstance(instance)}>
          <ScreenshotBackdrop id={instance.id} variant="card"/>
          <div class="card-art">
            <ArtworkImage source={icons[instance.id]}/>
          </div>
          <div class="card-body">
            <h3>{instance.name}</h3>
            <InstanceBrief {instance}/>
            <div class="card-status">
              <span>{statusText(instance)}</span>
              <Icon name="arrow" size={16}/>
            </div>
          </div>
        </Button>
      {/each}
    </div>
  {/if}
</section>
<section class="home-explore" id="explore" aria-label={$t("Explore")}>
  <News limit={6} paginated {instances}/>
  <Explore {instances} {versions} bind:target={target} {oncreated} {onpackselected} packActionLabel={$t("Select")} {isBusy} {onadded}/>
</section>
