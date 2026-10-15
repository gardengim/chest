<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import SettingsGroup from './SettingsGroup.svelte';
  import {untrack} from 'svelte';
  import { t } from './i18n';
  import {activityText} from './activity-text';
  import InstanceFilesView from './InstanceFiles.svelte';
  import CopyButton from './CopyButton.svelte';
  import ContentCollection from './ContentCollection.svelte';
  import {createLaunchDraft,type LaunchDraft} from './ui-state';
  import type {ResourceLink} from './resource-navigation';
  import LaunchSettings from './LaunchSettings.svelte';
  import News from './News.svelte';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import ScreenshotBackdrop from './ScreenshotBackdrop.svelte';
  import InstanceBrief from './InstanceBrief.svelte';
  import Tabs from './Tabs.svelte';
  import RuntimeFields from './RuntimeFields.svelte';
  import LoaderPicker from './LoaderPicker.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import Icon from './Icon.svelte';
  import { api, native } from './api';
  import { instanceUI, instanceStatus, type InstanceChoice } from './instance-ui';
  import { loaderLabel, tabs, type Activity, type Account, type Config, type Content, type Instance, type InstanceFiles, type Tab, type Version } from './types';

  let { resourceLink=null,current, editor=$bindable(), launchDraft=$bindable(createLaunchDraft()), active, tab, accounts=[], source, versions, content=[], output=[],
    onchoose, onselectTab, onbrowse, onsave, onacknowledge, ontoggle, onrefresh, onrefreshContent, instances=[], isBusy=()=>false, onconfig, bookmarks=[], onrestore, dirty=false }: {
    resourceLink?:ResourceLink|null;onconfig?:(config:Config)=>void;bookmarks?:import('./types').ServerBookmark[];instances?:Instance[];isBusy?:(id:string)=>boolean;current: Instance; editor: Instance; launchDraft?:LaunchDraft; active?: Activity; tab: Tab; accounts?:Account[];
    source?: string; versions: Version[]; content?: Content[]; output?: string[];
    onchoose: (choice:InstanceChoice)=>void; onselectTab: (tab:Tab)=>void;
    onbrowse: (kind:string)=>void; onsave: ()=>void; onacknowledge: ()=>void;
    ontoggle: (file:Content)=>void; onrefresh: ()=>void; onrefreshContent: ()=>Promise<unknown>; onrestore: ()=>void;dirty?:boolean;
  } = $props();
  let logSearch=$state('');
  const logQuery=$derived(logSearch.trim().toLocaleLowerCase());
  const filteredOutput=$derived(logQuery?output.filter(line=>line.toLocaleLowerCase().includes(logQuery)):output);
  let folderPath=$state('');
  let folderError=$state('');
  const instanceId=$derived(current.id);
  $effect(()=>{void instanceId;logSearch='';});
  $effect(()=>{
    const id=instanceId;
    let alive=true;
    folderPath='';folderError='';
    void api.folderPath(id).then(path=>{if(alive)folderPath=path || '';}).catch(()=>{if(alive)folderError='Could not read the instance folder path.';});
    return()=>{alive=false;};
  });
  let files=$state<InstanceFiles>({worlds:[],servers:[],screenshots:[]});
  let fileError=$state('');let filesId='';
  let refreshPending=$state(false);
  async function refreshFiles(){refreshPending=true;fileError='';const id=current.id;try{const value=await api.instanceFiles(id);if(current.id===id)files=value;}catch(e){if(current.id===id)fileError=String(e);}finally{refreshPending=false;}}
  const activityStatus=$derived(active?.status);
  $effect(()=>{const id=instanceId;void activityStatus;let alive=true;untrack(()=>{if(filesId!==id){filesId=id;files={worlds:[],servers:[],screenshots:[]};}fileError='';});
    void api.instanceFiles(id).then(value=>{if(alive)files=value;}).catch(e=>{if(alive)fileError=String(e);});return()=>{alive=false;};});
  const instanceTabs=$derived([...tabs.slice(0,2),...(files.worlds.length || tab==='Worlds'?['Worlds' as const]:[]),...(files.servers.length || tab==='Servers'?['Servers' as const]:[]),...(files.screenshots.length || tab==='Screenshots'?['Screenshots' as const]:[]),...tabs.slice(2)]);
  let editLoaderReady=$state(false);
  const currentUI=$derived(instanceUI(current,active));
  const busy=$derived(currentUI.busy);
  const latestRelease=$derived(versions.find(version=>version.type==='release'));
  const newerRelease=$derived(!!latestRelease && versions.findIndex(version=>version.id===current.version)>versions.findIndex(version=>version.id===latestRelease.id));
  let loaderUpdate=$state('');
  const gameVersion=$derived(current.version),loader=$derived(current.loader),loaderVersion=$derived(current.loader_version);
  $effect(()=>{
    const version=gameVersion,kind=loader,installed=loaderVersion;let alive=true;loaderUpdate='';
    if(version!=='pending' && kind!=='vanilla'){
      const request=api.loaderVersions(version,kind);
      void request.then(list=>{const latest=list?.[0];if(alive && latest && list.includes(installed) && list.indexOf(installed)>0)loaderUpdate=latest;}).catch(()=>{});
    }
    return()=>{alive=false;};
  });
