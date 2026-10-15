<script lang="ts">
  import CardGrid from './CardGrid.svelte';
  import InstanceIcon from './InstanceIcon.svelte';
  import RenameResource from './RenameResource.svelte';
  import InstanceName from './InstanceName.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import {resourceKey} from './resource-navigation';
  import {tick} from 'svelte';
  import {api,native} from './api';
  import {t} from './i18n';
  import type {Instance,WorldEntry} from './types';
  import {showDialog} from './dialog';
  import Button from './Button.svelte';
  import Card from './Card.svelte';
  import CopyButton from './CopyButton.svelte';
  import Icon from './Icon.svelte';
  import Select from './Select.svelte';
  let {worlds,instances,isBusy=()=>false,onrefresh=async()=>{},showInstance=false,onopen,layout='list',highlight=''}:{highlight?:string;layout?:'gallery'|'list';worlds:WorldEntry[];instances:Instance[];isBusy?:(id:string)=>boolean;onrefresh?:()=>Promise<unknown>;showInstance?:boolean;onopen?:(id:string,item:string)=>void}=$props();
  let error=$state(''),notice=$state(''),pending=$state(false),selected=$state<WorldEntry|null>(null),target=$state(''),loading=$state(false);
  let menu=$state<{world:WorldEntry;trigger:HTMLButtonElement;x:number;y:number}|null>(null);
  function openMenu(event:MouseEvent|KeyboardEvent,world:WorldEntry){
    if(event instanceof KeyboardEvent && event.key!=='ContextMenu' && !(event.shiftKey && event.key==='F10'))return;
    event.preventDefault();const trigger=event.currentTarget as HTMLButtonElement;const box=trigger.getBoundingClientRect();menu={world,trigger,x:event instanceof MouseEvent?event.clientX:box.left,y:event instanceof MouseEvent?event.clientY:box.bottom};
  }
  function action(work:(world:WorldEntry,trigger:HTMLButtonElement)=>unknown){if(!menu)return;const item=menu;menu=null;item.trigger.focus({preventScroll:true});void work(item.world,item.trigger);}
  let renaming=$state<WorldEntry|null>(null);
  function canPlay(world:WorldEntry){const instance=instances.find(instance=>instance.id===world.instance_id);const [major,minor]=instance?.version.split('.').map(Number) || [];return !!instance?.installed && (major>=2 || major===1 && minor>=20);}
  let metadataRequest=0;
  let trigger:HTMLButtonElement|undefined;
  const targets=$derived(instances.filter(instance=>instance.id!==selected?.instance_id && instance.version!=='pending'));
  const destination=$derived(targets.find(instance=>instance.id===target));
  const source=$derived(instances.find(instance=>instance.id===selected?.instance_id));
  async function run(work:()=>Promise<unknown>){if(pending)return;pending=true;error='';notice='';try{await work();}catch(e){error=String(e);}finally{pending=false;}}
  async function close(){if(pending)return;metadataRequest++;loading=false;selected=null;await tick();trigger?.focus();}
  async function choose(world:WorldEntry,button:HTMLButtonElement){
    const request=++metadataRequest;trigger=button;selected=world;error='';target=instances.find(instance=>instance.id!==world.instance_id && instance.version!=='pending')?.id || '';loading=true;
    try{const info=await api.worldInfo(world.instance_id,world.folder);if(request===metadataRequest && selected)selected=info;}catch(e){if(request===metadataRequest)error=String(e);}finally{if(request===metadataRequest)loading=false;}
  }
  async function copy(){if(!selected || !destination)return;const world=selected;await run(async()=>{await api.copyWorld(world.instance_id,world.folder,destination.id);selected=null;notice=$t('World copied.');await onrefresh();await tick();trigger?.focus();});}
