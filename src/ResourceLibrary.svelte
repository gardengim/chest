<script lang="ts">
  import CardGrid from './CardGrid.svelte';
  import Pagination from './Pagination.svelte';
  import {collectionPageSize as pageSize} from './collection-page';
  import Toolbar from './Toolbar.svelte';
  import HomeShelf from './HomeShelf.svelte';
  import AddButton from './AddButton.svelte';
  import InstanceIcon from './InstanceIcon.svelte';
  import InstanceName from './InstanceName.svelte';
  import InstanceReferences from './InstanceReferences.svelte';
  import MenuItem from './MenuItem.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import InstanceChooser from './InstanceChooser.svelte';
  import {serverAddressKey} from './server-library';
  import {onFocusRefresh} from './focus-refresh';
  import {api,native} from './api';
  import {t} from './i18n';
  import {loaderLabel,type Config,type Loader,type ServerBookmark,type WorldLibrary} from './types';
  import {showDialog} from './dialog';
  import WorldList from './WorldList.svelte';
  import Card from './Card.svelte';
  import Button from './Button.svelte';
  import CopyButton from './CopyButton.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import {mergeServers,type ServerRow} from './server-library';
  import Select from './Select.svelte';
  import Icon from './Icon.svelte';
  let {onviewall,mode,config,isBusy,onconfig,onopen,icons={},embedded=false,gallery=false}:{onviewall?:()=>void;icons?:Record<string,string>;embedded?:boolean;gallery?:boolean;mode:'worlds'|'servers';config:Config;isBusy:(id:string)=>boolean;onconfig:(config:Config)=>void;onopen:(id:string,item:string)=>void}=$props();
  let library=$state<WorldLibrary>({worlds:[],unavailable:[]}),loading=$state(false),search=$state(''),error=$state(''),notice=$state(''),pending=$state(false);
  let serverLibrary=$state<import('./types').ServerLibrary>({servers:[],unavailable:[]}),layout=$state<'gallery'|'list'>('gallery');
  const cardLayout=$derived(layout);
  let edit=$state<ServerBookmark|null>(null),adding=$state<ServerBookmark|null>(null),removing=$state<ServerBookmark|null>(null),target=$state('');
  const owners=$derived(new Map(config.instances.map(instance=>[instance.id,instance])));
  const worlds=$derived(library.worlds.filter(world=>`${world.name} ${owners.get(world.instance_id)?.name || ''}`.toLowerCase().includes(search.trim().toLowerCase())));
  const servers=$derived(mergeServers(config.server_bookmarks || [],serverLibrary.servers).filter(server=>`${server.name} ${server.address}`.toLowerCase().includes(search.trim().toLowerCase())));
  let page=$state(0);
  const pages=$derived(Math.max(1,Math.ceil(servers.length/pageSize)));
  const shownServers=$derived(servers.slice(gallery?0:page*pageSize,gallery?pageSize:(page+1)*pageSize));
  $effect(()=>{search;mode;page=0;});
  $effect(()=>{page=Math.min(page,pages-1);});
  const destination=$derived(config.instances.find(instance=>instance.id===target));
  const mismatch=$derived(!!adding && !!destination && ((!!adding.expected_version && adding.expected_version!==destination.version) || (!!adding.expected_loader && adding.expected_loader!==destination.loader)));
  let refreshRequest=0;
  async function refresh(){
    const ticket=++refreshRequest,kind=mode;loading=true;error='';
    try{if(kind==='worlds'){const value=await api.worlds();if(ticket===refreshRequest && mode===kind)library=value;}else{const value=await api.servers();if(ticket===refreshRequest && mode===kind)serverLibrary=value;}}
    catch(e){if(ticket===refreshRequest)error=String(e);}
    finally{if(ticket===refreshRequest)loading=false;}
  }
  $effect(()=>{mode;config.instances.map(instance=>instance.id).join(',');void refresh();});
  onFocusRefresh(refresh);
  async function run(work:()=>Promise<unknown>){if(pending)return;pending=true;error='';notice='';try{await work();}catch(e){error=String(e);}finally{pending=false;}}
  let joining=$state(false);
  let menu=$state<{server:ServerRow;trigger:HTMLElement;x:number;y:number}|null>(null),choosing=$state<ServerRow|null>(null);
  function openMenu(event:MouseEvent|KeyboardEvent,server:ServerRow){if(event instanceof KeyboardEvent && event.key!=='ContextMenu' && !(event.shiftKey && event.key==='F10'))return;event.preventDefault();const trigger=event.currentTarget as HTMLElement;const box=trigger.getBoundingClientRect();menu={server,trigger,x:event instanceof MouseEvent?event.clientX:box.left,y:event instanceof MouseEvent?event.clientY:box.bottom};}
  function action(work:(server:ServerRow)=>unknown){if(!menu)return;const item=menu;menu=null;item.trigger.focus({preventScroll:true});void work(item.server);}
  function join(server:ServerRow){
    const targets=config.instances.filter(instance=>server.instance_ids.includes(instance.id) && instance.installed && !isBusy(instance.id));
    if(targets.length===1)void run(()=>api.launchResource(targets[0].id,'server',server.address));
    else if(targets.length){joining=true;choosing=server;}
  }
  function open(server:ServerRow){
    joining=false;
    const ids=server.instance_ids.filter(id=>config.instances.some(instance=>instance.id===id));
    if(ids.length>1)choosing=server;else if(ids.length)onopen(ids[0],serverAddressKey(server.address));else add(server);
  }
  function bookmarkData(server:ServerBookmark):ServerBookmark{
    const {id,name,address,instance_id,expected_version,expected_loader}=server;
    return {id,name,address,instance_id,expected_version,expected_loader};
  }
  async function bookmark(server:ServerRow){onconfig(await api.saveServerBookmark({...bookmarkData(server),id:''}));}
  function add(server:ServerBookmark){adding=server;target=server.instance_id || config.instances.find(instance=>instance.version!=='pending')?.id || '';error='';}
