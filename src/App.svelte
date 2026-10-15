<script lang="ts">
  import UnsavedChangesDialog from './UnsavedChangesDialog.svelte';
  import {NavigationDecisions,type ExitAction} from './navigation-decisions.svelte';
  import {trimLogs} from './log-retention';
  import {createLogBatch} from './log-batch';
  import {layoutOffset,moveToIndex,movedEnough} from './reorder';
  import DirectionIcon from './DirectionIcon.svelte';
  import CopyButton from './CopyButton.svelte';
  import AppUpdater from './AppUpdater.svelte';
  import {appUpdate,initializeUpdater,checkForUpdates} from './app-updater';
  import {subscribeDesktopMenu,translateDesktopMenu,type DesktopMenuAction} from './desktop-menu';
  import {locale,autoUpdateChecks,reduceMotion,defaultInstanceLocation} from './preferences';
  import {currentScheme,appearanceMode} from './themes';
  import {readSettings,beginSettingsEdit,commitSettingsEdit,discardSettingsEdit,restoreDefaultSettings,type SettingsValues} from './settings-edit';
  let appUpdateDialog=$state(false);
  $effect(()=>{const translate=$t;if(native)void translateDesktopMenu(translate).catch(()=>{});});
  import { t } from './i18n';
  import {activityText} from './activity-text';
  import Button from './Button.svelte';
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import HomePage from './HomePage.svelte';
  import {afterFirstPaint} from './startup';
  let createPage:Promise<typeof import('./CreatePage.svelte')>|undefined;
  const loadCreatePage=()=>createPage ??= import('./CreatePage.svelte');
  let instancePage:Promise<typeof import('./InstancePage.svelte')>|undefined;
  const loadInstancePage=()=>instancePage ??= import('./InstancePage.svelte');
  let settingsPage:Promise<typeof import('./SettingsPage.svelte')>|undefined;
  const loadSettingsPage=()=>settingsPage ??= import('./SettingsPage.svelte');
  import type {ResourceLink} from './resource-navigation';
  import {instanceArtwork} from './instance-artwork';
  import InstanceIcon from './InstanceIcon.svelte';
  import SkinFace from './SkinFace.svelte';
  import {isHomeSection} from './home-layout';
  import PageScrollbar from './PageScrollbar.svelte';
  import {launchDraftValue,launchDraftDirty,readLaunchDraft,setLaunchDraft} from './launch-draft';
  import {defaultLaunchSettings} from './types';
  import {createLaunchDraft} from './ui-state';
  import type { LaunchDraft, CreationFormState, LibraryView, SettingsFormState, SettingsTab } from './ui-state';
  import { showDialog } from './dialog';
  import { instanceUI, instanceStatus, type InstanceChoice } from './instance-ui';
  import InstanceMenu from './InstanceMenu.svelte';
  import {get} from 'svelte/store';
  import {doubleClickLaunch} from './preferences';
  import ArtworkImage from './ArtworkImage.svelte';
  import Icon from './Icon.svelte';
  import { api,native,subscribe,subscribeIntent } from './api';
  import { type Activity, type DebugLaunch, type Config, type Content, type Instance, type SidebarGroup, type Tab, type Version } from './types';
  let config=$state<Config>({instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096});
  let exploreTarget=$state('');let exploreKind=$state<import('./types').CatalogKind>('mod');
  let creation=$state<CreationFormState>({pending:false,method:'Custom',name:'',version:'',loader:'vanilla',loaderVersion:'',parent:'',pack:null,archive:null,files:[],catalog:[]});
  let destination=$state('home');let selectedTabs=$state<Record<string,Tab>>({});
  let activities=$state<Record<string,Activity>>({});let logs=$state<Record<string,string[]>>({});let contents=$state<Record<string,Content[]>>({});
  let launchDrafts=$state<Record<string,LaunchDraft>>({});
  let editors=$state<Record<string,Instance>>({});let versions=$state<Version[]>([]);let versionError=$state('');
  let instanceIcons=$state<Record<string,string>>({});
  $effect(()=>instanceArtwork.set(instanceIcons));
  let libraryView=$state<LibraryView>({filter:'',layout:'gallery'});
  let error=$state('');let notice=$state('');let loading=$state(true);let signingIn=$state(false);
  let settingsDraft=$state<SettingsFormState>({pending:false,clientId:'',javaPath:'',memory:4096});
  let settingsTab=$state<SettingsTab>('Accounts');
  let settingsBaseline=$state<SettingsValues|null>(null);
  const decisions=new NavigationDecisions(()=>({destination,settingsTab,settingsDirty,settingsPending:settingsDraft.pending,creationDirty:creationChanged,creationPending:creation.pending,instanceDirty,instancePending:launchDrafts[destination]?.pending,instanceTab:tab}));
  let exitBlocked=$state(false);
  let exitConfirmation=$state<ExitAction|null>(null);
  const settingsValues=$derived<SettingsValues>({memory:settingsDraft.memory,javaPath:settingsDraft.javaPath,locale:$locale,
    autoUpdateChecks:$autoUpdateChecks,doubleClickLaunch:$doubleClickLaunch,reduceMotion:$reduceMotion,
    defaultInstanceLocation:$defaultInstanceLocation,scheme:$currentScheme,mode:$appearanceMode});
  const settingsDirty=$derived(!!settingsBaseline && JSON.stringify(settingsValues)!==JSON.stringify(settingsBaseline));
  function beginSettingsSession(){
    settingsDraft={pending:false,clientId:config.client_id,javaPath:config.java_path,memory:config.memory_mb};
    settingsBaseline=readSettings(config);beginSettingsEdit();
  }
  function discardSettings(){
    if(settingsBaseline)discardSettingsEdit(settingsBaseline);
    settingsBaseline=null;beginSettingsSession();error='';notice='';
  }
  function endSettingsSession(){
    if(settingsBaseline)discardSettingsEdit(settingsBaseline);
    settingsBaseline=null;
  }
  function chooseSettingsTab(next:SettingsTab,completed=false){
    if(!decisions.allow({tab:next},completed))return;
    if(settingsTab==='Settings' && next!=='Settings'){
      endSettingsSession();
    }
    settingsTab=next;
  }
  async function saveSettings(){
    if(settingsDraft.pending)return false;
    settingsDraft.pending=true;let saved=false;
    await perform(async()=>{
      if(!Number.isInteger(settingsDraft.memory) || settingsDraft.memory<512 || settingsDraft.memory>65536)throw new Error('Memory must be between 512 and 65536 MB');
      config=await api.settings(config.client_id,settingsDraft.javaPath,settingsDraft.memory);
      commitSettingsEdit();settingsBaseline=null;beginSettingsSession();notice='Settings saved.';saved=true;
    });
    settingsDraft.pending=false;return saved;
  }
  function restoreSettings(){const defaults=restoreDefaultSettings();settingsDraft.memory=defaults.memory;settingsDraft.javaPath=defaults.javaPath;}
  async function finishSettingsNavigation(save:boolean){
    if(save && !await saveSettings())return;
    const next=decisions.settings;decisions.settings=null;
    if(!next)return;
    if('exit' in next)await finishExit(next.exit);
    else if('tab' in next)chooseSettingsTab(next.tab,true);else if('instanceTab' in next)await selectTab(next.instanceTab,true);else select(next.page,true);
  }
  $effect(()=>{if(!loading && destination==='profile' && settingsTab==='Settings' && !settingsBaseline)beginSettingsSession();});
  let confirm=$state<{kind:'delete'|'stop';id:string;name:string}|null>(null);
  let instanceMenu=$state<{id:string;trigger:HTMLButtonElement;position?:{x:number;y:number}}|null>(null);
  const instancesById=$derived(new Map(config.instances.map(instance=>[instance.id,instance])));
  const menuInstance=$derived(instanceMenu?instancesById.get(instanceMenu.id):undefined);
  const current=$derived(instancesById.get(destination));
  const tab=$derived(selectedTabs[destination] || 'Overview');
  const instanceValues=(instance:Instance)=>JSON.stringify([instance.name,instance.version,instance.loader,instance.loader_version,instance.memory_mb,instance.java_path]);
  const instanceDirty=$derived(!!current && (!!editors[current.id] && instanceValues(editors[current.id])!==instanceValues(current) || launchDraftDirty(launchDrafts[current.id])));
  function restoreInstance(){
    if(!current || busy || launchDrafts[current.id]?.pending)return;
    editors[current.id]={...editors[current.id],memory_mb:config.memory_mb,java_path:config.java_path};
    setLaunchDraft(launchDrafts[current.id],defaultLaunchSettings());
  }
  async function finishInstanceNavigation(save:boolean){
    if(save && !await saveInstance())return;
    const next=decisions.instance;if(!next)return;
    if(!save && current){editors[current.id]={...current};launchDrafts[current.id]=createLaunchDraft();}
    decisions.instance=null;
    if('exit' in next)await finishExit(next.exit);
    else if('instanceTab' in next)await selectTab(next.instanceTab,true);
    else if('tab' in next)chooseSettingsTab(next.tab,true);
    else select(next.page,true);
  }
  let debugLaunch=$state<DebugLaunch>({available:false,enabled:false});
  const account=$derived(debugLaunch.enabled ? {...debugLaunch.account!,name:'ChestDebug (offline debug)'} : config.accounts.find(a=>a.id===config.active_account));
  async function toggleOfflineDebug(){await perform(async()=>{debugLaunch=await api.debugOffline(!debugLaunch.enabled);});}
  const active=$derived(current ? activities[current.id] : undefined);
  const currentUI=$derived(current ? instanceUI(current, active) : undefined);
  const busy=$derived(currentUI?.busy || false);
  function ui(instance:Instance) { return instanceUI(instance, activities[instance.id]); }
  function isBusy(id:string) { const instance=instancesById.get(id);return !!instance && ui(instance).busy; }
  function status(id:string) { return activities[id]?.status || 'idle'; }
  function tabActivity(ids:string[]){
    const issue=ids.some(id=>['crashed','failed','launch_failed'].includes(status(id)));
    const running=ids.some(id=>status(id)==='running');
    return issue && running?'mixed':issue?'issue':running?'running':undefined;
  }
  function statusText(instance:Instance) {return activityText(instanceStatus(instance,activities[instance.id]),$t);}
  async function perform(task:()=>Promise<unknown>,clearFeedback=true) {
    if(clearFeedback){error='';notice='';}
    try{return await task();}
    catch(e){if(clearFeedback || !error)error=String(e instanceof Error?e.message:e);return undefined;}
  }
  async function reload() {
    const pending=new Set(config.instances.filter(i=>i.version==='pending').map(i=>i.id));
    config=await api.config();
    await refreshIcons();
    for(const i of config.instances)if(pending.has(i.id) && i.version!=='pending')editors[i.id]={...i};
  }
  async function refreshIcons() {
    const icons=await api.icons() || {};
    for(const i of config.instances){
      if(i.version==='pending' && instanceIcons[i.id] && !icons[i.id])icons[i.id]=instanceIcons[i.id];
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
  const groupsByMember=$derived.by(()=>{
    const lookup=new Map<string,SidebarGroup>();
    for(const group of groups)for(const id of group.ids)if(!lookup.has(id))lookup.set(id,group);
    return lookup;
  });
  const membersByGroup=$derived.by(()=>{
    const lookup=new Map<string,Instance[]>();
    for(const instance of config.instances){const name=groupsByMember.get(instance.id)?.name;if(!name)continue;const members=lookup.get(name) || [];members.push(instance);lookup.set(name,members);}
    return lookup;
  });
  const dragMembers=$derived(membersByGroup.get(draggedGroup) || []);
  const dragInstance=$derived(instancesById.get(dragged));
  function groupOf(id:string){return groupsByMember.get(id)?.name || '';}
  const sidebarEntries=$derived.by(()=>{
    const entries:({key:string;instance:Instance;group?:never}|{key:string;group:SidebarGroup;instance?:never})[]=[];
    const added=new Set<string>();
    for(const instance of config.instances){
      const group=groupsByMember.get(instance.id);
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
    if(!dragged && !movedEnough(0,event.clientY-gesture.start,6,'y'))return;
    dragged=gesture.id;draggedGroup=gesture.group;
    event.preventDefault();
    reorderAtPointer();
  }
  function hoverForGroup(id:string){groupHover=id;}
  function moveInstance(id:string,target:string,after=false){
    const next=[...config.instances];
    const from=next.findIndex(i=>i.id===id),to=next.findIndex(i=>i.id===target);
    if(from<0 || to<0 || from===to)return;
    const instance=next[from];
    const index=after?next.filter(item=>item!==instance).findIndex(item=>item.id===target)+1:to;
    config.instances=moveToIndex(next,instance,index);
  }
  function reorderAtPointer(){
    if(!gesture || !dragged)return;
    const bounds=rail.getBoundingClientRect();
    gesture.valid=gesture.x>=bounds.left && gesture.x<=bounds.right && gesture.y>=bounds.top-20 && gesture.y<=bounds.bottom;
    dropGroup='';dragOverTarget=false;gesture.empty=false;gesture.atStart=false;
    if(!gesture.valid){hoverForGroup('');return;}
    // Use layout positions rather than animated boxes so moving tabs cannot jitter.
    const y=gesture.y-bounds.top+rail.scrollTop;
    const layoutTop=(element:HTMLElement)=>layoutOffset(element,rail,'y');
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
      const entries=moveToIndex(sidebarEntries,sidebarEntries[from],to);
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
  let resourceLink=$state<ResourceLink|null>(null);
  async function openResource(id:string,tab:'Worlds'|'Servers',item:string){select(id);if(destination===id){await selectTab(tab);if(destination===id && selectedTabs[id]===tab)resourceLink={id,tab,item,key:Date.now()};}}
  function select(id:string,completed=false) {
    if(!decisions.allow({page:id},completed))return;
    if(destination==='profile' && settingsTab==='Settings' && id!=='profile'){
      endSettingsSession();
    }
    if(destination!==id && instancesById.has(id))selectedTabs[id]='Overview';
    if(instancesById.has(id))launchDrafts[id] ??=createLaunchDraft();
    instanceMenu=null;destination=id;error='';notice='';if(instancesById.has(id) && !editors[id]) editors[id]={...instancesById.get(id)!};}
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
    if(choice==='settings' || choice==='console'){select(instance.id);if(destination===instance.id)await selectTab(choice==='settings'?'Settings':'Log');return;}
    if(choice==='delete'){confirm={kind:'delete',id:instance.id,name:instance.name};return;}
    await perform(async()=>{
      if(choice==='shortcut'){await api.shortcut(instance.id);notice='Desktop shortcut created.';}
      if(choice==='folder')await api.folder(instance.id);
      if(choice==='repair')await api.install(instance.id);
      if(choice==='duplicate'){const copy=await api.duplicate(instance.id);await reload();select(copy.id);}
      if(choice==='export' && await api.export(instance.id))notice='Instance exported.';
    });
  }
  async function browseContent(id:string,kind:string) {
    exploreKind=kind==='resourcepacks'?'resourcepack':kind==='shaderpacks'?'shader':'mod';
    exploreTarget=id;select('explore');
  }
  async function refreshContent(id:string){await perform(async()=>{contents[id]=await api.content(id);});}
  async function refreshLogs(id:string){await perform(async()=>{logs[id]=await api.logs(id);});}
  async function toggleContent(instance:Instance,file:Content){
    if(ui(instance).busy)return;
    const id=instance.id;
    await perform(async()=>{await api.toggle(id,file.kind,file.name);contents[id]=await api.content(id);});
  }
  async function acknowledge(id:string){await perform(async()=>{await api.acknowledge(id);delete activities[id];});}
  async function selectTab(next:Tab,completed=false) {
    if(!decisions.allow({instanceTab:next},completed))return;
    const id=destination;
    selectedTabs[id]=next;
    if(next==='Content')await refreshContent(id);
    if(next==='Log')await refreshLogs(id);
  }
  async function loadVersions(){versionError='';try{versions=await api.versions();if(!creation.version)creation.version=versions[0]?.id || '';}catch(e){versionError=String(e);}}
  async function instanceCreated(instance:Instance,icon?:string|null){
    if(!config.instances.some(i=>i.id===instance.id))config.instances.push(instance);
    if(icon)instanceIcons[instance.id]=icon;
    decisions.creation=null;select(instance.id,true);void perform(reload);
  }
  async function action(instance:Instance){await perform(async()=>{
    switch(ui(instance).command){
      case 'pause': await api.pause(instance.id,true);break;
      case 'resume': await api.pause(instance.id,false);break;
      case 'stop': confirm={kind:'stop',id:instance.id,name:instance.name};break;
      case 'install': await api.install(instance.id);break;
      case 'launch': {const options=await api.launchSettings(instance.id);await api.launch(instance.id);if(options.open_log){select(instance.id);if(destination===instance.id)await selectTab('Log');}break;}
    }
  });}
  async function doubleClick(instance:Instance){if(get(doubleClickLaunch) && !ui(instance).busy)await action(instance);}
  async function saveInstance(){
    if(!current || busy || currentUI?.pending)return false;
    const id=current.id,state=launchDrafts[id];
    if(state?.pending || (tab==='Settings' && !state?.loaded))return false;
    if(state)state.pending=true;
    let saved=false;
    await perform(async()=>{
      const instance={...editors[id]};
      if(!instance.name.trim() || instance.name.length>120)throw new Error('Name is required.');
      if(!Number.isInteger(instance.memory_mb) || instance.memory_mb<512 || instance.memory_mb>65536)throw new Error('Memory must be between 512 and 65536 MB');
      const settings=state?.loaded?readLaunchDraft(state):undefined;
      if(settings && (!Number.isInteger(settings.width) || settings.width<320 || settings.width>16384 || !Number.isInteger(settings.height) || settings.height<240 || settings.height>16384))throw new Error('Window size must be between 320 × 240 and 16384 × 16384');
      config=await api.save(instance,settings);
      editors[id]={...config.instances.find(i=>i.id===id)!};
      if(state && settings){setLaunchDraft(state,settings);state.baseline=launchDraftValue(state);}
      notice='Instance saved.';saved=true;
    });
    if(state)state.pending=false;
    return saved;
  }

  async function confirmAction(){if(!confirm)return;const choice=confirm;confirm=null;await perform(async()=>{
    if(choice.kind==='stop')await api.stop(choice.id);
    else {config=await api.remove(choice.id);delete activities[choice.id];delete selectedTabs[choice.id];delete editors[choice.id];delete launchDrafts[choice.id];delete logs[choice.id];delete contents[choice.id];select('home');}
  });}
  async function signIn(){signingIn=true;await perform(async()=>{await api.signIn();await reload();});signingIn=false;}
  function cancelDialog(event:Event){event.preventDefault();if(signingIn)void perform(()=>api.cancelSignIn());else confirm=null;}
  async function handleIntent(){if(!native)return;await perform(async()=>{const intent=await api.takeIntent();if(!intent)return;const instance=config.instances.find(i=>i.id===intent.id);if(!instance)return;select(instance.id);if(destination===instance.id && intent.launch && instance.installed && !ui(instance).busy)await action(instance);});}
  async function finishExit(action:ExitAction,confirmed=false){
    if(busy || Object.values(activities).some(activity=>activity.status==='working') || signingIn || settingsDraft.pending || creation.pending || Object.values(launchDrafts).some(draft=>draft.pending) || ['downloading','installing'].includes($appUpdate.phase)){
      exitBlocked=true;return;
    }
    if(!confirmed && action!=='restart' && Object.values(activities).some(activity=>['running','starting','installing','paused','pausing'].includes(activity.status))){
      exitConfirmation=action;return;
    }
    endSettingsSession();
    await perform(()=>action==='restart'?api.restartUpdatedApp():api.completeExit(action));
  }
  function requestExit(action:ExitAction){
    if(!decisions.allow({exit:action}))return;
    void finishExit(action);
  }
  function handleDesktopMenu(action:DesktopMenuAction){
    if(action==='close' || action==='quit' || action==='restart'){
      if(!document.querySelector('dialog[open]') || action==='restart')requestExit(action);
      return;
    }
    if(loading || document.querySelector('dialog[open]'))return;
    switch(action){
      case 'settings':case 'about':select('profile');if(destination==='profile')chooseSettingsTab(action==='about'?'About':'Settings');break;
      case 'updates':appUpdateDialog=true;void checkForUpdates();break;
      case 'issues':void perform(()=>api.projectLink('issues'));break;
      case 'data-folder':void perform(()=>api.dataFolder());break;
      case 'create':case 'home':case 'instances':case 'servers':case 'worlds':case 'news':case 'screenshots':case 'explore':select(action);break;
    }
  }
  onMount(()=>{
    const logBatch=createLogBatch(pendingLogs=>{
      for(const [id,lines] of pendingLogs)if(instancesById.has(id))logs[id]=[...(logs[id] || []),...lines].slice(-2000);
      trimLogs(logs,[...pendingLogs.keys()]);
    });
    reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanup=()=>{};let cleanupIntent=()=>{};let cleanupMenu=()=>{};let alive=true;
    void subscribeDesktopMenu(handleDesktopMenu,message=>{if(alive)error=message;}).then(stop=>{if(alive)cleanupMenu=stop;else stop();}).catch(e=>{if(alive)error=String(e);});
    let cancelBackground=()=>{};
    performance.mark('chest:startup');
    (async()=>{try{
      // Install listeners before taking the activity snapshot. Events observed
      // during that snapshot win over its potentially older values.
      let observed:Set<string>|null=new Set();
      const listening=subscribe(a=>{observed?.add(a.id);activities[a.id]=a;if(['idle','crashed'].includes(a.status) || a.phase==='Modpack prepared')void perform(reload,false);},logBatch.push).then(stop=>{
        if(!alive)stop();else cleanup=stop;
      });
      const configuration=api.config();
      const debug=api.debugLaunch();
      const snapshot=listening.then(()=>api.activities());
      const [next,initial,offline]=await Promise.all([configuration,snapshot,debug]);
      if(!alive)return;
      config=next;debugLaunch=offline || {available:false,enabled:false};
      for(const a of initial)if(!observed?.has(a.id))activities[a.id]=a;
      observed=null;
      settingsDraft={pending:false,clientId:config.client_id,javaPath:config.java_path,memory:config.memory_mb};
      loading=false;
      performance.mark('chest:library-ready');
      if((window as Window & {__CHEST_STARTUP_TRACE__?:boolean}).__CHEST_STARTUP_TRACE__){
        await tick();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(alive)void api.reportStartupReady().catch(()=>{});}));
      }
      // Icons, manifests, discovery and update checks must not hold the first
      // usable frame hostage. Metadata failures leave the library usable.
      cancelBackground=afterFirstPaint(()=>{
        if(!alive)return;
        void refreshIcons().catch(e=>{if(alive)error=String(e);});void loadVersions();void initializeUpdater();
      });
      cleanupIntent=await subscribeIntent(()=>{void handleIntent();});
      if(!alive){cleanupIntent();return;}
      await handleIntent();
    }catch(e){if(alive){error=String(e);loading=false;}}})();
    return ()=>{alive=false;endSettingsSession();cancelBackground();logBatch.dispose();cleanup();cleanupIntent();cleanupMenu();hoverForGroup('');};
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
          {@const members=membersByGroup.get(entry.group.name) || []}
          <div class:group-shell={!entry.group.collapsed} class:group-drop-target={dropGroup===entry.group.name} data-drop-group={entry.group.name}>
          <Button shape="rail" class={['rail-group',entry.group.collapsed?'group-collapsed':'group-expanded']} selected={entry.group.collapsed && entry.group.ids.includes(destination)} data-activity={entry.group.collapsed?tabActivity(entry.group.ids):undefined} data-group-name={entry.group.name} title={$t(members.length===1?'{name} · {count} instance':'{name} · {count} instances',{name:entry.group.name,count:members.length})} aria-label={$t('{name} group',{name:entry.group.name})} data-count={members.length} aria-describedby={`group-count-${encodeURIComponent(entry.group.name)}`} aria-current={entry.group.collapsed && entry.group.ids.includes(destination)?'page':undefined} aria-expanded={!entry.group.collapsed} onpointerdown={event=>beginReorder(event,entry.group!.ids[0],entry.group!.name)} onclick={()=>{if(!suppressClick)void toggleGroup(entry.group!);}}>
            <span class="group-count-description" id={`group-count-${encodeURIComponent(entry.group.name)}`}>{$t(members.length===1?'{count} instance':'{count} instances',{count:members.length})}{tabActivity(entry.group.ids)==='mixed'?' · '+$t('Contains running instances and instances with issues'):tabActivity(entry.group.ids)==='issue'?' · '+$t('Contains an instance with an issue'):tabActivity(entry.group.ids)==='running'?' · '+$t('Contains a running instance'):''}</span>
            {#if entry.group.collapsed}
              <span class="group-mosaic" aria-hidden="true">
                {#each members.slice(0,members.length>4?3:4) as member (member.id)}
                  <span class="group-member-icon" data-member-id={member.id} data-activity={tabActivity([member.id])}><ArtworkImage source={instanceIcons[member.id]}/></span>
                {/each}
                {#if members.length>4}<span class="group-overflow group-member-icon" data-activity={tabActivity(members.slice(3).map(member=>member.id))}>+{members.length-3}</span>{/if}
              </span>
            {:else}
              <DirectionIcon direction="up" compact/>
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
    <Button shape="rail" class="rail-button profile" selected={destination==='profile'} aria-label={$t("Settings")} title={$t("Settings")} onclick={()=>select('profile')}><SkinFace {account} size={32}/></Button>
  </aside>

  <main id="main-content" tabindex="-1">
    {#if $appUpdate.info?.version}<div class="notification"><span>{$t($appUpdate.phase==='ready'?'Restart Chest to finish updating.':'Chest update available')}: {$appUpdate.info.version}</span><Button onclick={()=>appUpdateDialog=true}>{$t($appUpdate.phase==='ready'?'Restart':'Update')}</Button></div>{/if}
    {#if error}<div class="notification error" role="alert"><span>{$t(error)}</span><CopyButton text={$t(error)}/><Button class="icon-button" aria-label={$t("Dismiss error")} onclick={()=>error=''}><Icon name="close" size={16}/></Button></div>{/if}
    {#if notice}<div class="notification" role="status">{$t(notice)}<Button class="icon-button" aria-label={$t("Dismiss notification")} onclick={()=>notice=''}><Icon name="close" size={16}/></Button></div>{/if}
    <div class="page">
    {#if loading}<div class="empty"><Icon name="chest" size={42}/><h2>{$t("Opening Chest…")}</h2></div>
    {:else if destination==='home' || isHomeSection(destination)}
      <HomePage page={isHomeSection(destination)?destination:null} {config} onconfig={value=>config=value} onnavigate={select} onmenu={openInstanceMenu} onmenukeys={instanceMenuKeys} menuId={instanceMenu?.id} icons={instanceIcons} {versions} bind:view={libraryView}
        bind:target={exploreTarget} bind:kind={exploreKind} {statusText} oncreate={()=>select('create')} onselect={select} onresource={openResource}
        ondoubleclick={doubleClick} oncreated={instanceCreated} onpackselected={pack=>{creation={...creation,method:'Modpacks',pack,name:'',archive:null,files:[],catalog:[]};select('create');}} {isBusy} onadded={id=>{void refreshContent(id);}}/>
    {:else if destination==='create'}
      {#await loadCreatePage()}<p role="status">{$t("Loading…")}</p>{:then {default:CreatePage}}
      <CreatePage bind:draft={creation} instances={config.instances} {versions} {versionError}
        onretry={loadVersions} oncreated={instanceCreated} {isBusy} {perform}/>
      {:catch}<p role="alert">{$t("Could not load page")} <Button onclick={()=>window.location.reload()}>{$t("Retry")}</Button></p>{/await}
    {:else if current}
      {#await loadInstancePage()}<p role="status">{$t("Loading…")}</p>{:then {default:InstancePage}}
      <InstancePage resourceLink={resourceLink?.id===current.id?resourceLink:null} bookmarks={config.server_bookmarks} onconfig={value=>config=value} instances={config.instances} {isBusy} bind:launchDraft={launchDrafts[current.id]} accounts={config.accounts} {current} bind:editor={editors[current.id]} {active} {tab} dirty={instanceDirty} onrestore={restoreInstance}
        source={instanceIcons[current.id]} {versions} content={contents[current.id]} output={logs[current.id]}
        onchoose={choice=>instanceAction(current!,choice)} onselectTab={selectTab}
        onbrowse={kind=>browseContent(current!.id,kind)} onsave={saveInstance}
        onacknowledge={()=>acknowledge(current!.id)} ontoggle={file=>toggleContent(current!,file)}
        onrefresh={()=>refreshLogs(current!.id)} onrefreshContent={()=>refreshContent(current!.id)}/>
      {:catch}<p role="alert">{$t("Could not load page")} <Button onclick={()=>window.location.reload()}>{$t("Retry")}</Button></p>{/await}
    {:else if destination==='profile'}
      {#await loadSettingsPage()}<p role="status">{$t("Loading…")}</p>{:then {default:SettingsPage}}
      <SettingsPage {debugLaunch} ontoggleOffline={toggleOfflineDebug} {config} bind:draft={settingsDraft} tab={settingsTab} onselectTab={chooseSettingsTab}
        dirty={settingsDirty} onsave={saveSettings} ondiscard={discardSettings} onrestore={restoreSettings} {signingIn} onsignin={signIn}
        onconfig={next=>config=next} onnotice={message=>notice=message} {perform}/>
      {:catch}<p role="alert">{$t("Could not load page")} <Button onclick={()=>window.location.reload()}>{$t("Retry")}</Button></p>{/await}
    {/if}
    </div>
  </main>
</div>
<PageScrollbar/>
{#if dragInstance || draggedGroup}
  {#if groupReady}<div class="group-drop-hint" role="status" style:top={`${dragY+34}px`}>{$t("Release to create group")}</div>{/if}
  <div class="rail-drag-preview" class:over-target={dragOverTarget} style:top={`${dragY}px`} aria-hidden="true">{#if draggedGroup}<span class="group-mosaic">{#each dragMembers.slice(0,dragMembers.length>4?3:4) as member (member.id)}<span class="group-member-icon" data-member-id={member.id} data-activity={tabActivity([member.id])}><ArtworkImage source={instanceIcons[member.id]}/></span>{/each}{#if dragMembers.length>4}<span class="group-overflow group-member-icon" data-activity={tabActivity(dragMembers.slice(3).map(member=>member.id))}>+{dragMembers.length-3}</span>{/if}</span>{:else if dragInstance}<ArtworkImage source={instanceIcons[dragInstance.id]}/>{/if}</div>
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
    {:else if confirm}<h2 id="modal-title"><InstanceIcon id={confirm.id} size={24}/> {$t(confirm.kind==='delete'?'Delete {name}?':'Stop {name}?',{name:confirm.name})}</h2><p>{$t(confirm.kind==='delete'?'Deletes this instance and all its local files, including worlds.':'Unsaved game progress may be lost.')}</p><div class="form-actions"><Button onclick={()=>confirm=null}>{$t("Cancel")}</Button><Button tone="danger" onclick={confirmAction}>{$t(confirm.kind==='delete'?'Delete':'Stop')}</Button></div>{/if}
  </dialog>
{/if}

{#if decisions.creation}
  <UnsavedChangesDialog title={creation.pending?'Creating your instance…':'Discard draft?'} description={creation.pending?'Wait for creation to finish before leaving.':'Unsaved choices will be lost.'}
    pending={creation.pending} oncancel={()=>decisions.creation=null} ondiscard={()=>{
      const next=decisions.creation!;decisions.creation=null;
      creation={pending:false,method:'Custom',name:'',version:versions[0]?.id || '',loader:'vanilla',loaderVersion:'',parent:'',pack:null,archive:null,files:[],catalog:[]};
      if('page' in next)select(next.page,true);else void finishExit(next.exit);
    }}/>
{/if}
{#if decisions.instance}
  <UnsavedChangesDialog title="Save settings changes?" {error} pending={launchDrafts[destination]?.pending || false} lockCancel
    oncancel={()=>decisions.instance=null} ondiscard={()=>finishInstanceNavigation(false)} onsave={()=>finishInstanceNavigation(true)}/>
{/if}
{#if decisions.settings}
  <UnsavedChangesDialog title="Save settings changes?" {error} pending={settingsDraft.pending} lockCancel
    oncancel={()=>decisions.settings=null} ondiscard={()=>finishSettingsNavigation(false)} onsave={()=>finishSettingsNavigation(true)}/>
{/if}

{#if appUpdateDialog}
  <dialog class="modal" aria-label={$t('Chest updates')} use:showDialog oncancel={event=>{event.preventDefault();appUpdateDialog=false;}}>
    <div class="section-heading"><h2>{$t('Chest updates')}</h2><Button class="dialog-close" aria-label={$t('Close updater')} onclick={()=>appUpdateDialog=false}><Icon name="close" size={18}/></Button></div>
    <AppUpdater heading={false}/>
  </dialog>
{/if}

{#if exitBlocked}
  <dialog class="modal" aria-labelledby="exit-blocked-title" use:showDialog oncancel={event=>{event.preventDefault();exitBlocked=false;}}>
    <h2 id="exit-blocked-title">{$t('Wait for the current operation to finish.')}</h2>
    <Button onclick={()=>exitBlocked=false}>{$t('Cancel')}</Button>
  </dialog>
{/if}

{#if exitConfirmation}
  <dialog class="modal" aria-labelledby="exit-confirmation-title" use:showDialog oncancel={event=>{event.preventDefault();exitConfirmation=null;}}>
    <h2 id="exit-confirmation-title">{$t(exitConfirmation==='quit'?'Quit Chest':'Close Chest?')}</h2>
    <p>{$t('Installations will stop. Running games will remain open.')}</p>
    <div class="form-actions"><Button onclick={()=>exitConfirmation=null}>{$t('Cancel')}</Button><Button tone="danger" onclick={()=>{const action=exitConfirmation!;exitConfirmation=null;void finishExit(action,true);}}>{$t(exitConfirmation==='quit'?'Quit Chest':'Close')}</Button></div>
  </dialog>
{/if}
