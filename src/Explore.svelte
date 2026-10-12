<script lang="ts">
  import { locale } from './preferences';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import ProjectDialog from './ProjectDialog.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import ScreenshotBackdrop from './ScreenshotBackdrop.svelte';
  import { compactNumber as number } from './format';
  import { api, native } from './api';
  import Icon from './Icon.svelte';
  import { loaderLabel, type Instance, type Version, type CatalogSource, type CatalogKind, type CatalogProject } from './types';
  let {instances,versions,target=$bindable(''),isBusy,onadded,oncreated,mode='content',included=[],allowModpacks=true,compact=false,onpackselected,oncontentselected,packActionLabel}:{instances:Instance[];versions:Version[];target?:string;isBusy:(id:string)=>boolean;onadded:(id:string)=>void;oncreated?:(instance:Instance,icon?:string|null)=>Promise<void>;oncontentselected?:(content:import('./types').StagedContent)=>void;packActionLabel?:string;onpackselected?:(pack:import('./types').PackSelection)=>void;included?:import('./types').StagedContent[];allowModpacks?:boolean;compact?:boolean;mode?:'content'|'modpacks'}=$props();
  let source=$state<CatalogSource>('modrinth');let kind=$state<CatalogKind>('mod');
  let query=$state('');let sort=$state('downloads');let game=$state('');let loader=$state('');let layout=$state<'gallery'|'list'>('gallery');
  let resultsWidth=$state(0);
  const columns=$derived(Math.max(1,Math.floor((resultsWidth+18)/(230+18))));
  const pageSize=$derived(layout==='gallery'?Math.min(60,columns*Math.ceil(20/columns)):20);
  $effect(()=>{void pageSize;offset=0;});
  let offset=$state(0);let projects=$state<CatalogProject[]>([]);let total=$state(0);let loading=$state(true);let error=$state('');let retry=$state(0);
  let sources=$state({modrinth:true,curseforge:false});let selected=$state<CatalogProject|null>(null);
  const instance=$derived(kind==='modpack'?undefined:instances.find(i=>i.id===target));
  const incompatibleMods=$derived(!!oncontentselected && kind==='mod' && instance?.loader==='vanilla');
  const includedProject=(id:string)=>included.find(item=>item.source===source && item.project===id);
  const kinds:{id:CatalogKind;label:string}[]=[{id:'mod',label:'Mods'},{id:'resourcepack',label:'Resource packs'},{id:'shader',label:'Shaders'},{id:'modpack',label:'Modpacks'}];
  $effect(()=>{if(mode==='modpacks')kind='modpack';});
  const label=$derived(kinds.find(k=>k.id===kind)!.label);
  $effect(()=>{let alive=true;api.catalogSources().then(v=>{if(alive && v)sources=v;}).catch(()=>{});return()=>{alive=false;};});
  $effect(()=>{const i=instance;game=i?.version || '';loader=i && i.loader!=='vanilla'?i.loader:'';offset=0;});
  $effect(()=>{
    const request={source,kind,query:query.trim(),sort,offset,limit:pageSize,game,loader};void retry;
    let alive=true;loading=true;error='';projects=[];total=0;
    if(incompatibleMods){loading=false;return;}
    const timer=setTimeout(()=>{api.searchCatalog(request).then(page=>{if(alive){projects=page.projects;total=page.total;}}).catch(e=>{if(alive)error=String(e);}).finally(()=>{if(alive)loading=false;});},250);
    return()=>{alive=false;clearTimeout(timer);};
  });
  function changeFilters(){offset=0;selected=null;}
</script>

