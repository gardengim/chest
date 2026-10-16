<script lang="ts">
  import CardGrid from './CardGrid.svelte';
  import Toolbar from './Toolbar.svelte';
  import InstanceName from './InstanceName.svelte';
  import InstanceIcon from './InstanceIcon.svelte';
  import { locale } from './preferences';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import Pagination from './Pagination.svelte';
  import Tabs from './Tabs.svelte';
  import LayoutSwitch from './LayoutSwitch.svelte';
  import ProjectDialog from './ProjectDialog.svelte';
  import Card from './Card.svelte';
  import { compactNumber as number } from './format';
  import { api, native } from './api';
  import Icon from './Icon.svelte';
  import { loaderLabel, type Instance, type Version, type CatalogSource, type CatalogKind, type CatalogProject } from './types';
  let {instances,versions,target=$bindable(''),isBusy,onadded,oncreated,mode='content',included=[],allowModpacks=true,compact=false,showTabs=true,kind=$bindable<CatalogKind>('mod'),onpackselected,oncontentselected,packActionLabel}:{instances:Instance[];versions:Version[];target?:string;isBusy:(id:string)=>boolean;onadded:(id:string)=>void;oncreated?:(instance:Instance,icon?:string|null)=>Promise<void>;oncontentselected?:(content:import('./types').StagedContent)=>void;packActionLabel?:string;onpackselected?:(pack:import('./types').PackSelection)=>void;included?:import('./types').StagedContent[];allowModpacks?:boolean;compact?:boolean;showTabs?:boolean;kind?:CatalogKind;mode?:'content'|'modpacks'}=$props();
  let source=$state<CatalogSource>('modrinth');
  let query=$state('');let sort=$state('downloads');let game=$state('');let loader=$state('');let layout=$state<'gallery'|'list'>('gallery');
  let columns=$state(1);
  function measureResults(node:HTMLElement){
    const probe=node.querySelector<HTMLElement>('.catalog-layout-probe')!;
    const measure=()=>{
      const gap=parseFloat(getComputedStyle(probe).marginRight);
      const minimum=probe.getBoundingClientRect().width;
      columns=Math.max(1,Math.floor((node.clientWidth+gap)/(minimum+gap)));
    };
    const observer=new ResizeObserver(measure);observer.observe(node);observer.observe(probe);measure();
    return {destroy:()=>observer.disconnect()};
  }
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
  let previousFilter='';
  $effect(()=>{
    const request={source,kind,query:query.trim(),sort,offset,limit:pageSize,game,loader};void retry;
    let alive=true;loading=true;error='';projects=[];
    const filter=JSON.stringify({source,kind,query:query.trim(),sort,game,loader});
    if(filter!==previousFilter){total=0;previousFilter=filter;}
    if(incompatibleMods){loading=false;return;}
    const timer=setTimeout(()=>{api.searchCatalog(request).then(page=>{if(alive){projects=page.projects;total=page.total;}}).catch(e=>{if(alive)error=String(e);}).finally(()=>{if(alive)loading=false;});},250);
    return()=>{alive=false;clearTimeout(timer);};
  });
  function changeFilters(){offset=0;selected=null;}
</script>

