<script lang="ts">
  import { t } from './i18n';
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
  import { loaderLabel, tabs, type Activity, type Account, type Content, type Instance, type Tab, type Version } from './types';

  let { current, editor=$bindable(), active, tab, account, source, versions, content=[], output=[],
    onchoose, onselectTab, onbrowse, onsave, onacknowledge, ontoggle, onrefresh, onprofile }: {
    current: Instance; editor: Instance; active?: Activity; tab: Tab; account?: Account;
    source?: string; versions: Version[]; content?: Content[]; output?: string[];
    onchoose: (choice:InstanceChoice)=>void; onselectTab: (tab:Tab)=>void;
    onbrowse: ()=>void; onsave: ()=>void; onacknowledge: ()=>void;
    ontoggle: (file:Content)=>void; onrefresh: ()=>void; onprofile: ()=>void;
  } = $props();
  let folderPath=$state('');
  let folderError=$state('');
  const instanceId=$derived(current.id);
  $effect(()=>{
    const id=instanceId;
    let alive=true;
    folderPath='';folderError='';
    void api.folderPath(id).then(path=>{if(alive)folderPath=path || '';}).catch(()=>{if(alive)folderError='Could not read the instance folder path.';});
    return()=>{alive=false;};
  });
  let editLoaderReady=$state(false);
  const currentUI=$derived(instanceUI(current,active));
  const busy=$derived(currentUI.busy);
  const latestRelease=$derived(versions.find(version=>version.type==='release'));
  const newerRelease=$derived(!!latestRelease && versions.findIndex(version=>version.id===current.version)>versions.findIndex(version=>version.id===latestRelease.id));
  let loaderUpdate=$state('');
  $effect(()=>{
    const instance=current;let alive=true;loaderUpdate='';
    if(instance.version!=='pending' && instance.loader!=='vanilla'){
      const request=instance.loader==='fabric'?api.fabricVersions(instance.version):api.quiltVersions(instance.version);
      void request.then(list=>{const latest=list?.[0];if(alive && latest && list.includes(instance.loader_version) && list.indexOf(instance.loader_version)>0)loaderUpdate=latest;}).catch(()=>{});
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
    <h1>{current.name}</h1>
    <InstanceBrief instance={current}/>
    <p class="instance-summary">{$t(instanceStatus(current,active))}</p>
  </div>
</section>
<div class="instance-toolbar">
  <Button tone="accent" class="install-button" disabled={currentUI.transitional} onclick={()=>onchoose('action')}>
    <span class="button-label">
      <Icon name={currentUI.icon} size={18}/>{$t(currentUI.label)}</span>
    <span class="button-hover">
      <Icon name={currentUI.actionIcon} size={18}/>{$t(currentUI.actionLabel)}</span>
    {#if currentUI.showProgress}
      <span class="button-progress" style:width={`${(active?.progress || 0)*100}%`}>
      </span>
    {/if}
  </Button>
  <Tabs options={tabs} value={tab} prefix="instance" label={$t("Instance pages")} onchange={onselectTab}/>
</div>
<div class="instance-content" id={`instance-panel-${tab}`} role="tabpanel" aria-labelledby={`instance-tab-${tab}`}>
  {#if active && ['crashed','failed','launch_failed'].includes(active.status)}
    <div class="crash-notice">
      <div>
        <strong>{$t(active.status==='crashed'?'Minecraft stopped unexpectedly.':active.status==='launch_failed'?'Minecraft could not start.':'Installation needs another try.')}</strong>
        <p>{active.phase}</p>
      </div>
      <Button shape="plain" onclick={()=>onselectTab('Log')}>{$t("Log")}</Button>
      <Button shape="plain" class="icon-button" aria-label={$t("Acknowledge error")} onclick={onacknowledge}>
        <Icon name="close" size={16}/>
      </Button>
    </div>
  {/if}
  {#if tab==='Overview'}
    <div class="overview-layout">
      <section class="panel">
        <div class="panel-heading">
          <h2>{$t("Instance")}</h2>
          <Icon name="leaf" size={22}/>
        </div>
        <p class="muted">{$t(instanceStatus(current,active))}</p>
        {#if active && ['installing','paused','pausing'].includes(active.status)}
          <p class="hint">{$t("Hover or focus to pause or resume.")}</p>
        {/if}
        <dl class="details">
          <div>
            <dt>Minecraft</dt>
            <dd>{$t(current.version==='pending'?'From modpack':current.version)}</dd>
          </div>
          <div>
            <dt>{$t("Modloader")}</dt>
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
          <div>
            <dt>{$t("Account")}</dt>
            <dd>{account?.name || $t('Not signed in')}</dd>
          </div>
        </dl>
        {#if !account}
          <Button shape="plain" onclick={onprofile}>{$t("Sign in")} <Icon name="arrow" size={16}/>
          </Button>
        {/if}
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
  {:else if tab==='Content'}
    <div class="form-actions">
      <Button tone="accent" disabled={busy || current.version==='pending'} onclick={onbrowse}>
        <Icon name="search" size={17}/>{$t("Browse")}</Button>
    </div>
    <p class="hint">{$t(current.loader==='vanilla'?'Mods require Fabric or Quilt.':'')}</p>
    {#if !content.length}
      <div class="empty">
        <Icon name="cube" size={35}/>
        <h3>{$t("No content")}</h3>

      </div>
    {:else}
      <div class="panel content-list">
        {#each content as file}
          <div>
            <Icon name="cube"/>
            <span>{file.name}<small>{$t(({mods:'Mods',resourcepacks:'Resource packs',shaderpacks:'Shaders'} as Record<string,string>)[file.kind] || file.kind)}</small>
            </span>
            {#if file.kind==='mods'}
              <Button disabled={busy} onclick={()=>ontoggle(file)}>{$t(file.enabled?'Disable':'Enable')}</Button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
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
    <form class="panel narrow" onsubmit={e=>{e.preventDefault();void onsave();}}>

      <div class="instance-folder">
        <label>{$t("Instance folder")}<input class="folder-path" aria-label={$t("Instance folder")} readonly value={folderPath} placeholder={folderError || (native?'Loading…':'Desktop app required')}/></label>
        <Button type="button" disabled={!native} onclick={()=>onchoose('folder')}><Icon name="folder" size={17}/>{$t("Open folder")}</Button>
      </div>
      {#if currentUI.pending}
        <p class="hint">{$t("Install this modpack before editing or copying.")}</p>
      {/if}
      <label>{$t("Name")}<input bind:value={editor.name} required maxlength={120} disabled={busy || currentUI.pending}/>
      </label>
      <RuntimeFields bind:memory={editor.memory_mb} bind:javaPath={editor.java_path} disabled={busy || currentUI.pending}/>
      <div class="form-actions">
        <Button type="submit" tone="accent" disabled={busy || currentUI.pending}>{$t("Save")}</Button>
        <Button type="button" disabled={!currentUI.canCopy} onclick={()=>onchoose('duplicate')}>
          <Icon name="copy" size={16}/>{$t("Duplicate")}</Button>
        <Button type="button" disabled={!currentUI.canCopy || !native} onclick={()=>onchoose('export')}>{$t("Export")}</Button>
      </div>
      <div class="danger-zone">

        <Button type="button" tone="danger" disabled={busy} onclick={()=>onchoose('delete')}>{$t("Delete")}</Button>
      </div>
    </form>
  {:else}
    <div class="section-heading">
      <Button onclick={onrefresh}>{$t("Refresh")}</Button>
    </div>
    <pre class="console">{output.join('\n') || $t('No output')}</pre>
  {/if}
</div>

</div>