{#if !compact}<div class="explore-title"><div><h2>{$t(mode==='modpacks'?'Modpacks':'Explore')}</h2></div></div>{/if}
{#if !native}<p class="catalog-preview">{$t("Preview catalog · Desktop app required for downloads.")}</p>{/if}
{#if mode==='content'}
  <Tabs options={kinds.filter(k=>allowModpacks || k.id!=='modpack').map(k=>k.label)} value={label} prefix="catalog" label={$t("Content types")}
    onchange={value=>{kind=kinds.find(k=>k.label===value)!.id;changeFilters();}}/>
{/if}
<div class="catalog-tab-panel" id={`catalog-panel-${encodeURIComponent(label)}`} role={mode==='content'?'tabpanel':undefined} aria-labelledby={mode==='content'?`catalog-tab-${encodeURIComponent(label)}`:undefined}>
<div class="catalog-controls panel">
  <div class="catalog-search-row"><label class="search"><Icon name="search" size={18}/><input aria-label={$t("Search projects")} placeholder={$t('Search {kind}…',{kind:$t(label).toLowerCase()})} maxlength={200} bind:value={query} oninput={changeFilters}/></label><label>{$t("Source")}<Select aria-label={$t("Content source")} bind:value={source} onchange={changeFilters}><option value="modrinth">Modrinth</option><option value="curseforge">CurseForge{sources.curseforge?'':$t(' · setup required')}</option></Select></label></div>
  <div class="catalog-filters" class:pack-filters={mode==='modpacks'}>
    {#if mode==='content' && kind!=='modpack' && !oncontentselected}<label>{$t("Add to instance")}<Select aria-label={$t("Target instance")} bind:value={target}><option value="">{$t("Browse all projects")}</option>{#each instances.filter(i=>i.version!=='pending') as i}<option value={i.id}>{i.name} · {i.version} · {$t(loaderLabel(i.loader))}</option>{/each}</Select></label>{/if}
    <label>Minecraft<Select aria-label={$t("Filter Minecraft version")} bind:value={game} onchange={changeFilters} disabled={!!instance}><option value="">{$t("All versions")}</option>{#each versions as v}<option value={v.id}>{v.id}</option>{/each}</Select></label>
    {#if kind==='mod' || kind==='modpack'}<label>{$t("Loader")}<Select aria-label={$t("Filter loader")} bind:value={loader} onchange={changeFilters} disabled={!!instance}><option value="">{$t("All loaders")}</option><option value="fabric">Fabric</option><option value="quilt">Quilt</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option></Select></label>{/if}
    <label>{$t("Sort by")}<Select aria-label={$t("Sort projects")} bind:value={sort} onchange={changeFilters}><option value="downloads">{$t("Popular")}</option><option value="relevance">{$t("Relevance")}</option><option value="updated">{$t("Recently updated")}</option><option value="newest">{$t("Newest")}</option></Select></label>
  </div>
</div>
<div class="section-heading catalog-heading"><div><h2>{$t(label)} <span class="count">{loading?'…':number(total,$locale)}</span></h2></div><LayoutSwitch label={$t("Project layout")} bind:value={layout}/></div>
<div class="catalog-results" bind:clientWidth={resultsWidth}>
{#if incompatibleMods}<div class="empty"><h3>{$t("Vanilla does not load mods.")}</h3><p>{$t("Select Fabric or Quilt to add mods.")}</p></div>
{:else if loading}<div class="empty" role="status"><Icon name="search" size={32}/><h3>{$t("Loading…")}</h3></div>
{:else if error}<div class="empty" role="alert"><h3>{$t(source==='curseforge' && !sources.curseforge?'Connect CurseForge to browse its catalog.':'The catalog couldn’t load.')}</h3><p>{error}</p>{#if source==='curseforge' && !sources.curseforge}<Button tone="accent" onclick={()=>{source='modrinth';changeFilters();}}>{$t("Use Modrinth")}</Button>{:else}<Button onclick={()=>retry++}>{$t("Retry")}</Button>{/if}</div>
{:else if !projects.length}<div class="empty"><Icon name="search" size={32}/><h3>{$t("No results")}</h3><Button onclick={()=>{query='';if(!instance){game='';loader='';}changeFilters();}}>{$t("Clear")}</Button></div>
{:else}
  <div class="catalog-grid" class:catalog-list={layout==='list'}>{#each projects as project (project.id)}<Button shape="card" class="catalog-card" onclick={()=>selected=project}>
    <ScreenshotBackdrop sources={project.background?[project.background]:[]} variant="card"/>
    <div class="catalog-art"><ArtworkImage source={project.icon} fallback="cube" lazy/><span class="catalog-kind">{$t(label)}</span></div>
    <div class="catalog-body"><h3>{project.title}</h3>{#if includedProject(project.id)}<span class="catalog-success">{$t(includedProject(project.id)?.enabled?'Already added':'Added · disabled')}</span>{/if}<span class="catalog-author">{$t("by")} {project.author}</span><p>{project.description}</p><div class="catalog-meta"><span><Icon name="download" size={14}/>{number(project.downloads,$locale)}</span></div></div>
  </Button>{/each}</div>
  <div class="catalog-pagination"><Button disabled={offset===0} onclick={()=>offset=Math.max(0,offset-pageSize)}>{$t("Previous")}</Button><span>{offset+1}–{Math.min(offset+pageSize,total)} {$t("of")} {number(total,$locale)}</span><Button disabled={offset+pageSize>=total} onclick={()=>offset+=pageSize}>{$t("Next")}</Button></div>
{/if}
</div>
</div>
{#if selected}
  <ProjectDialog included={includedProject(selected.id)} project={selected} {source} {kind} {label} {instances} bind:target
    gameVersion={game} {loader} {isBusy} {onadded} {oncreated} {onpackselected} {oncontentselected} {packActionLabel} onclose={()=>selected=null}/>
{/if}
