<script lang="ts">
  import ProjectDescription from './ProjectDescription.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import CopyButton from './CopyButton.svelte';
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
  const contentTypes={mod:'Mod',resourcepack:'Resource pack',shader:'Shader',modpack:'Modpack'};

  let { project, source, kind, instances, target=$bindable(''), gameVersion, loader,
    included, isBusy, onadded, oncreated, onpackselected, oncontentselected, packActionLabel, onclose }: {
    project: CatalogProject; source: CatalogSource; kind: CatalogKind;
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
  const primaryDisabled=$derived(kind==='modpack'
    ?(!native && !onpackselected) || !release || installing
    :!!included?.enabled || (!native && !oncontentselected) || !release || !instance || installing || (!!instance && isBusy(instance.id)));
  const primaryLabel=$derived(installing?'Adding…':kind==='modpack'?(onpackselected?(packActionLabel || 'Select'):'Install'):(included?.enabled?'Added':'Add'));
  $effect(()=>{
    const selectedProject=project;const id=target;const provider=source;const type=kind;void releaseRetry;
    let alive=true;releases=[];release='';detailError='';notice='';releaseLoading=false;
    if((type!=='modpack' && !id))return;
    releaseLoading=true;
    (type==='modpack'?api.packReleases(provider,selectedProject.id,gameVersion,loader):oncontentselected?api.creationReleases(provider,selectedProject.id,gameVersion,loader || 'vanilla',type):api.catalogReleases(provider,selectedProject.id,id,type)).then(list=>{if(alive){releases=list;release=list[0]?.id || '';}}).catch(e=>{if(alive)detailError=String(e);}).finally(()=>{if(alive)releaseLoading=false;});
    return()=>{alive=false;};
  });
  $effect(()=>{packName=project.title;});
  let failedIcon=$state('');
  const icon=$derived(project.icon && project.icon!==failedIcon?project.icon:null);
  async function add(){
    if(!instance || !release || installing || isBusy(instance.id))return;
    if(oncontentselected){oncontentselected({icon:project.icon,background:project.background,source,project:project.id,release,kind,title:project.title,releaseName:releases.find(r=>r.id===release)?.name || release,enabled:true});onclose();return;}
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

<dialog class="modal project-dialog" aria-labelledby="project-title" use:showDialog={{initialFocus:'#project-title'}} oncancel={e=>{e.preventDefault();if(!installing)onclose();}}>
  <header class="project-header">
    <div class="project-dialog-top">
      {#if icon}<div class="project-dialog-icon">
        <ArtworkImage source={icon} fallback="none" onfailure={()=>failedIcon=icon || ''}/>
      </div>{/if}
      <div class="project-dialog-copy">
        <p class="project-provider">{source==='modrinth'?'MODRINTH':'CURSEFORGE'} · {$t(contentTypes[kind])}</p>
        <h2 id="project-title" tabindex="-1">{project.title}</h2>
        <p class="project-metadata"><span>{$t('by {author}',{author:project.author})}</span><span>{$t(project.downloads===1?'{count} download':'{count} downloads',{count:number(project.downloads,$locale)})}</span></p>
      </div>
      <div class="project-header-actions">
        <Button disabled={!native || installing} onclick={openProject}>{$t('Website')} <DirectionIcon direction="right"/></Button>
        <Button class="dialog-close" aria-label={$t('Close project')} disabled={installing} onclick={onclose}><Icon name="close" size={18}/></Button>
      </div>
    </div>
    {#if project.description}<p class="project-summary">{project.description}</p>{/if}
  </header>
  <ProjectDescription {source} project={project.id} url={project.url}/>
  <footer class="project-controls">
    {#if kind==='modpack' && !onpackselected}
      <label>{$t('Instance name')}<input aria-label={$t('Modpack instance name')} bind:value={packName} maxlength={120} disabled={installing}/></label>
    {/if}
    <div class="project-release-row">
      <div class="project-choice-fields">
        {#if kind!=='modpack' && !oncontentselected}
          <label>{$t('Install into')}<Select aria-label={$t('Install into instance')} bind:value={target} disabled={installing}>
            <option value="">{$t('Choose an instance')}</option>
            {#each instances.filter(i=>i.version!=='pending') as i}<option value={i.id}>{i.name} · {i.version} · {$t(loaderLabel(i.loader))}</option>{/each}
          </Select></label>
        {/if}
        {#if kind==='modpack' || instance}
        <div class="project-release-field">
        {#if releaseLoading}
          <p role="status">{$t('Loading…')}</p>
        {:else if releases.length}
          <label>{$t(kind==='modpack'?'Pack release':'Compatible release')}<Select aria-label={$t(kind==='modpack'?'Pack release':'Compatible release')} bind:value={release} disabled={installing}>
            {#each releases as r}<option value={r.id}>{r.name} · {r.published.slice(0,10)}</option>{/each}
          </Select></label>
        {:else if !detailError}
          <p class="hint">{$t(kind==='modpack'?'No matching releases.':'No compatible releases.')}</p>
        {/if}
        </div>
        {/if}
      </div>
      <Button tone="accent" disabled={primaryDisabled} onclick={()=>kind==='modpack'?installPack():add()}>
        {#if kind==='modpack'}<Icon name="download" size={16}/>{/if}{$t(primaryLabel)}
      </Button>
    </div>
    {#if kind!=='modpack' && !instance && !instances.length}<p class="hint">{$t('Create an instance first.')}</p>{/if}
    {#if detailError}<div class="inline-error" role="alert">{detailError} <CopyButton text={detailError}/>{#if !installing}<Button onclick={()=>releaseRetry++}>{$t('Retry')}</Button>{/if}</div>{/if}
    {#if included}<p class="catalog-success" role="status">{$t(included.enabled?'Already added.':'Added but disabled.')}</p>{/if}
    {#if notice}<p class="catalog-success" role="status">{notice}</p>{/if}
    {#if installing}<p class="hint" role="status">{$t('Keep Chest open until finished.')}</p>{/if}
  </footer>
</dialog>
<style>
/* Three regions own the layout; no inherited form or heading margins between them. */
.project-dialog[open]{display:flex;flex-direction:column;width:calc(100% - 2 * var(--dialog-gutter));max-width:min(94vw,64rem);height:90dvh;max-height:calc(100dvh - 2 * var(--dialog-gutter));overflow:hidden;gap:clamp(.75rem,2dvh,1.25rem)}
.project-header,.project-controls{min-width:0;min-height:0;overflow:auto;flex:0 1 auto}
.project-header{max-height:35%;display:grid;gap:.75rem}
.project-dialog-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:1rem}
.project-dialog-top:has(.project-dialog-icon){grid-template-columns:auto minmax(0,1fr) auto}
.project-dialog-icon{width:clamp(2rem,8cqi,4.5rem);aspect-ratio:1;display:grid;place-items:center}
.project-dialog-icon :global(img){width:100%;height:100%;object-fit:contain}
.project-dialog-copy{min-width:0;display:grid;gap:.4rem}
.project-provider{font-size:.75rem;letter-spacing:.16em;font-weight:600;color:var(--muted)}
.project-dialog-copy>h2{margin:0;font-size:clamp(1.25rem,1rem + 1cqi,2rem);line-height:1.2;overflow-wrap:anywhere}
.project-dialog-copy>h2:focus{outline:none}
.project-header p{margin:0}
.project-metadata{display:flex;flex-wrap:wrap;gap:.25rem 1rem;color:var(--muted)}
.project-metadata>span{min-width:0;overflow-wrap:anywhere}
.project-summary{color:var(--muted);line-height:1.5}
.project-header-actions{display:flex;align-items:start;gap:.5rem;min-width:0}
.project-header-actions :global(.dialog-close){width:var(--control-height);min-width:var(--control-height);padding:0}
.project-controls{max-height:40%;display:grid;gap:.75rem}
.project-controls label{display:grid;gap:.5rem;min-width:0;margin:0}
.project-controls p{margin:0}
.project-choice-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr));gap:.75rem}
.project-release-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:.75rem;min-width:0}
.project-release-field{min-width:0}
@container(max-width:36rem){
  .project-dialog-top,.project-dialog-top:has(.project-dialog-icon){grid-template-columns:minmax(0,1fr) auto;gap:.75rem}
  .project-dialog-icon{grid-column:1;grid-row:1}
  .project-header-actions{grid-column:2;grid-row:1}
  .project-dialog-copy{grid-column:1/-1;grid-row:2}
}
@container(max-width:22rem){
  .project-release-row{grid-template-columns:minmax(0,1fr)}
  .project-release-row>:global(button){justify-self:start}
}
</style>