</script>

<div class="instance-scene">
<ScreenshotBackdrop id={current.id}/>
<section class="instance-hero">
  <div class="instance-art">
    <ArtworkImage source={source}/>
  </div>
  <div>
    <h1><bdi>{current.name}</bdi></h1>
    <InstanceBrief instance={current}/>
    <p class="instance-summary">{activityText(instanceStatus(current,active),$t)}</p>
  </div>
</section>
<div class="instance-toolbar">
  <Button tone="accent" class="install-button" disabled={currentUI.transitional} onclick={()=>onchoose('action')}>
    <span class="button-label">
      <Icon name={currentUI.icon} size={18}/>{$t(currentUI.label,currentUI.labelValues)}</span>
    <span class="button-hover">
      <Icon name={currentUI.actionIcon} size={18}/>{$t(currentUI.actionLabel)}</span>
    {#if currentUI.showProgress}
      <span class="button-progress" style:width={`${(active?.progress || 0)*100}%`}>
      </span>
    {/if}
  </Button>
  <Tabs labels={{Content:'Contents'}} options={instanceTabs} value={tab} prefix="instance" label={$t("Instance pages")} onchange={onselectTab}/>
</div>
<div class="instance-content" id={`instance-panel-${tab}`} role="tabpanel" aria-labelledby={`instance-tab-${tab}`}>
  {#if active && ['crashed','failed','launch_failed'].includes(active.status)}
    <div class="crash-notice">
      <div>
        <strong>{$t(active.status==='crashed'?'Minecraft stopped unexpectedly.':active.status==='launch_failed'?'Minecraft could not start.':'Installation failed. Try again.')}</strong>
        <p>{active.phase}</p>
      </div>
      <CopyButton text={`${$t(active.status==='crashed'?'Minecraft stopped unexpectedly.':active.status==='launch_failed'?'Minecraft could not start.':'Installation failed. Try again.')}\n${active.phase}`}/>
      <Button onclick={()=>onselectTab('Log')}>{$t("Log")}</Button>
      <Button class="icon-button" aria-label={$t("Acknowledge error")} onclick={onacknowledge}>
        <Icon name="close" size={16}/>
      </Button>
    </div>
  {/if}
  {#if tab==='Overview'}
    <div class="overview-layout">
      <section class="panel">
        <h2>{$t("Instance")}</h2>
        {#if fileError}<p class="inline-error" role="alert">{fileError}</p>{/if}
        <dl class="details">
          <div>
            <dt>Minecraft</dt>
            <dd>{$t(current.version==='pending'?'From modpack':current.version)}</dd>
          </div>
          <div>
            <dt>{$t("Mod loader")}</dt>
            <dd>{$t(current.version==='pending'?'From modpack':current.loader==='vanilla'?'Vanilla':`${loaderLabel(current.loader)} ${current.loader_version}`)}</dd>
          </div>
          <div>
            <dt>{$t("Memory")}</dt>
            <dd>{current.memory_mb/1024} GB</dd>
          </div>
          <div>
            <dt>Java</dt>
            <dd>{$t(current.java_path?'Custom executable':'Automatic')}</dd>
          </div>
        </dl>
      </section>
      <div class="overview-updates">
      {#if newerRelease || loaderUpdate}
        <section class="panel" aria-label={$t("Available updates")}><h2>{$t("Updates")}</h2>
          {#if newerRelease}<p>Minecraft {latestRelease!.id}</p>{/if}
          {#if loaderUpdate}<p>{$t(loaderLabel(current.loader))} {loaderUpdate}</p>{/if}
          <Button onclick={()=>onselectTab('Versions')}>{$t("Versions")}</Button>
        </section>
      {/if}
      <News instances={[current]}/>
      </div>
    </div>
  {:else if ['Worlds','Servers','Screenshots'].includes(tab)}
    {#if fileError}<p class="inline-error" role="alert">{fileError}</p>{/if}
    <InstanceFilesView {refreshPending} onrefresh={refreshFiles} {resourceLink} id={current.id} {tab} {files} {busy} {instances} {isBusy} {onconfig} {bookmarks}/>
  {:else if tab==='Content'}
    <ContentCollection onrefresh={onrefreshContent} onadd={onbrowse} addDisabled={current.version==='pending'} prefix="instance-content" entries={content.map(file=>({id:`${file.kind}:${file.name}`,name:file.name,kind:file.kind,enabled:file.enabled,toggleable:file.kind==='mods'}))} {busy} ontoggle={entry=>{const file=content.find(file=>`${file.kind}:${file.name}`===entry.id);if(file)ontoggle(file);}}/>
  {:else if tab==='Versions'}
    {#if current.version==='pending'}
      <section class="panel">
        <h2>{$t("Modpack versions")}</h2>
        <p>{$t("Versions are detected during installation.")}</p>
      </section>
    {:else}
      <section class="panel narrow">

        <p class="muted">{$t("Version changes require reinstalling. Worlds are preserved.")}</p>
        <p class="hint">{$t("Back up worlds before downgrading.")}</p>
        <label>{$t("Release")}<Select bind:value={editor.version} disabled={busy}>
            {#each versions as v}
              <option value={v.id}>{v.id}</option>
            {/each}
          </Select>
        </label>
        <LoaderPicker gameVersion={editor.version} bind:loader={editor.loader} bind:loaderVersion={editor.loader_version} bind:ready={editLoaderReady} disabled={!!busy}/>
        <div class="form-actions">
          <Button tone="accent" disabled={busy || !editLoaderReady} onclick={onsave}>{$t("Save")}</Button>
          <Button disabled={busy} onclick={()=>onchoose('repair')}>{$t("Reinstall")}</Button>
        </div>
      </section>
    {/if}
  {:else if tab==='Settings'}
    <form class="instance-settings-layout" aria-label={$t('Instance settings')} onsubmit={e=>{e.preventDefault();void onsave();}}>
      <section class="panel instance-settings settings-form">
        <h2>{$t('Instance settings')}</h2>
        {#if currentUI.pending}<p class="hint">{$t('Install this modpack before editing or copying.')}</p>{/if}
        <SettingsGroup title={$t('General')}>
          <label>{$t('Name')}<input dir="auto" bind:value={editor.name} required maxlength={120} disabled={busy || currentUI.pending || launchDraft.pending || !launchDraft.loaded}/></label>
        </SettingsGroup>
        <SettingsGroup title={$t('Runtime')}>
          <RuntimeFields bind:memory={editor.memory_mb} bind:javaPath={editor.java_path} disabled={busy || currentUI.pending || launchDraft.pending || !launchDraft.loaded}/>
        </SettingsGroup>
      </section>
      <LaunchSettings bind:draft={launchDraft} id={current.id} version={current.version} {accounts} busy={busy || currentUI.pending}/>
      <section class="panel settings-form" aria-label={$t('Files and actions')}>
        <h2>{$t('Files and actions')}</h2>
        <div class="settings-input-action">
          <label>{$t('Instance folder')}<input class="folder-path" aria-label={$t('Instance folder')} readonly value={folderPath} placeholder={$t(folderError || (native?'Loading…':'Desktop app required'))}/></label>
          <Button type="button" disabled={!native} onclick={()=>onchoose('folder')}><Icon name="folder" size={17}/>{$t('Open folder')}</Button>
        </div>
        <div class="form-actions settings-file-actions">
          <Button type="button" disabled={!native} onclick={()=>onchoose('shortcut')}>{$t('Create shortcut')}</Button>
          <Button type="button" disabled={!currentUI.canCopy} onclick={()=>onchoose('duplicate')}><Icon name="copy" size={16}/>{$t('Duplicate')}</Button>
          <Button type="button" disabled={!currentUI.canCopy || !native} onclick={()=>onchoose('export')}>{$t('Export')}</Button>
        </div>
      </section>
      <section class="danger-zone settings-delete" aria-label={$t('Delete instance')}>
        <h2>{$t('Delete instance')}</h2>
        <Button type="button" tone="danger" disabled={busy} onclick={()=>onchoose('delete')}>{$t('Delete')}</Button>
      </section>
      <div class="form-actions instance-settings-actions">
        <Button type="submit" tone="accent" disabled={busy || currentUI.pending || launchDraft.pending || !launchDraft.loaded || !dirty}>{$t(launchDraft.pending?'Saving…':'Save')}</Button>
        <Button disabled={busy || currentUI.pending || launchDraft.pending || !launchDraft.loaded} onclick={onrestore}>{$t('Restore defaults')}</Button>
      </div>
    </form>

  {:else}
    <Toolbar searchLabel={$t('Search log')} bind:value={logSearch} items={[
      {id:'refresh',label:$t('Refresh'),content:refreshLog},
      ...(filteredOutput.length?[{id:'copy',label:$t('Copy'),priority:20,content:copyLog}]:[])
    ]}/>
    <pre class="console">{filteredOutput.join('\n') || $t(output.length?'No results':'No output')}</pre>
  {/if}
</div>

</div>

{#snippet refreshLog()}<Button onclick={onrefresh}>{$t('Refresh')}</Button>{/snippet}
{#snippet copyLog()}<CopyButton text={filteredOutput.join('\n')}/>{/snippet}
