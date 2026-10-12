<script lang="ts">
  import { locale } from './preferences';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import { showDialog } from './dialog';
  import { api, native } from './api';
  import ArtworkImage from './ArtworkImage.svelte';
  import Icon from './Icon.svelte';
  import { compactNumber as number } from './format';
  import { loaderLabel, type Instance, type CatalogSource, type CatalogKind, type CatalogProject, type CatalogRelease } from './types';

  let { project, source, kind, label, instances, target=$bindable(''), gameVersion, loader,
    included, isBusy, onadded, oncreated, onpackselected, oncontentselected, packActionLabel, onclose }: {
    project: CatalogProject; source: CatalogSource; kind: CatalogKind; label: string;
    instances: Instance[]; target?: string; gameVersion: string; loader: string;
    isBusy: (id:string)=>boolean; onadded: (id:string)=>void;
    oncontentselected?: (content:import('./types').StagedContent)=>void;
    included?:import('./types').StagedContent;
    packActionLabel?:string;
    onpackselected?: (pack:import('./types').PackSelection)=>void;
    oncreated?: (instance:Instance,icon?:string|null)=>Promise<void>; onclose: ()=>void;
  } = $props();
  let packName=$state('');
  let releases=$state<CatalogRelease[]>([]);
  let release=$state('');let releaseLoading=$state(false);let releaseRetry=$state(0);
  let detailError=$state('');let installing=$state(false);let notice=$state('');
  const instance=$derived(kind==='modpack'?undefined:instances.find(i=>i.id===target));
  $effect(()=>{
    const selectedProject=project;const id=target;const provider=source;const type=kind;void releaseRetry;
    let alive=true;releases=[];release='';detailError='';notice='';releaseLoading=false;
    if((type!=='modpack' && !id))return;
    releaseLoading=true;
    (type==='modpack'?api.packReleases(provider,selectedProject.id,gameVersion,loader):oncontentselected?api.creationReleases(provider,selectedProject.id,gameVersion,loader || 'vanilla',type):api.catalogReleases(provider,selectedProject.id,id,type)).then(list=>{if(alive){releases=list;release=list[0]?.id || '';}}).catch(e=>{if(alive)detailError=String(e);}).finally(()=>{if(alive)releaseLoading=false;});
    return()=>{alive=false;};
  });
  $effect(()=>{packName=project.title;});
  async function add(){
    if(!instance || !release || installing || isBusy(instance.id))return;
    if(oncontentselected){oncontentselected({source,project:project.id,release,kind,title:project.title,releaseName:releases.find(r=>r.id===release)?.name || release,enabled:true});onclose();return;}
    const id=instance.id;const projectId=project.id;const version=release;const provider=source;const type=kind;
    installing=true;detailError='';notice='';
    try{const files=await api.addContent(provider,projectId,id,version,type);notice=$t(files.length===1?'Added {count} file to {name}.':'Added {count} files to {name}.',{count:files.length,name:instance.name});onadded(id);}catch(e){detailError=String(e);}finally{installing=false;}
  }
  async function installPack(){
    if(!release || installing)return;
    if(onpackselected){onpackselected({source,project:project.id,release,title:project.title,icon:project.icon,releaseName:releases.find(r=>r.id===release)?.name || release});onclose();return;}
    installing=true;detailError='';
    try{const icon=project.icon;const created=await api.installPack(source,project.id,release,packName.trim() || project.title);onclose();await oncreated?.(created,icon);}catch(e){detailError=String(e);}finally{installing=false;}
  }
  async function openProject(){try{await api.openProject(source,project.url);}catch(e){detailError=String(e);}}
</script>

<dialog class="modal project-dialog" aria-labelledby="project-title" use:showDialog oncancel={e=>{e.preventDefault();if(!installing)onclose();}}>
  <div class="project-dialog-top">
    <div class="project-dialog-icon">
      <ArtworkImage source={project.icon} fallback="cube" size={40}/>
    </div>
    <div>
      <div class="eyebrow">{source==='modrinth'?'MODRINTH':'CURSEFORGE'} · {$t(label)}</div>
      <h2 id="project-title">{project.title}</h2>
      <p>{$t("by")} {project.author}</p>
    </div>
    <Button class="dialog-close" aria-label={$t("Close project")} disabled={installing} onclick={()=>onclose()}>
      <Icon name="close" size={18}/>
    </Button>
  </div>
  <p>{project.description}</p>
  <p class="hint">{number(project.downloads,$locale)} {$t("downloads")}</p>
  {#if kind!=='modpack' && !oncontentselected}
    <label>{$t("Install into")}<Select aria-label={$t("Install into instance")} bind:value={target} disabled={installing}>
        <option value="">{$t("Choose an instance")}</option>
        {#each instances.filter(i=>i.version!=='pending') as i}
          <option value={i.id}>{i.name} · {i.version} · {$t(loaderLabel(i.loader))}</option>
        {/each}
      </Select>
    </label>
  {/if}
  {#if kind==='modpack' && !onpackselected}
    <label>{$t("Instance name")}<input aria-label={$t("Modpack instance name")} bind:value={packName} maxlength={120} disabled={installing}/>
    </label>
  {/if}
  {#if kind!=='modpack' && !instance}
    <p class="hint">{$t(instances.length?'Select an instance.':'Create an instance first.')}</p>
  {:else if releaseLoading}
    <p role="status">{$t("Loading…")}</p>
  {:else if releases.length}
    <label>{$t(kind==='modpack'?'Pack release':'Compatible release')}<Select aria-label={kind==='modpack'?'Pack release':'Compatible release'} bind:value={release} disabled={installing}>
        {#each releases as r}
          <option value={r.id}>{r.name} · {r.published.slice(0,10)}</option>
        {/each}
      </Select>
    </label>
  {:else if !detailError}
    <p class="hint">{$t(kind==='modpack'?'No matching releases.':'No compatible releases.')}</p>
  {/if}
  {#if detailError}
    <div class="inline-error" role="alert">{detailError}
      {#if !installing}
        <Button shape="plain" onclick={()=>releaseRetry++}>{$t("Retry")}</Button>
      {/if}
    </div>
  {/if}
  {#if included}<p class="catalog-success" role="status">{$t(included.enabled?'Already added.':'Added but disabled.')}</p>{/if}
  {#if notice}
    <p class="catalog-success" role="status">{notice}</p>
  {/if}
  <div class="form-actions">
    {#if kind==='modpack'}
      <Button tone="accent" disabled={(!native && !onpackselected) || !release || installing} onclick={installPack}>
        <Icon name="download" size={16}/>{$t(installing?'Adding…':onpackselected?(packActionLabel || 'Select'):'Install')}</Button>
    {:else}
      <Button tone="accent" disabled={!!included?.enabled || (!native && !oncontentselected) || !release || !instance || installing || (!!instance && isBusy(instance.id))} onclick={add}>{$t(installing?'Adding…':included?.enabled?'Added':'Add')}</Button>
    {/if}
    <Button disabled={!native || installing} onclick={openProject}>{$t("Website")} <Icon name="arrow" size={15}/>
    </Button>
  </div>
  {#if installing}
    <p class="hint" role="status">{$t("Keep Chest open until finished.")}</p>
  {/if}
</dialog>
