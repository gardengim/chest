<script lang="ts">
  import Message from './Message.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import InstanceName from './InstanceName.svelte';
  import ContentCollection, {type ContentEntry} from './ContentCollection.svelte';
  import {defaultInstanceLocation} from './preferences';
  import { t } from './i18n';
  import { showDialog } from './dialog';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import Explore from './Explore.svelte';
  import Tabs from './Tabs.svelte';
  import LoaderPicker from './LoaderPicker.svelte';
  import Icon from './Icon.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import { api, native } from './api';
  import { loaderLabel, type Instance, type Version } from './types';
  import type { CreationFormState, Perform } from './ui-state';

  let { draft=$bindable(), instances, versions, versionError, onretry, oncreated, isBusy, perform }: {
    draft: CreationFormState; instances: Instance[]; versions: Version[]; versionError: string;
    onretry: ()=>void; oncreated: (instance:Instance,icon?:string|null)=>Promise<void>;
    isBusy: (id:string)=>boolean; perform: Perform;
  } = $props();
  let loaderReady=$state(false);
  let choosing=$state(false);
  let browseContent=$state(false);
  let changePack=$state(false);
  let contentKind=$state<'mods'|'resourcepacks'|'shaderpacks'>('mods');
  const defaultName=$derived(draft.method==='Modpacks'?draft.pack?.title || 'Modpack':draft.method==='Import'?draft.archive?.instance.name || 'Imported instance':`${loaderLabel(draft.loader)} ${draft.version}`.trim());
  const sourceReady=$derived(draft.method==='Custom'?!!draft.version && loaderReady:draft.method==='Modpacks'?!!draft.pack:!!draft.archive);
  const contentInstance=$derived<Instance>(draft.method==='Import' && draft.archive?{...draft.archive.instance,id:'creation',name:defaultName}:{id:'creation',name:defaultName,version:draft.version,loader:draft.loader,loader_version:draft.loaderVersion,installed:false,artwork:'grass',java_path:'',memory_mb:4096});
  const filename=(path:string)=>path.split(/[\\/]/).pop() || path;
  async function choose(action:()=>Promise<void>) {
    if(choosing || draft.pending)return;
    choosing=true;
    try{await perform(action);}finally{choosing=false;}
  }
  async function addFiles(){
    const paths=await api.chooseCreationFiles();
    for(const path of paths)if(!draft.files.some(f=>f.path===path && f.kind===contentKind))draft.files.push({path,kind:contentKind,enabled:true});
  }
  async function create(){
    if(draft.pending || !sourceReady)return;
    draft.pending=true;
    try{
      await perform(async()=>{
        const icon=draft.method==='Modpacks'?draft.pack?.icon:undefined;
        const instance=await api.createWizard({name:draft.name,default_name:defaultName,version:draft.version,loader:draft.loader,loader_version:draft.loaderVersion,parent:draft.parent.trim() || $defaultInstanceLocation.trim(),archive:draft.method==='Import'?draft.archive!.path:null,pack:draft.method==='Modpacks'?draft.pack:null,files:draft.files,catalog:draft.catalog});
        draft.name='';draft.loader='vanilla';draft.loaderVersion='';draft.parent='';draft.pack=null;draft.archive=null;draft.files=[];draft.catalog=[];draft.method='Custom';
        await oncreated(instance,icon);
      });
    }finally{draft.pending=false;}
  }
</script>

<div class="page-title creation-title"><h1>{$t("New instance")}</h1></div>
<div class="instance-toolbar creation-toolbar">
  <Tabs options={['Custom','Modpacks','Import'] as const} value={draft.method} prefix="create" label={$t("Instance creation methods")} onchange={method=>{if(!draft.pending && !choosing)draft.method=method;}}/>
