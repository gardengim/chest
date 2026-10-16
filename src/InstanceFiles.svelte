<script lang="ts">
  import Icon from './Icon.svelte';
  import CardGrid from './CardGrid.svelte';
  import Pagination from './Pagination.svelte';
  import {collectionPageSize as pageSize} from './collection-page';
  import Toolbar from './Toolbar.svelte';
  import RenameResource from './RenameResource.svelte';
  import {tick} from 'svelte';
  import MenuItem from './MenuItem.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import {resourceKey,type ResourceLink} from './resource-navigation';
  import {serverAddressKey} from './server-library';
  import Card from './Card.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import WorldList from './WorldList.svelte';
  import {t} from './i18n';
  import {api,native} from './api';
  import type {InstanceFiles,Instance,Config,WorldEntry,Tab} from './types';
  import Button from './Button.svelte';
  import Screenshots from './Screenshots.svelte';
  let {refreshPending=false,resourceLink=null,id,tab,files,busy,onrefresh=async()=>{},instances=[],isBusy=()=>busy,onconfig,bookmarks=[]}:{refreshPending?:boolean;resourceLink?:ResourceLink|null;onrefresh?:()=>Promise<unknown>;id:string;tab:Tab;files:InstanceFiles;busy:boolean;instances?:Instance[];isBusy?:(id:string)=>boolean;onconfig?:(config:Config)=>void;bookmarks?:import('./types').ServerBookmark[]}=$props();
  let root:HTMLElement;
  let menu=$state<{server:InstanceFiles['servers'][number];trigger:HTMLElement;x:number;y:number}|null>(null);
  function openMenu(event:MouseEvent|KeyboardEvent,server:InstanceFiles['servers'][number]){if(event instanceof KeyboardEvent && event.key!=='ContextMenu' && !(event.shiftKey && event.key==='F10'))return;event.preventDefault();const trigger=event.currentTarget as HTMLElement;const box=trigger.getBoundingClientRect();menu={server,trigger,x:event instanceof MouseEvent?event.clientX:box.left,y:event instanceof MouseEvent?event.clientY:box.bottom};}
  function action(work:(server:InstanceFiles['servers'][number])=>unknown){if(!menu)return;const item=menu;menu=null;item.trigger.focus({preventScroll:true});void work(item.server);}
  let serverPage=$state(0);
  const serverPages=$derived(Math.max(1,Math.ceil(files.servers.length/pageSize)));
  const shownServers=$derived(files.servers.slice(serverPage*pageSize,(serverPage+1)*pageSize));
  const installed=$derived(!!instances.find(instance=>instance.id===id)?.installed);
  $effect(()=>{id;tab;serverPage=0;});
  $effect(()=>{serverPage=Math.min(serverPage,serverPages-1);});
  $effect(()=>{
    const link=resourceLink;const current=id;const selected=tab;files;
    if(!link || link.id!==current || link.tab!==selected)return;
    if(selected==='Servers'){const index=files.servers.findIndex(server=>serverAddressKey(server.ip)===link.item);if(index>=0)serverPage=Math.floor(index/pageSize);}
    let alive=true;
    void tick().then(()=>{if(!alive)return;const key=resourceKey(selected==='Worlds'?'world':'server',link.item);const node=Array.from(root.querySelectorAll<HTMLElement>('[data-resource-key]')).find(node=>node.dataset.resourceKey===key);node?.scrollIntoView({block:'nearest'});node?.focus({preventScroll:true});});
    return()=>{alive=false;};
  });
  let renaming=$state<InstanceFiles['servers'][number]|null>(null);
  let worldLayout=$state<'gallery'|'list'>('gallery');
  let serverLayout=$state<'gallery'|'list'>('gallery');
  let worldDetails=$state<WorldEntry[]>([]);
  $effect(()=>{
    const current=id;
    // Re-read metadata when the discovered world folders change.
    files.worlds;
    if(tab!=='Worlds')return;
    let alive=true;worldDetails=[];
    void api.instanceWorlds(current).then(value=>{if(alive)worldDetails=value || [];}).catch(()=>{});
    return()=>{alive=false;};
  });
  const detailsByFolder=$derived(new Map(worldDetails.map(world=>[world.folder,world])));
  const worlds=$derived(files.worlds.map(folder=>detailsByFolder.get(folder) || {instance_id:id,folder,name:folder,version:null,data_version:null,last_played:null}));
  let error=$state(''),notice=$state(''),pending=$state(false);
  async function run(work:()=>Promise<unknown>){if(pending)return;pending=true;error='';notice='';try{await work();}catch(e){error=String(e);}finally{pending=false;}}