</script>
{#if error && !selected}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
{#if notice}<p role="status">{notice}</p>{/if}
<CardGrid class="world-list" {layout}>
  {#each worlds as world (`${world.instance_id}:${world.folder}`)}
    <Card backgroundFromIcon backgroundOpacity={.45} class="resource-card world-card" interactive={showInstance} tabindex={showInstance?undefined:-1} title={world.name} {layout} data-resource-key={resourceKey('world',world.folder)} data-highlighted={highlight===world.folder || undefined} aria-haspopup="menu" aria-expanded={menu?.world===world} onclick={()=>onopen?.(world.instance_id,world.folder)} oncontextmenu={event=>openMenu(event,world)} onkeydown={event=>openMenu(event,world)} artworkKey={`world:${world.instance_id}:${world.folder}`} loadIcon={()=>api.worldIcon(world.instance_id,world.folder)}>
      {#if showInstance}<span class="catalog-author">{#if instances.find(instance=>instance.id===world.instance_id)}<InstanceName instance={instances.find(instance=>instance.id===world.instance_id)!}/>{/if} · {world.version || $t('Unknown')}</span>{/if}
      {#snippet actions()}{#if !showInstance}
        <Button disabled={!native || pending || isBusy(world.instance_id) || !canPlay(world)} title={$t('Direct world launch requires Minecraft 1.20 or later')} onclick={()=>run(()=>api.launchResource(world.instance_id,'world',world.folder))}>{$t('Play')}</Button>
        <Button disabled={!native || pending || isBusy(world.instance_id)} onclick={()=>run(async()=>{if(await api.backupWorld(world.instance_id,world.folder))notice=$t('World backed up.');})}>{$t('Back up')}</Button>
        <Button class="secondary-action" disabled={!native || pending || isBusy(world.instance_id) || !instances.some(instance=>instance.id!==world.instance_id && instance.version!=='pending')} onclick={event=>choose(world,event.currentTarget)}>{$t('Copy')}</Button>
        <Button class="card-action-more" aria-label={$t('More actions')} aria-haspopup="menu" aria-expanded={menu?.world===world} onclick={event=>openMenu(event,world)}><Icon name="more" size={18}/></Button>
      {/if}{/snippet}
    </Card>
  {:else}<p class="muted">{$t('No worlds')}</p>{/each}
</CardGrid>
{#if menu}<ContextMenu title={menu.world.name} trigger={menu.trigger} x={menu.x} y={menu.y} onclose={()=>menu=null}>
  {#if onopen}<Button shape="plain" role="menuitem" onclick={()=>action(world=>onopen?.(world.instance_id,world.folder))}>{$t('Open instance')}</Button>{/if}
  <Button shape="plain" role="menuitem" disabled={!native || pending || isBusy(menu.world.instance_id)} onclick={()=>action(world=>{renaming=world;})}>{$t('Rename')}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || pending} onclick={()=>action(world=>run(()=>api.openInstanceFile(world.instance_id,'saves',world.folder)))}>{$t('Open folder')}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || pending || isBusy(menu.world.instance_id)} onclick={()=>action(world=>run(async()=>{if(await api.backupWorld(world.instance_id,world.folder))notice=$t('World backed up.');}))}>{$t('Back up')}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || pending || isBusy(menu.world.instance_id) || !instances.some(instance=>instance.id!==menu!.world.instance_id && instance.version!=='pending')} onclick={()=>action((world,trigger)=>choose(world,trigger))}>{$t('Copy')}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || pending || isBusy(menu.world.instance_id)} onclick={()=>action(world=>run(async()=>{const count=await api.applyDatapacks(world.instance_id,world.folder);notice=$t(count===1?'Added {count} data pack.':'Added {count} data packs.',{count});}))}>{$t('Add data packs')}</Button>
</ContextMenu>{/if}
{#if renaming}<RenameResource name={renaming.name} onrename={async name=>{await api.renameResource(renaming!.instance_id,'world',renaming!.folder,name);await onrefresh();}} onclose={()=>renaming=null}/>{/if}
{#if selected}
  <dialog class="modal" use:showDialog aria-label={$t('Copy world')} oncancel={event=>{event.preventDefault();void close();}}>
    <div class="section-heading"><h2>{$t('Copy world')}</h2><Button class="dialog-close" disabled={pending} aria-label={$t('Close')} onclick={close}><Icon name="close"/></Button></div>
    <p>{selected.name} · {$t('Minecraft version')}: {loading?$t('Loading…'):selected.version || $t('Unknown')}</p>
    <label>{$t('Target instance')}<Select bind:value={target} disabled={pending}>{#each targets as instance}<option value={instance.id}>{instance.name} · {instance.version}</option>{/each}{#snippet leading(value:string)}{#if instances.some(instance=>instance.id===value)}<InstanceIcon id={value}/>{/if}{/snippet}{#snippet optionContent(value:string,label:string)}{#if instances.find(instance=>instance.id===value)}<InstanceName instance={instances.find(instance=>instance.id===value)!}/>{label.slice(instances.find(instance=>instance.id===value)!.name.length)}{:else}{label}{/if}{/snippet}</Select></label>
    {#if destination && selected.version && selected.version!==destination.version}<p class="inline-error">{$t('Different Minecraft version. The copy may need conversion or fail to load.')}</p>{/if}
    {#if source && destination && source.loader!==destination.loader}<p class="inline-error">{$t('Different mod loader.')}</p>{/if}
    <p class="hint">{$t('Mod compatibility is unknown. The original world is preserved.')}</p>
    {#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
    <div class="form-actions"><Button disabled={pending} onclick={close}>{$t('Cancel')}</Button><Button tone="accent" disabled={pending || loading || !destination || isBusy(selected.instance_id) || isBusy(target)} onclick={copy}>{$t(pending?'Copying…':'Copy')}</Button></div>
  </dialog>
{/if}