{#if !compact}<div class="explore-title"><div><h2>{$t(mode==='modpacks'?'Modpacks':'Explore')}</h2></div></div>{/if}
{#if !native}<p class="catalog-preview">{$t("Preview catalog · Desktop app required for downloads.")}</p>{/if}
{#if mode==='content' && showTabs}
  <Tabs options={kinds.filter(k=>allowModpacks || k.id!=='modpack').map(k=>k.label)} value={label} prefix="catalog" label={$t("Content types")}
    onchange={value=>{kind=kinds.find(k=>k.label===value)!.id;changeFilters();}}/>
{/if}
<div class="catalog-tab-panel" class:catalog-unframed={!showTabs} id={`catalog-panel-${encodeURIComponent(label)}`} role={mode==='content' && showTabs?'tabpanel':undefined} aria-labelledby={mode==='content' && showTabs?`catalog-tab-${encodeURIComponent(label)}`:undefined}>
<div class="catalog-controls panel">
  <Toolbar searchLabel={$t('Search projects')} placeholder={$t('Search {kind}…',{kind:$t(label).toLowerCase()})} maxlength={200} bind:value={query} onsearch={changeFilters}>
    {#snippet filters()}<Select aria-label={$t('Content source')} bind:value={source} onchange={changeFilters}><option value="modrinth">Modrinth</option><option value="curseforge">CurseForge{sources.curseforge?'':$t(' · setup required')}</option></Select>{/snippet}
  </Toolbar>
  <div class="catalog-filters" class:pack-filters={mode==='modpacks'}>
    {#if mode==='content' && kind!=='modpack' && !oncontentselected}<label>{$t("Add to instance")}<Select aria-label={$t("Target instance")} bind:value={target}><option value="">{$t("Browse all projects")}</option>{#each instances.filter(i=>i.version!=='pending') as i}<option value={i.id}>{i.name} · {i.version} · {$t(loaderLabel(i.loader))}</option>{/each}{#snippet leading(value:string)}{#if instances.some(i=>i.id===value)}<InstanceIcon id={value}/>{/if}{/snippet}{#snippet optionContent(value:string,label:string)}{#if instances.find(i=>i.id===value)}<InstanceName instance={instances.find(i=>i.id===value)!}/>{label.slice(instances.find(i=>i.id===value)!.name.length)}{:else}{label}{/if}{/snippet}</Select></label>{/if}
    <label>Minecraft<Select aria-label={$t("Filter Minecraft version")} bind:value={game} onchange={changeFilters} disabled={!!instance}><option value="">{$t("All versions")}</option>{#each versions as v}<option value={v.id}>{v.id}</option>{/each}</Select></label>
    {#if kind==='mod' || kind==='modpack'}<label>{$t("Loader")}<Select aria-label={$t("Filter loader")} bind:value={loader} onchange={changeFilters} disabled={!!instance}><option value="">{$t("All loaders")}</option><option value="fabric">Fabric</option><option value="quilt">Quilt</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option></Select></label>{/if}
    <label>{$t("Sort by")}<Select aria-label={$t("Sort projects")} bind:value={sort} onchange={changeFilters}><option value="downloads">{$t("Popular")}</option><option value="relevance">{$t("Relevance")}</option><option value="updated">{$t("Recently updated")}</option><option value="newest">{$t("Newest")}</option></Select></label>
  </div>
</div>
<div class="section-heading catalog-heading"><div><h2>{$t(label)} <span class="count">{loading?'…':number(total,$locale)}</span></h2></div><LayoutSwitch label={$t("Project layout")} bind:value={layout}/></div>
<div class="catalog-results" use:measureResults><span class="catalog-layout-probe" aria-hidden="true"></span>
{#if incompatibleMods}<div class="empty"><h3>{$t("Vanilla does not load mods.")}</h3><p>{$t("Choose a compatible mod loader to add mods.")}</p></div>
{:else if loading}<div class="empty" role="status"><Icon name="search" size={32}/><h3>{$t("Loading…")}</h3></div>
{:else if error}<div class="empty inline-error" role="alert"><h3>{$t(source==='curseforge' && !sources.curseforge?'Connect CurseForge to browse its catalog.':'The catalog couldn’t load.')}</h3><p>{error}</p>{#if source==='curseforge' && !sources.curseforge}<Button tone="accent" onclick={()=>{source='modrinth';changeFilters();}}>{$t("Use Modrinth")}</Button>{:else}<Button onclick={()=>retry++}>{$t("Retry")}</Button>{/if}</div>
{:else if !projects.length}<div class="empty"><Icon name="search" size={32}/><h3>{$t("No results")}</h3><Button onclick={()=>{query='';if(!instance){game='';loader='';}changeFilters();}}>{$t("Clear")}</Button></div>
{:else}
  <CardGrid class={['catalog-grid',layout==='list' && 'catalog-list']} {layout}>{#each projects as project (project.id)}<Card class="catalog-card" title={project.title} icon={project.icon} background={project.background} badge={$t(label)} {layout} onclick={()=>selected=project}>
    {#if includedProject(project.id)}<span class="catalog-success">{$t(includedProject(project.id)?.enabled?'Already added':'Added · disabled')}</span>{/if}<span class="catalog-author">{$t('by {author}',{author:project.author})}</span><div class="catalog-meta"><span><Icon name="download" size={14}/>{number(project.downloads,$locale)}</span></div>
  </Card>{/each}</CardGrid>

{/if}
{#if total>0}<Pagination label={$t('{name} pages',{name:$t(label)})} page={Math.floor(offset/pageSize)} pages={Math.ceil(total/pageSize)} disabled={loading} description={$t('{first}–{last} of {total}',{first:number(offset+1,$locale),last:number(Math.min(offset+pageSize,total),$locale),total:number(total,$locale)})} onchange={value=>offset=value*pageSize}/>{/if}
</div>
</div>
{#if selected}
  <ProjectDialog included={includedProject(selected.id)} project={selected} {source} {kind} {instances} bind:target
    gameVersion={game} {loader} {isBusy} {onadded} {oncreated} {onpackselected} {oncontentselected} {packActionLabel} onclose={()=>selected=null}/>
{/if}