</script>
{#if !embedded}<h1>{$t(mode==='worlds'?'Worlds':'Servers')}</h1>{/if}
<HomeShelf section={mode} full={!gallery} moreContent={(mode==='worlds'?worlds.length:servers.length)>pageSize} {onviewall}>
  {#snippet tools(heading,navigation)}<Toolbar {heading} {navigation} trailing={layoutButton} searchLabel={$t(mode==='worlds'?'Search worlds':'Search servers')} bind:value={search} items={[
    ...(mode==='servers'?[{id:'add',label:$t('Add'),priority:100,content:addButton}]:[])
  ]}/>{/snippet}
{#if error && !edit && !adding && !removing}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
{#if notice}<p class="inline-notice" role="status">{notice}</p>{/if}
{#if mode==='worlds'}
  {#if loading}<p role="status">{$t('Loading…')}</p>{:else}
    {#if library.unavailable.length}<p class="inline-error" role="alert">{$t('Could not read worlds from {names}',{names:library.unavailable.join(', ')})}</p>{/if}
    {#if !worlds.length && library.worlds.length}<p class="muted">{$t('No results')}</p>{:else}<WorldList full={!gallery} resetKey={search} {worlds} instances={config.instances} {isBusy} onrefresh={refresh} showInstance {onopen} layout={cardLayout}/>{/if}
  {/if}
{:else}
  {#if loading}<p role="status">{$t('Loading…')}</p>{/if}
  {#if serverLibrary.unavailable.length}<p class="inline-error" role="alert">{$t('Could not read servers from {names}',{names:serverLibrary.unavailable.join(', ')})}</p>{/if}
  <CardGrid class="server-list" layout={cardLayout}>{#each shownServers as server (server.id)}
    <Card aria-haspopup="menu" aria-expanded={menu?.server.id===server.id} onclick={()=>open(server)} oncontextmenu={event=>openMenu(event,server)} onkeydown={event=>openMenu(event,server)} title={server.name} icon={server.icon} layout={cardLayout} artworkKey={`server:${server.id}:${server.address}:${server.instance_id || ''}`} loadIcon={server.bookmarked?()=>api.serverIcon(server.id):undefined}>
      <span class="catalog-author">{server.address}</span>
      {#if server.instance_ids.length}<span class="catalog-author"><InstanceReferences instances={config.instances.filter(instance=>server.instance_ids.includes(instance.id))}/></span>{/if}
      {#if server.expected_version || server.expected_loader}<span class="catalog-author">{server.expected_version} {server.expected_loader?loaderLabel(server.expected_loader):''}</span>{/if}

    </Card>
  {:else}<p class="muted">{$t(mergeServers(config.server_bookmarks || [],serverLibrary.servers).length?'No results':'No servers')}</p>{/each}</CardGrid>
  {#if !gallery}<Pagination label={$t('Servers')} {page} {pages} disabled={loading} onchange={value=>{menu=null;page=value;}}/>{/if}
{/if}
</HomeShelf>
{#snippet addButton()}<AddButton disabled={pending} onclick={()=>{error='';edit={id:'',name:'',address:'',instance_id:null,expected_version:'',expected_loader:null};}}/>{/snippet}
{#snippet layoutButton()}<LayoutSwitch label={$t(mode==='worlds'?'Worlds layout':'Servers layout')} bind:value={layout}/>{/snippet}
{#if choosing}<InstanceChooser instances={config.instances.filter(instance=>choosing!.instance_ids.includes(instance.id) && (!joining || instance.installed && !isBusy(instance.id)))} {icons} onchoose={id=>{const server=choosing!;choosing=null;if(joining)void run(()=>api.launchResource(id,'server',server.address));else onopen(id,serverAddressKey(server.address));}} onclose={()=>choosing=null}/>{/if}
{#if menu}<ContextMenu title={menu.server.name} icon={menu.server.icon} trigger={menu.trigger} x={menu.x} y={menu.y} onclose={()=>menu=null}>
  <MenuItem icon="play" disabled={!native || pending || !config.instances.some(instance=>menu!.server.instance_ids.includes(instance.id) && instance.installed && !isBusy(instance.id))} onclick={()=>action(server=>join(server))}>{$t('Join')}</MenuItem>
  {#if menu.server.instance_ids.length}<MenuItem direction="right" onclick={()=>action(server=>open(server))}>{$t('Open instance')}</MenuItem>{/if}
  <MenuItem icon="copy" onclick={()=>action(server=>run(async()=>{await navigator.clipboard.writeText(server.address);notice=$t('Copied');}))}>{$t('Copy')}</MenuItem>
  {#if menu.server.bookmarked}
    <div role="separator"></div>
    <MenuItem icon="plus" disabled={!native || pending || !config.instances.some(instance=>instance.version!=='pending')} onclick={()=>action(server=>add(server))}>{$t('Add to instance')}</MenuItem>
    <MenuItem icon="gear" disabled={pending} onclick={()=>action(server=>{error='';edit=bookmarkData(server);})}>{$t('Edit')}</MenuItem>
    <MenuItem icon="close" tone="danger" disabled={pending} onclick={()=>action(server=>{error='';removing=server;})}>{$t('Remove')}</MenuItem>
  {:else}<MenuItem icon="plus" disabled={pending} onclick={()=>action(server=>run(()=>bookmark(server)))}>{$t('Bookmark')}</MenuItem>{/if}
</ContextMenu>{/if}
{#if edit}
  <dialog class="modal" use:showDialog aria-label={$t('Server bookmark')} oncancel={event=>{event.preventDefault();if(!pending)edit=null;}}>
    <div class="section-heading"><h2>{$t('Server bookmark')}</h2><Button class="dialog-close" disabled={pending} aria-label={$t('Close')} onclick={()=>edit=null}><Icon name="close"/></Button></div>
    <form onsubmit={event=>{event.preventDefault();void run(async()=>{onconfig(await api.saveServerBookmark(edit!));edit=null;});}}>
      <label>{$t('Name')}<input bind:value={edit.name} required maxlength={120} disabled={pending}/></label>
      <label>{$t('Address')}<input bind:value={edit.address} required maxlength={320} placeholder="example.com:25565" disabled={pending}/></label>
      <label>{$t('Preferred instance')}<Select value={edit.instance_id || ''} disabled={pending} onchange={event=>{if(edit)edit.instance_id=event.currentTarget.value || null;}}><option value="">{$t('None')}</option>{#each config.instances as instance}<option value={instance.id}>{instance.name}</option>{/each}{#snippet leading(value:string)}{#if config.instances.some(instance=>instance.id===value)}<InstanceIcon id={value}/>{/if}{/snippet}{#snippet optionContent(value:string,label:string)}{#if config.instances.find(instance=>instance.id===value)}<InstanceName instance={config.instances.find(instance=>instance.id===value)!}/>{label.slice(config.instances.find(instance=>instance.id===value)!.name.length)}{:else}{label}{/if}{/snippet}</Select></label>
      <div class="form-grid">
        <label>{$t('Expected Minecraft version')}<input bind:value={edit.expected_version} placeholder={$t('Unknown')} maxlength={120} disabled={pending}/></label>
        <label>{$t('Expected mod loader')}<Select value={edit.expected_loader || ''} disabled={pending} onchange={event=>{if(edit)edit.expected_loader=event.currentTarget.value as Loader || null;}}><option value="">{$t('Unknown')}</option>{#each ['vanilla','fabric','quilt','forge','neoforge'] as loader}<option value={loader}>{loaderLabel(loader as Loader)}</option>{/each}{#snippet leading(value:string)}{#if config.instances.some(instance=>instance.id===value)}<InstanceIcon id={value}/>{/if}{/snippet}{#snippet optionContent(value:string,label:string)}{#if config.instances.find(instance=>instance.id===value)}<InstanceName instance={config.instances.find(instance=>instance.id===value)!}/>{label.slice(config.instances.find(instance=>instance.id===value)!.name.length)}{:else}{label}{/if}{/snippet}</Select></label>
      </div>
      {#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
      <div class="form-actions"><Button disabled={pending} onclick={()=>edit=null}>{$t('Cancel')}</Button><Button type="submit" tone="accent" disabled={pending}>{$t('Save')}</Button></div>
    </form>
  </dialog>
{/if}
{#if adding}
  <dialog class="modal" use:showDialog aria-label={$t('Add to instance')} oncancel={event=>{event.preventDefault();if(!pending)adding=null;}}>
    <div class="section-heading"><h2>{$t('Add to instance')}</h2><Button class="dialog-close" disabled={pending} aria-label={$t('Close')} onclick={()=>adding=null}><Icon name="close"/></Button></div>
    <p>{adding.name} · {adding.address}</p>
    <label>{$t('Target instance')}<Select bind:value={target} disabled={pending}>{#each config.instances.filter(instance=>instance.version!=='pending') as instance}<option value={instance.id}>{instance.name} · {instance.version} · {loaderLabel(instance.loader)}</option>{/each}{#snippet leading(value:string)}{#if config.instances.some(instance=>instance.id===value)}<InstanceIcon id={value}/>{/if}{/snippet}{#snippet optionContent(value:string,label:string)}{#if config.instances.find(instance=>instance.id===value)}<InstanceName instance={config.instances.find(instance=>instance.id===value)!}/>{label.slice(config.instances.find(instance=>instance.id===value)!.name.length)}{:else}{label}{/if}{/snippet}</Select></label>
    {#if mismatch}<p class="inline-error">{$t('This instance differs from the server’s expected version or loader.')}</p>{/if}
    <p class="hint">{$t('Server requirements are user-provided. Mod compatibility is unknown.')}</p>
    {#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
    <div class="form-actions"><Button disabled={pending} onclick={()=>adding=null}>{$t('Cancel')}</Button><Button tone="accent" disabled={pending || !destination || isBusy(target)} onclick={()=>run(async()=>{notice=$t(await api.addBookmarkedServer(adding!.id,target)?'Server added.':'Server already listed.');adding=null;await refresh();})}>{$t('Add')}</Button></div>
  </dialog>
{/if}
{#if removing}
  <dialog class="modal" use:showDialog aria-label={$t('Remove bookmark?')} oncancel={event=>{event.preventDefault();if(!pending)removing=null;}}>
    <h2>{$t('Remove bookmark?')}</h2><p>{removing.name}</p>
    <p>{$t('The server remains in existing instance server lists.')}</p>
    {#if error}<div class="inline-error" role="alert">{error}<CopyButton text={error}/></div>{/if}
    <div class="form-actions"><Button disabled={pending} onclick={()=>removing=null}>{$t('Cancel')}</Button><Button tone="danger" disabled={pending} onclick={()=>run(async()=>{onconfig(await api.removeServerBookmark(removing!.id));removing=null;})}>{$t('Remove')}</Button></div>
  </dialog>
{/if}

