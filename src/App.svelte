<script lang="ts">
  import AppUpdater from './AppUpdater.svelte';
  import {appUpdate,initializeUpdater} from './app-updater';
  let appUpdateDialog=$state(false);
  import { t } from './i18n';
  import Button from './Button.svelte';
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import HomePage from './HomePage.svelte';
  import CreatePage from './CreatePage.svelte';
  import InstancePage from './InstancePage.svelte';
  import SettingsPage from './SettingsPage.svelte';
  import PageScrollbar from './PageScrollbar.svelte';
  import type { CreationFormState, LibraryView, SettingsFormState } from './ui-state';
  import { showDialog } from './dialog';
  import { instanceUI, instanceStatus, type InstanceChoice } from './instance-ui';
  import InstanceMenu from './InstanceMenu.svelte';
  import {get} from 'svelte/store';
  import {doubleClickLaunch} from './preferences';
  import ArtworkImage from './ArtworkImage.svelte';
  import Icon from './Icon.svelte';
  import { api,native,subscribe } from './api';
  import { type Activity, type DebugLaunch, type Config, type Content, type Instance, type SidebarGroup, type Tab, type Version } from './types';
  let config=$state<Config>({instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096});
  let exploreTarget=$state('');
  let creation=$state<CreationFormState>({pending:false,method:'Custom',name:'',version:'',loader:'vanilla',loaderVersion:'',parent:'',pack:null,archive:null,files:[],catalog:[]});
  let destination=$state('home');let selectedTabs=$state<Record<string,Tab>>({});
  let activities=$state<Record<string,Activity>>({});let logs=$state<Record<string,string[]>>({});let contents=$state<Record<string,Content[]>>({});
  let editors=$state<Record<string,Instance>>({});let versions=$state<Version[]>([]);let versionError=$state('');
  let instanceIcons=$state<Record<string,string>>({});
  let libraryView=$state<LibraryView>({filter:'',layout:'gallery'});
  let error=$state('');let notice=$state('');let loading=$state(true);let signingIn=$state(false);
  let settingsDraft=$state<SettingsFormState>({pending:false,clientId:'',javaPath:'',memory:4096});
  let confirm=$state<{kind:'delete'|'stop';id:string;name:string}|null>(null);
  let instanceMenu=$state<{id:string;trigger:HTMLButtonElement;position?:{x:number;y:number}}|null>(null);
  const menuInstance=$derived(config.instances.find(i=>i.id===instanceMenu?.id));
  const current=$derived(config.instances.find(i=>i.id===destination));
  const tab=$derived(selectedTabs[destination] || 'Overview');
  let debugLaunch=$state<DebugLaunch>({available:false,enabled:false});
  const account=$derived(debugLaunch.enabled ? {...debugLaunch.account!,name:'ChestDebug (offline debug)'} : config.accounts.find(a=>a.id===config.active_account));
  async function toggleOfflineDebug(){await perform(async()=>{debugLaunch=await api.debugOffline(!debugLaunch.enabled);});}
  const active=$derived(current ? activities[current.id] : undefined);
  const currentUI=$derived(current ? instanceUI(current, active) : undefined);
  const busy=$derived(currentUI?.busy || false);
  function ui(instance:Instance) { return instanceUI(instance, activities[instance.id]); }
  function isBusy(id:string) { const instance=config.instances.find(i=>i.id===id);return !!instance && ui(instance).busy; }
  function status(id:string) { return activities[id]?.status || 'idle'; }
  function tabActivity(ids:string[]){
    const issue=ids.some(id=>['crashed','failed','launch_failed'].includes(status(id)));
    const running=ids.some(id=>status(id)==='running');
    return issue && running?'mixed':issue?'issue':running?'running':undefined;
  }
  function statusText(instance:Instance) {return $t(instanceStatus(instance,activities[instance.id]));}
  async function perform(task:()=>Promise<unknown>) {error='';notice='';try{return await task();}catch(e){error=String(e instanceof Error?e.message:e);return undefined;}}
  async function reload() {
    const previous=config;
    config=await api.config();
    const icons=await api.icons() || {};
    for(const i of config.instances){
      if(i.version==='pending' && instanceIcons[i.id] && !icons[i.id])icons[i.id]=instanceIcons[i.id];
      if(previous.instances.find(old=>old.id===i.id)?.version==='pending' && i.version!=='pending')editors[i.id]={...i};
    }
    instanceIcons=icons;
  }
  let rail:HTMLDivElement;
  let fadeTop=$state(false),fadeBottom=$state(false);
  let dragged=$state('');
  let dragY=$state(0);
  let dragOverTarget=$state(false);
  let draggedGroup=$state('');
  let dropGroup=$state('');
  let groupHover=$state('');
  const groupReady=$derived(!!groupHover);
  let reducedMotion=$state(false);
  let grouping=$state<Instance|null>(null);
  let groupName=$state('');
  let groupPending=$state(false);
  let groupError=$state('');
  const groups=$derived(config.sidebar_groups || []);
  const dragMembers=$derived(config.instances.filter(i=>groups.find(g=>g.name===draggedGroup)?.ids.includes(i.id)));
  const dragInstance=$derived(config.instances.find(i=>i.id===dragged));
  function groupOf(id:string){return groups.find(g=>g.ids.includes(id))?.name || '';}
  const sidebarEntries=$derived.by(()=>{
    const entries:({key:string;instance:Instance;group?:never}|{key:string;group:SidebarGroup;instance?:never})[]=[];
    const added=new Set<string>();
    for(const instance of config.instances){
      const group=groups.find(g=>g.ids.includes(instance.id));
      if(!group){entries.push({key:instance.id,instance});continue;}
      if(added.has(group.name))continue;
      added.add(group.name);entries.push({key:`group:${group.name}`,group});
    }
    return entries;
  });
  function openGroupDialog(node:HTMLDialogElement){node.showModal();return {destroy:()=>node.close()};}
  async function saveGroup(){
    if(!grouping || groupPending)return;
    const id=grouping.id,name=groupName.trim();
    const next=groups.map(g=>({...g,ids:g.ids.filter(member=>member!==id)}));
    if(name){const existing=next.find(g=>g.name===name);if(existing){existing.ids.push(id);existing.collapsed=false;}else next.push({name,ids:[id],collapsed:false});}
    groupPending=true;groupError='';
    try{const saved=await api.groups(next.filter(g=>g.ids.length));config.sidebar_groups=saved.sidebar_groups || [];grouping=null;}catch(e){groupError=String(e);}finally{groupPending=false;}
  }
  async function toggleGroup(group:SidebarGroup){
    if(groupPending || dragged || reorderPending)return;
    groupPending=true;
    try{const saved=await api.groups(groups.map(g=>g.name===group.name?{...g,collapsed:!g.collapsed}:g));config.sidebar_groups=saved.sidebar_groups || [];}catch(e){error=String(e);}finally{groupPending=false;}
  }

  let gesture:{id:string;group:string;empty:boolean;atStart:boolean;start:number;x:number;y:number;valid:boolean;order:string[];groups:SidebarGroup[];targetGroup:string}|null=null;
  let suppressClick=false;
  let reorderPending=false;
  function updateRailFade(){
    if(!rail)return;
    fadeTop=rail.scrollTop>1;
    fadeBottom=rail.scrollTop+rail.clientHeight<rail.scrollHeight-1;
  }
  $effect(()=>{void sidebarEntries.length;void groups.map(group=>group.collapsed).join();void tick().then(updateRailFade);});
  function beginReorder(event:PointerEvent,id:string,group=''){
    if(event.button!==0 || reorderPending || groupPending)return;
    gesture={id,group,empty:false,atStart:false,start:event.clientY,x:event.clientX,y:event.clientY,valid:true,order:config.instances.map(i=>i.id),groups:structuredClone($state.snapshot(groups)),targetGroup:groupOf(id)};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function moveReorder(event:PointerEvent){
    if(!gesture)return;
    gesture.y=event.clientY;gesture.x=event.clientX;dragY=event.clientY;
    if(!dragged && Math.abs(event.clientY-gesture.start)<6)return;
    dragged=gesture.id;draggedGroup=gesture.group;
    event.preventDefault();
    reorderAtPointer();
  }
  function hoverForGroup(id:string){groupHover=id;}
  function moveInstance(id:string,target:string,after=false){
    const next=[...config.instances];
    const from=next.findIndex(i=>i.id===id),to=next.findIndex(i=>i.id===target);
    if(from<0 || to<0 || from===to)return;
    const [instance]=next.splice(from,1);
    next.splice(after?next.findIndex(i=>i.id===target)+1:to,0,instance);
    config.instances=next;
  }
  function reorderAtPointer(){
    if(!gesture || !dragged)return;
    const bounds=rail.getBoundingClientRect();
    gesture.valid=gesture.x>=bounds.left && gesture.x<=bounds.right && gesture.y>=bounds.top-20 && gesture.y<=bounds.bottom;
    dropGroup='';dragOverTarget=false;gesture.empty=false;gesture.atStart=false;
    if(!gesture.valid){hoverForGroup('');return;}
    // Use layout positions rather than animated boxes so moving tabs cannot jitter.
    const y=gesture.y-bounds.top+rail.scrollTop;
    function layoutTop(element:HTMLElement){
      let top=0,node:HTMLElement|null=element;
      while(node && node!==rail){top+=node.offsetTop;node=node.offsetParent as HTMLElement|null;}
      return top;
    }
    function containsY(element:HTMLElement){const top=layoutTop(element);return y>=top && y<top+element.offsetHeight;}

    const hit=Array.from(rail.querySelectorAll<HTMLElement>('[data-instance-id], [data-group-name]')).find(containsY);
    const groupArea=Array.from(rail.querySelectorAll<HTMLElement>('[data-drop-group]')).find(containsY);
    const target=hit?.dataset.instanceId;
    const rootEntries=Array.from(rail.querySelectorAll<HTMLElement>('.sidebar-entry'));
    const root=rootEntries.find(containsY);
    // The upper edge stays available even when the first entry is a group.
    if(!gesture.group && rootEntries[0] && y<layoutTop(rootEntries[0])+8){
      hoverForGroup('');gesture.targetGroup='';gesture.empty=true;gesture.atStart=true;return;
    }
    if(gesture.group){
      hoverForGroup('');
      const targetEntry=sidebarEntries[rootEntries.indexOf(root!)];
      if(!targetEntry || targetEntry.key===`group:${gesture.group}`)return;
      const from=sidebarEntries.findIndex(e=>e.key===`group:${gesture!.group}`);
      const to=sidebarEntries.indexOf(targetEntry);
      const center=layoutTop(root!)+root!.offsetHeight/2;
      if((to>from && y<center) || (to<from && y>center))return;
      const entries=[...sidebarEntries], [moving]=entries.splice(from,1);
      entries.splice(to,0,moving);
      config.instances=entries.flatMap(e=>e.group
        ?config.instances.filter(i=>e.group!.ids.includes(i.id))
        :[e.instance]);
      return;
    }
    // Empty rail space (including the add button) is an ungrouped drop zone.
    if(!hit && !groupArea){
      hoverForGroup('');gesture.targetGroup='';gesture.empty=true;return;
    }
    dragOverTarget=!!(target && target!==dragged) || !!(groupArea && groupArea.dataset.dropGroup!==groupOf(dragged));
    gesture.targetGroup=groupArea?.dataset.dropGroup || (target?groupOf(target):hit?.dataset.groupName || '');
    if(gesture.targetGroup && gesture.targetGroup!==groupOf(dragged))dropGroup=gesture.targetGroup;

    const center=hit?layoutTop(hit)+hit.offsetHeight/2:0;
    const centered=hit && Math.abs(y-center)<=16;
    if(target && target!==dragged && !groupOf(target) && centered){
      hoverForGroup(target);return;
    }
    hoverForGroup('');
    if(!target || target===dragged || groupOf(target)!==groupOf(dragged))return;
    const from=config.instances.findIndex(i=>i.id===dragged),to=config.instances.findIndex(i=>i.id===target);
    // Crossing the far edge reorders; the center offers grouping immediately.
    if(!groupOf(target) && ((to>from && y<center+16) || (to<from && y>center-16)))return;
    moveInstance(dragged,target);
  }

  $effect(()=>{
    if(!dragged)return;
    const timer=setInterval(()=>{
      if(!gesture)return;
      const box=rail.getBoundingClientRect();
      const delta=gesture.y<box.top+32?-8:gesture.y>box.bottom-32?8:0;
      if(delta){rail.scrollTop+=delta;reorderAtPointer();}
    },16);
    return()=>clearInterval(timer);
  });
  function finishReorder(cancel=false){
    if(!gesture)return;
    const original=gesture.order,originalGroups=gesture.groups,targetGroup=gesture.targetGroup,id=gesture.id,wholeGroup=!!gesture.group,empty=gesture.empty,atStart=gesture.atStart,changed=!!dragged;
    cancel=cancel || !gesture.valid;
    const hovered=groupHover,createGroup=groupReady && !!hovered;
    gesture=null;dragged='';draggedGroup='';dragOverTarget=false;dropGroup='';hoverForGroup('');
    if(!changed)return;
    suppressClick=true;setTimeout(()=>suppressClick=false,0);
    const restore=()=>{config.sidebar_groups=originalGroups;config.instances=[...config.instances].sort((a,b)=>original.indexOf(a.id)-original.indexOf(b.id));};
    if(cancel){restore();return;}
    reorderPending=true;
    if(empty && !wholeGroup){
      const moving=config.instances.filter(i=>i.id===id),rest=config.instances.filter(i=>i.id!==id);
      config.instances=atStart?[...moving,...rest]:[...rest,...moving];
    }
    if(hovered)moveInstance(id,hovered,createGroup);
    const changedGroup=!wholeGroup && (createGroup || targetGroup!==groupOf(id));
    if(changedGroup){
      config.sidebar_groups=groups.map(g=>({...g,ids:g.ids.filter(member=>member!==id)}));
      if(createGroup){
        let name='Group',number=2;
        while(config.sidebar_groups.some(g=>g.name===name))name=`Group ${number++}`;
        config.sidebar_groups.push({name,ids:[hovered,id],collapsed:true});
      }else{
        const target=config.sidebar_groups.find(g=>g.name===targetGroup);
        if(target)target.ids.push(id);
      }
      config.sidebar_groups=config.sidebar_groups.filter(g=>g.ids.length);
    }
    void (async()=>{
      if(changedGroup)await api.groups(config.sidebar_groups || []);
      await api.reorder(config.instances.map(i=>i.id));
    })().catch(e=>{restore();error=String(e);}).finally(()=>reorderPending=false);
  }
  const creationChanged=$derived(creation.name!=='' || creation.method!=='Custom' ||
    creation.version!==(versions[0]?.id || '') || creation.loader!=='vanilla' || creation.loaderVersion!=='' ||
    creation.parent!=='' || !!creation.pack || !!creation.archive || creation.files.length>0 || creation.catalog.length>0);
  let leaveCreation=$state<string|null>(null);
  function select(id:string,completed=false) {
    if(destination==='create' && id!=='create' && !completed && (creationChanged || creation.pending)){leaveCreation=id;return;}
    if(destination!==id && config.instances.some(i=>i.id===id))selectedTabs[id]='Overview';
    instanceMenu=null;destination=id;error='';notice='';if(config.instances.some(i=>i.id===id) && !editors[id]) editors[id]={...config.instances.find(i=>i.id===id)!};}
  function closeInstanceMenu(restore=false){const trigger=instanceMenu?.trigger;instanceMenu=null;if(restore)trigger?.focus();}
  function openInstanceMenu(event:MouseEvent|KeyboardEvent,instance:Instance){
    event.preventDefault();
    const trigger=event.currentTarget as HTMLButtonElement;
    instanceMenu={id:instance.id,trigger,position:event instanceof MouseEvent && trigger.classList.contains('instance-card')?{x:event.clientX,y:event.clientY}:undefined};
  }
  function instanceMenuKeys(event:KeyboardEvent,instance:Instance){
    if(event.key==='ArrowDown' || event.key==='ContextMenu' || (event.shiftKey && event.key==='F10'))openInstanceMenu(event,instance);
  }
  async function chooseInstanceAction(choice:InstanceChoice){
    const instance=menuInstance;if(!instance)return;
    closeInstanceMenu(true);
    await instanceAction(instance,choice);
  }
  async function instanceAction(instance:Instance,choice:InstanceChoice){
    if(choice==='group'){grouping=instance;groupName=groupOf(instance.id);groupError='';return;}
    const state=ui(instance);
    if((choice==='duplicate' || choice==='export') && !state.canCopy)return;
    if((choice==='delete' || choice==='repair') && state.busy)return;
    if((choice==='folder' || choice==='export') && !native)return;
    if(choice==='open'){select(instance.id);return;}
    if(choice==='action'){await action(instance);return;}
    if(choice==='settings' || choice==='console'){select(instance.id);await selectTab(choice==='settings'?'Settings':'Log');return;}
    if(choice==='delete'){confirm={kind:'delete',id:instance.id,name:instance.name};return;}
    await perform(async()=>{
      if(choice==='folder')await api.folder(instance.id);
      if(choice==='repair')await api.install(instance.id);
      if(choice==='duplicate'){const copy=await api.duplicate(instance.id);await reload();select(copy.id);}
      if(choice==='export' && await api.export(instance.id))notice='Instance exported.';
    });
  }
  async function browseContent(id:string) {
    exploreTarget=id;select('home');await tick();
    document.getElementById('explore')?.scrollIntoView({block:'start'});
  }
  async function refreshContent(id:string){await perform(async()=>{contents[id]=await api.content(id);});}
  async function refreshLogs(id:string){await perform(async()=>{logs[id]=await api.logs(id);});}
  async function toggleContent(instance:Instance,file:Content){
    if(ui(instance).busy)return;
    const id=instance.id;
    await perform(async()=>{await api.toggle(id,file.kind,file.name);contents[id]=await api.content(id);});
  }
  async function acknowledge(id:string){await perform(async()=>{await api.acknowledge(id);delete activities[id];});}
  async function selectTab(next:Tab) {
    const id=destination;
    selectedTabs[id]=next;
    if(next==='Content')await refreshContent(id);
    if(next==='Log')await refreshLogs(id);
  }
  async function loadVersions(){versionError='';try{versions=await api.versions();if(!creation.version)creation.version=versions[0]?.id || '';}catch(e){versionError=String(e);}}
  async function instanceCreated(instance:Instance,icon?:string|null){
    if(!config.instances.some(i=>i.id===instance.id))config.instances.push(instance);
    if(icon)instanceIcons[instance.id]=icon;
    leaveCreation=null;select(instance.id,true);void perform(reload);
  }
  async function action(instance:Instance){await perform(async()=>{
    switch(ui(instance).command){
      case 'pause': await api.pause(instance.id,true);break;
      case 'resume': await api.pause(instance.id,false);break;
      case 'stop': confirm={kind:'stop',id:instance.id,name:instance.name};break;
      case 'install': await api.install(instance.id);break;
      case 'launch': await api.launch(instance.id);break;
    }
  });}
  async function doubleClick(instance:Instance){if(get(doubleClickLaunch) && !ui(instance).busy)await action(instance);}
  async function saveInstance(){if(!current || busy || currentUI?.pending)return;const id=current.id;await perform(async()=>{config=await api.save({...editors[id]});editors[id]={...config.instances.find(i=>i.id===id)!};notice='Instance saved.';});}
  async function confirmAction(){if(!confirm)return;const choice=confirm;confirm=null;await perform(async()=>{
    if(choice.kind==='stop')await api.stop(choice.id);
    else {config=await api.remove(choice.id);delete activities[choice.id];delete selectedTabs[choice.id];delete editors[choice.id];select('home');}
  });}
  async function signIn(){signingIn=true;await perform(async()=>{await api.signIn();await reload();});signingIn=false;}
  function cancelDialog(event:Event){event.preventDefault();if(signingIn)void perform(()=>api.cancelSignIn());else confirm=null;}
  onMount(()=>{void initializeUpdater();reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let cleanup=()=>{};let alive=true;
    (async()=>{try{
      cleanup=await subscribe(a=>{activities[a.id]=a;if(['idle','crashed'].includes(a.status) || a.phase==='Modpack prepared')void perform(reload);},l=>{logs[l.id]=[...(logs[l.id]||[]),l.line].slice(-2000);});
      if(!alive){cleanup();return;}
      debugLaunch=await api.debugLaunch() || {available:false,enabled:false};
      await reload();settingsDraft={pending:false,clientId:config.client_id,javaPath:config.java_path,memory:config.memory_mb};
      for(const a of await api.activities())activities[a.id]=a;
    }catch(e){error=String(e);}finally{loading=false;}await loadVersions();})();
    return ()=>{alive=false;cleanup();hoverForGroup('');};
  });
</script>

{#snippet instanceTab(instance:Instance)}
        <div class="rail-item" data-instance-id={instance.id} class:dragging={dragged===instance.id} class:group-hover={groupHover===instance.id} class:group-ready={groupHover===instance.id && groupReady} class:running={status(instance.id)==='running'} class:crashed={status(instance.id)==='crashed'}>
          <Button shape="rail" class="rail-button instance-icon" data-activity={tabActivity([instance.id])} selected={destination===instance.id} title={`${instance.name} · ${statusText(instance)}`} aria-label={`${instance.name}: ${statusText(instance)}`} aria-current={destination===instance.id?'page':undefined} aria-haspopup="menu" aria-expanded={instanceMenu?.id===instance.id} onpointerdown={event=>beginReorder(event,instance.id)} onclick={()=>{if(!suppressClick)select(instance.id);}} oncontextmenu={event=>openInstanceMenu(event,instance)} onkeydown={event=>instanceMenuKeys(event,instance)} ondblclick={()=>{if(suppressClick)return;closeInstanceMenu();select(instance.id);void doubleClick(instance);}}><ArtworkImage source={instanceIcons[instance.id]}/></Button>
          {#if ['installing','paused','pausing','failed'].includes(status(instance.id))}
            <div class="mini-progress" class:paused={status(instance.id)==='paused'} class:failed={status(instance.id)==='failed'} class:indeterminate={activities[instance.id]?.progress==null} role="progressbar" aria-label={$t('{name} installation',{name:instance.name})} aria-valuenow={activities[instance.id]?.progress==null?undefined:Math.floor(activities[instance.id].progress!*100)}><span style:width={`${(activities[instance.id]?.progress || 0)*100}%`}></span></div>
          {/if}
        </div>
{/snippet}

<svelte:window ondragstart={event=>event.preventDefault()} onpointermove={moveReorder} onpointerup={()=>finishReorder()} onpointercancel={()=>finishReorder(true)} onkeydown={event=>{if(event.key==='Escape')finishReorder(true);}} onresize={updateRailFade}/>

<a class="skip-link" href="#main-content">{$t("Skip to content")}</a>
<div class="app">
  <aside class="rail" aria-label={$t("Main navigation")}>
    <Button shape="rail" selected={destination==='home'} class="rail-button chest" aria-label={$t("Chest home")} title={$t("Chest home")} onclick={()=>select('home')}><Icon name="chest" size={44}/></Button>
    <div class="instance-rail" bind:this={rail} class:fade-top={fadeTop} class:fade-bottom={fadeBottom} onscroll={updateRailFade}>
      {#each sidebarEntries as entry (entry.key)}
        <div animate:flip={{duration:reducedMotion?0:160}} class="sidebar-entry" class:dragging={!!entry.group && draggedGroup===entry.group.name}>
        {#if entry.group}
          {@const members=config.instances.filter(instance=>entry.group!.ids.includes(instance.id))}
          <div class:group-shell={!entry.group.collapsed} class:group-drop-target={dropGroup===entry.group.name} data-drop-group={entry.group.name}>
          <Button shape="rail" class={['rail-group',entry.group.collapsed?'group-collapsed':'group-expanded']} selected={entry.group.collapsed && entry.group.ids.includes(destination)} data-activity={entry.group.collapsed?tabActivity(entry.group.ids):undefined} data-group-name={entry.group.name} title={$t('{name} · {count} instances',{name:entry.group.name,count:members.length})} aria-label={$t('{name} group',{name:entry.group.name})} data-count={members.length} aria-describedby={`group-count-${encodeURIComponent(entry.group.name)}`} aria-current={entry.group.collapsed && entry.group.ids.includes(destination)?'page':undefined} aria-expanded={!entry.group.collapsed} onpointerdown={event=>beginReorder(event,entry.group!.ids[0],entry.group!.name)} onclick={()=>{if(!suppressClick)void toggleGroup(entry.group!);}}>
            <span class="group-count-description" id={`group-count-${encodeURIComponent(entry.group.name)}`}>{members.length} {$t("instances")}{tabActivity(entry.group.ids)==='mixed'?' · '+$t('Contains running instances and instances with issues'):tabActivity(entry.group.ids)==='issue'?' · '+$t('Contains an instance with an issue'):tabActivity(entry.group.ids)==='running'?' · '+$t('Contains a running instance'):''}</span>
            {#if entry.group.collapsed}
              <span class="group-mosaic" aria-hidden="true">
                {#each members.slice(0,members.length>4?3:4) as member (member.id)}
                  <span class="group-member-icon" data-member-id={member.id} data-activity={tabActivity([member.id])}><ArtworkImage source={instanceIcons[member.id]}/></span>
                {/each}
                {#if members.length>4}<span class="group-overflow group-member-icon" data-activity={tabActivity(members.slice(3).map(member=>member.id))}>+{members.length-3}</span>{/if}
              </span>
            {:else}
              <svg width="12" height="6" viewBox="0 1 12 6" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="M5 1h2v2h2v2h2v2H1V5h2V3h2z"/></svg>
            {/if}
          </Button>
          {#if !entry.group.collapsed}
            <div class="group-members">
              {#each members as member (member.id)}
                <div animate:flip={{duration:reducedMotion?0:160}} class="group-member-row">{@render instanceTab(member)}</div>
              {/each}
            </div>
          {/if}
          </div>
        {:else}
          {@render instanceTab(entry.instance)}
        {/if}
        </div>
      {/each}
      <Button shape="rail" class="add" selected={destination==='create'} aria-label={$t("Create instance")} title={$t("Create instance")} onclick={()=>select('create')}><Icon name="plus" size={24}/></Button>
    </div>
    <Button shape="rail" class="rail-button profile" selected={destination==='profile'} aria-label={$t("Accounts and settings")} title={$t("Accounts and settings")} onclick={()=>select('profile')}><Icon name="user" size={32}/></Button>
  </aside>

  <main id="main-content" tabindex="-1">
    {#if $appUpdate.info?.version}<div class="notification"><span>{$t($appUpdate.phase==='ready'?'Restart Chest to finish updating.':'Chest update available')}: {$appUpdate.info.version}</span><Button onclick={()=>appUpdateDialog=true}>{$t($appUpdate.phase==='ready'?'Restart':'Update')}</Button></div>{/if}
    {#if error}<div class="notification error" role="alert"><span>{$t(error)}</span><Button shape="plain" aria-label={$t("Dismiss error")} onclick={()=>error=''}><Icon name="close" size={16}/></Button></div>{/if}
    {#if notice}<div class="notification" role="status">{$t(notice)}<Button shape="plain" aria-label={$t("Dismiss notification")} onclick={()=>notice=''}><Icon name="close" size={16}/></Button></div>{/if}
    <div class="page">
    {#if loading}<div class="empty"><Icon name="chest" size={42}/><h2>{$t("Opening Chest…")}</h2></div>
    {:else if destination==='home'}
      <HomePage onmenu={openInstanceMenu} onmenukeys={instanceMenuKeys} menuId={instanceMenu?.id} instances={config.instances} icons={instanceIcons} {versions} bind:view={libraryView}
        bind:target={exploreTarget} {statusText} oncreate={()=>select('create')} onselect={select}
        ondoubleclick={doubleClick} oncreated={instanceCreated} onpackselected={pack=>{creation={...creation,method:'Modpacks',pack,name:'',archive:null,files:[],catalog:[]};select('create');}} {isBusy} onadded={id=>{void refreshContent(id);}}/>
    {:else if destination==='create'}
      <CreatePage bind:draft={creation} instances={config.instances} {versions} {versionError}
        onretry={loadVersions} oncreated={instanceCreated} {isBusy} {perform}/>
    {:else if current}
      <InstancePage {current} bind:editor={editors[current.id]} {active} {tab} {account}
        source={instanceIcons[current.id]} {versions} content={contents[current.id]} output={logs[current.id]}
        onchoose={choice=>instanceAction(current!,choice)} onselectTab={selectTab}
        onbrowse={()=>browseContent(current!.id)} onsave={saveInstance}
        onacknowledge={()=>acknowledge(current!.id)} ontoggle={file=>toggleContent(current!,file)}
        onrefresh={()=>refreshLogs(current!.id)} onprofile={()=>select('profile')}/>
    {:else if destination==='profile'}
      <SettingsPage {debugLaunch} ontoggleOffline={toggleOfflineDebug} {config} bind:draft={settingsDraft} {signingIn} onsignin={signIn}
        onconfig={next=>config=next} onnotice={message=>notice=message} {perform}/>
    {/if}
    </div>
  </main>
</div>
<PageScrollbar/>
{#if dragInstance || draggedGroup}
  {#if groupReady}<div class="group-drop-hint" role="status" style:top={`${dragY+34}px`}>{$t("Release to create group")}</div>{/if}
  <div class="rail-drag-preview" class:over-target={dragOverTarget} style:top={`${dragY-28}px`} aria-hidden="true">{#if draggedGroup}<span class="group-mosaic">{#each dragMembers.slice(0,dragMembers.length>4?3:4) as member (member.id)}<span class="group-member-icon" data-member-id={member.id} data-activity={tabActivity([member.id])}><ArtworkImage source={instanceIcons[member.id]}/></span>{/each}{#if dragMembers.length>4}<span class="group-overflow group-member-icon" data-activity={tabActivity(dragMembers.slice(3).map(member=>member.id))}>+{dragMembers.length-3}</span>{/if}</span>{:else if dragInstance}<ArtworkImage source={instanceIcons[dragInstance.id]}/>{/if}</div>
{/if}
{#if grouping}
  <dialog class="modal" aria-labelledby="group-title" use:openGroupDialog oncancel={event=>{event.preventDefault();if(!groupPending)grouping=null;}}>
    <form onsubmit={event=>{event.preventDefault();void saveGroup();}}>
      <h2 id="group-title">{$t('Group {name}',{name:grouping.name})}</h2>
      <label>{$t("Group name")}<input bind:value={groupName} list="instance-groups" maxlength={80} placeholder={$t("Leave empty to ungroup")} disabled={groupPending}/></label>
      <datalist id="instance-groups">{#each groups as group}<option value={group.name}></option>{/each}</datalist>
      <p class="hint">{$t("Empty removes the instance from its group.")}</p>
      {#if groupError}<p role="alert">{groupError}</p>{/if}
      <div class="form-actions"><Button disabled={groupPending} onclick={()=>grouping=null}>{$t("Cancel")}</Button><Button type="submit" tone="accent" disabled={groupPending}>{$t(groupPending?'Saving…':'Save')}</Button></div>
    </form>
  </dialog>
{/if}
{#if instanceMenu && menuInstance}
  {#key menuInstance.id}<InstanceMenu instance={menuInstance} trigger={instanceMenu.trigger} position={instanceMenu.position} state={ui(menuInstance)} {native} onchoose={chooseInstanceAction} onclose={closeInstanceMenu}/>{/key}
{/if}
{#if signingIn || confirm}
  <dialog class="modal" aria-labelledby="modal-title" use:showDialog oncancel={cancelDialog}>
    {#if signingIn}<Icon name="user" size={34}/><h2 id="modal-title">{$t("Sign in using your browser.")}</h2><Button onclick={()=>perform(()=>api.cancelSignIn())}>{$t("Cancel")}</Button>
    {:else if confirm}<h2 id="modal-title">{$t(confirm.kind==='delete'?'Delete {name}?':'Stop {name}?',{name:confirm.name})}</h2><p>{$t(confirm.kind==='delete'?'Deletes this instance and all its local files, including worlds.':'Unsaved game progress may be lost.')}</p><div class="form-actions"><Button onclick={()=>confirm=null}>{$t("Cancel")}</Button><Button tone="danger" onclick={confirmAction}>{$t(confirm.kind==='delete'?'Delete':'Stop')}</Button></div>{/if}
  </dialog>
{/if}

{#if leaveCreation}
  <dialog class="modal" aria-labelledby="leave-creation-title" use:showDialog oncancel={event=>{event.preventDefault();leaveCreation=null;}}>
    <h2 id="leave-creation-title">{$t(creation.pending?'Creating your instance…':'Discard draft?')}</h2>
    <p>{$t(creation.pending?'Wait for creation to finish before leaving.':'Unsaved choices will be lost.')}</p>
    <div class="form-actions"><Button onclick={()=>leaveCreation=null}>{$t("Stay")}</Button><Button tone="danger" disabled={creation.pending} onclick={()=>{const next=leaveCreation!;leaveCreation=null;creation={pending:false,method:'Custom',name:'',version:versions[0]?.id || '',loader:'vanilla',loaderVersion:'',parent:'',pack:null,archive:null,files:[],catalog:[]};select(next,true);}}>{$t("Discard")}</Button></div>
  </dialog>
{/if}

{#if appUpdateDialog}
  <dialog class="modal" aria-label={$t('Chest updates')} use:showDialog oncancel={event=>{event.preventDefault();appUpdateDialog=false;}}>
    <div class="section-heading"><h2>{$t('Chest updates')}</h2><Button class="dialog-close" aria-label={$t('Close updater')} onclick={()=>appUpdateDialog=false}><Icon name="close" size={18}/></Button></div>
    <AppUpdater heading={false}/>
  </dialog>
{/if}