</script>
<div bind:this={root}>
{#if error}<p class="inline-error" role="alert">{error}</p>{/if}
{#if notice}<p class="inline-notice" role="status">{notice}</p>{/if}
{#if tab==='Worlds'}
  <Toolbar trailing={worldView}/>
  <WorldList layout={worldLayout} highlight={resourceLink?.tab==='Worlds'?resourceLink.item:''} {worlds} {instances} {isBusy} {onrefresh}/>
{:else if tab==='Servers'}
  <Toolbar trailing={serverView}/>
  <CardGrid class="server-cards" layout={serverLayout}>{#each shownServers as server}
    <Card class="resource-card" interactive={false} tabindex={-1} data-resource-key={resourceKey('server',serverAddressKey(server.ip))} data-highlighted={resourceLink?.tab==='Servers' && resourceLink.item===serverAddressKey(server.ip) || undefined} aria-haspopup="menu" aria-expanded={menu?.server===server} oncontextmenu={event=>openMenu(event,server)} onkeydown={event=>openMenu(event,server)} title={server.name} icon={server.icon} layout={serverLayout}>
      <span class="selectable">{server.ip}</span>
      {#snippet actions()}
        <Button disabled={!native || busy || pending || !installed} onclick={()=>run(()=>api.launchResource(id,'server',server.ip))}>{$t('Join')}</Button>
        <Button onclick={()=>run(async()=>{await navigator.clipboard.writeText(server.ip);notice=$t('Copied');})}>{$t('Copy')}</Button>
        <Button class="secondary-action" disabled={!native || busy || pending} onclick={()=>renaming=server}>{$t('Rename')}</Button>
        <Button class="icon-button card-action-more" aria-label={$t('More actions')} aria-haspopup="menu" aria-expanded={menu?.server===server} onclick={event=>openMenu(event,server)}><Icon name="more" size={24}/></Button>
      {/snippet}
    </Card>
  {/each}</CardGrid>
  <Pagination label={$t('Servers')} page={serverPage} pages={serverPages} onchange={value=>{menu=null;serverPage=value;}}/>
{:else if tab==='Screenshots'}
  <Screenshots {instances} full {onrefresh} refreshDisabled={refreshPending} screenshots={files.screenshots.map(name=>({instance_id:id,name,modified:0}))}/>
{/if}
{#if renaming}<RenameResource name={renaming.name} onrename={async name=>{await api.renameResource(id,'server',renaming!.ip,name);await onrefresh();}} onclose={()=>renaming=null}/>{/if}
{#if menu}<ContextMenu title={menu.server.name} icon={menu.server.icon} trigger={menu.trigger} x={menu.x} y={menu.y} onclose={()=>menu=null}>
  <MenuItem icon="play" disabled={!native || busy || pending || !installed} onclick={()=>action(server=>run(()=>api.launchResource(id,'server',server.ip)))}>{$t('Join')}</MenuItem>
  <div role="separator"></div>
  <MenuItem icon="gear" disabled={!native || busy || pending} onclick={()=>action(server=>{renaming=server;})}>{$t('Rename')}</MenuItem>
  <MenuItem icon="copy" onclick={()=>action(server=>run(async()=>{await navigator.clipboard.writeText(server.ip);notice=$t('Copied');}))}>{$t('Copy')}</MenuItem>
  <div role="separator"></div>
  <MenuItem icon="plus" disabled={pending || bookmarks.some(bookmark=>serverAddressKey(bookmark.address)===serverAddressKey(menu!.server.ip))} onclick={()=>action(server=>run(async()=>{onconfig?.(await api.saveServerBookmark({id:'',name:server.name,address:server.ip,instance_id:id,expected_version:'',expected_loader:null}));notice=$t('Server bookmarked.');}))}>{$t(bookmarks.some(bookmark=>serverAddressKey(bookmark.address)===serverAddressKey(menu!.server.ip))?'Already added':'Bookmark')}</MenuItem>
</ContextMenu>{/if}
</div>
<style>.selectable{user-select:text}</style>

{#snippet worldView()}<LayoutSwitch label={$t('Worlds layout')} bind:value={worldLayout}/>{/snippet}
{#snippet serverView()}<LayoutSwitch label={$t('Servers layout')} bind:value={serverLayout}/>{/snippet}