</div>
<form class="instance-content creation-content creation-form" onsubmit={event=>{event.preventDefault();void create();}}>
  <fieldset disabled={draft.pending || choosing}>
    <div id="create-panel-Custom" role="tabpanel" aria-labelledby="create-tab-Custom" hidden={draft.method!=='Custom'} class="custom-instance creation-section">
      <h2>{$t("Game and mod loader")}</h2>
      <div class="creation-fields">
        <label>{$t("Minecraft version")}<Select bind:value={draft.version} disabled={!versions.length}>
          {#if !versions.length}<option value="">{$t("Loading versions…")}</option>{/if}
          {#each versions as version}<option value={version.id}>{version.id}</option>{/each}
        </Select></label>
        <LoaderPicker gameVersion={draft.version} bind:loader={draft.loader} bind:loaderVersion={draft.loaderVersion} bind:ready={loaderReady}/>
        {#if versionError}<Message tone="error" text={versionError} actions={[{label:$t('Retry'),onclick:onretry}]}/>{/if}
      </div>
    </div>
    {#if draft.method==='Modpacks'}
      <div id="create-panel-Modpacks" role="tabpanel" aria-labelledby="create-tab-Modpacks" class="creation-section">
        <div class="section-heading"><div class="selected-pack">{#if draft.pack}<ArtworkImage source={draft.pack.icon} fallback="none"/>{/if}<div><h2>{draft.pack?.title || $t('Modpack')}</h2>{#if draft.pack}<p>{draft.pack.releaseName}</p>{/if}</div></div><Button onclick={()=>changePack=true}>{$t("Choose")}</Button></div>
      </div>
    {/if}
    {#if draft.method==='Import'}
      <div id="create-panel-Import" role="tabpanel" aria-labelledby="create-tab-Import" class="creation-section">
        <h2>{$t("Chest archive")}</h2>
        <Button disabled={!native} onclick={()=>choose(async()=>{const archive=await api.chooseArchive();if(archive)draft.archive=archive;})}><Icon name="folder" size={17}/>{$t("Choose")}</Button>
        {#if draft.archive}<p class="creation-selection"><InstanceName instance={draft.archive.instance}/><span class="hint folder-path">{draft.archive.path}</span></p>{/if}
        {#if !native}<p class="hint">{$t("Desktop app required.")}</p>{/if}
      </div>
    {/if}
    <section class="creation-section" aria-labelledby="creation-content-title">
      <h2 id="creation-content-title">{$t("Contents")}</h2>

      <ContentCollection onadd={kind=>{contentKind=kind as typeof contentKind;browseContent=true;}} prefix="creation-content" entries={[
        ...draft.files.map((file,index)=>({id:`local:${index}`,name:filename(file.path),kind:file.kind,enabled:file.enabled,removable:true})),
        ...draft.catalog.map((content,index)=>({id:`catalog:${index}`,name:content.title,icon:content.icon,background:content.background,kind:({mod:'mods',resourcepack:'resourcepacks',shader:'shaderpacks',modpack:'modpacks'})[content.kind],subtitle:`${content.source==='modrinth'?'Modrinth':'CurseForge'} · ${content.releaseName}`,enabled:content.enabled,removable:true}))
      ]} onremove={(entry:ContentEntry)=>{const [source,index]=entry.id.split(':');if(source==='local')draft.files.splice(Number(index),1);else draft.catalog.splice(Number(index),1);}}/>

    </section>
    <section class="creation-section" aria-labelledby="creation-setup-title">
      <h2 id="creation-setup-title">{$t("Instance details")}</h2>
      <div class="creation-setup-fields">
        <label>{$t("Instance name")}<input aria-label={$t("Instance name")} bind:value={draft.name} placeholder={defaultName} maxlength={120}/></label>
        <div><label for="creation-location">{$t("Instance location")}</label><div class="creation-location-row"><input id="creation-location" aria-label={$t("Instance location")} bind:value={draft.parent} placeholder={$defaultInstanceLocation || $t("Default Chest instance folder")} disabled={!native}/><Button disabled={!native} onclick={()=>choose(async()=>{const parent=await api.chooseLocation();if(parent)draft.parent=parent;})}><Icon name="folder" size={17}/>{$t("Browse")}</Button></div>{#if draft.parent}<Button shape="plain" onclick={()=>draft.parent=''}>{$t("Reset")}</Button>{/if}</div>
      </div>
    </section>
  </fieldset>
  <div class="creation-submit"><Button type="submit" tone="accent" disabled={draft.pending || choosing || !sourceReady}>{$t(draft.pending?'Creating…':'Create')}<DirectionIcon direction="right"/></Button></div>
</form>

{#if changePack}
  <dialog class="modal creation-picker" aria-label={$t("Choose a modpack")} use:showDialog oncancel={event=>{event.preventDefault();changePack=false;}}>
    <div class="section-heading"><h2>{$t("Modpacks")}</h2><Button class="dialog-close" aria-label={$t("Close modpack browser")} onclick={()=>changePack=false}><Icon name="cross" size={18}/></Button></div>
    <Explore compact mode="modpacks" {instances} {versions} {isBusy} onadded={()=>{}} onpackselected={pack=>{draft.pack=pack;changePack=false;}}/>
  </dialog>
{/if}
{#if browseContent}
  <dialog class="modal creation-picker" aria-label={$t("Add content")} use:showDialog oncancel={event=>{event.preventDefault();browseContent=false;}}>
    <div class="section-heading"><h2>{$t("Contents")}</h2><Button class="dialog-close" aria-label={$t("Close content browser")} onclick={()=>browseContent=false}><Icon name="cross" size={18}/></Button></div>
    <div class="creation-file-controls"><label>{$t("File type")}<Select bind:value={contentKind}><option value="mods">{$t("Mods")}</option><option value="resourcepacks">{$t("Resource packs")}</option><option value="shaderpacks">{$t("Shaders")}</option></Select></label><Button disabled={!native || choosing} onclick={()=>choose(async()=>{await addFiles();browseContent=false;})}><Icon name="folder" size={17}/>{$t("Choose file")}</Button></div>
    {#if draft.method==='Modpacks'}<p class="hint">{$t("Match your modpack’s version and loader.")}</p><div class="creation-fields"><label>{$t("Content game version")}<Select bind:value={draft.version}>{#each versions as version}<option value={version.id}>{version.id}</option>{/each}</Select></label><LoaderPicker gameVersion={draft.version} bind:loader={draft.loader} bind:loaderVersion={draft.loaderVersion}/></div>{/if}
    <Explore compact showTabs={false} kind={contentKind==='mods'?'mod':contentKind==='resourcepacks'?'resourcepack':'shader'} included={draft.catalog} allowModpacks={false} instances={[contentInstance]} {versions} target="creation" isBusy={()=>false} onadded={()=>{}} oncontentselected={content=>{const index=draft.catalog.findIndex(item=>item.source===content.source && item.project===content.project);if(index<0)draft.catalog.push(content);else draft.catalog[index]=content;browseContent=false;}}/>
  </dialog>
{/if}
