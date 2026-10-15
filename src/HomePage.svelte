<script lang="ts">
  import DirectionIcon from './DirectionIcon.svelte';
  import {onMount,tick} from 'svelte';
  import {t} from './i18n';
  import {afterFirstPaint} from './startup';
  import {homeShelves} from './preferences';
  import {presentation,observeVisibility} from './visibility';
  import {sectionInfo,type HomeSection} from './home-layout';
  import InstanceLibrary from './InstanceLibrary.svelte';
  import HomeShelf from './HomeShelf.svelte';
  import HomeDock from './HomeDock.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import type {Config,Instance,Version,CatalogKind,PackSelection} from './types';
  import type {LibraryView} from './ui-state';
  let {page=null,config,icons,versions,view=$bindable(),target=$bindable(''),kind=$bindable<CatalogKind>('mod'),statusText,oncreate,onselect,onresource,ondoubleclick,onmenu,onmenukeys,menuId,oncreated,onpackselected,isBusy,onadded,onconfig,onnavigate}:{
    page?:HomeSection|null;config:Config;icons:Record<string,string>;versions:Version[];view:LibraryView;target?:string;kind?:CatalogKind;
    statusText:(instance:Instance)=>string;oncreate:()=>void;onselect:(id:string)=>void;onresource:(id:string,tab:'Worlds'|'Servers',item:string)=>void;ondoubleclick:(instance:Instance)=>void;
    onmenu:(event:MouseEvent,instance:Instance)=>void;onmenukeys:(event:KeyboardEvent,instance:Instance)=>void;menuId?:string;
    oncreated:(instance:Instance,icon?:string|null)=>Promise<void>;onpackselected:(pack:PackSelection)=>void;
    isBusy:(id:string)=>boolean;onadded:(id:string)=>void;onconfig:(config:Config)=>void;onnavigate:(page:string)=>void;
  }=$props();
  let ready=$state(false),active=$state<HomeSection|null>('instances'),jumpTarget:HomeSection|null=null;
  let reached=$state<Partial<Record<HomeSection,boolean>>>({});
  function activate(node:HTMLElement,section:HomeSection){const stop=observeVisibility(node,visible=>{if(visible)reached[section]=true;});return {destroy:stop};}
  let root:HTMLDivElement;
  let scroller:HTMLElement|null=null;
  const displayed=$derived(page?[page]:$homeShelves);
  const loadNews=()=>import('./News.svelte');
  const loadExplore=()=>import('./Explore.svelte');
  const loadScreenshots=()=>import('./Screenshots.svelte');
  const loadResources=()=>import('./ResourceLibrary.svelte');
  onMount(()=>{
    scroller=root.closest('main');
    const cancel=afterFirstPaint(()=>ready=true);
    let frame=0;
    const update=()=>{
      frame=0;if(page || !scroller)return;
      const bounds=scroller.getBoundingClientRect(),bottom=bounds.bottom-88;
      const sections=Array.from(root.querySelectorAll<HTMLElement>('[data-home-section]'));
      const current=sections.find(node=>node.dataset.homeSection===active)?.getBoundingClientRect();
      if(current && current.top>=bounds.top && current.bottom<=bottom)return;
      let best:HomeSection|null=null,area=0;
      for(const section of sections){const rect=section.getBoundingClientRect();const visible=Math.max(0,Math.min(rect.bottom,bottom)-Math.max(rect.top,bounds.top));if(visible>area){area=visible;best=section.dataset.homeSection as HomeSection;}}
      if(best)active=jumpTarget || best;
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const interrupt=()=>jumpTarget=null;
    scroller?.addEventListener('scroll',schedule,{passive:true});scroller?.addEventListener('scrollend',interrupt);
    scroller?.addEventListener('wheel',interrupt,{passive:true});scroller?.addEventListener('touchstart',interrupt,{passive:true});scroller?.addEventListener('keydown',interrupt);
    const observer=new ResizeObserver(schedule);observer.observe(root);schedule();
    return()=>{cancel();observer.disconnect();cancelAnimationFrame(frame);scroller?.removeEventListener('scroll',schedule);scroller?.removeEventListener('scrollend',interrupt);scroller?.removeEventListener('wheel',interrupt);scroller?.removeEventListener('touchstart',interrupt);scroller?.removeEventListener('keydown',interrupt);};
  });
  $effect(()=>{if(page){active=page;scroller?.scrollTo({top:0,behavior:'instant'});}else if(active && !$homeShelves.includes(active))active=$homeShelves[0] || null;});
  async function choose(section:HomeSection,visible:boolean){
    if(!visible){onnavigate(section);await tick();scroller?.focus({preventScroll:true});return;}
    onnavigate('home');await tick();
    const node=root.querySelector<HTMLElement>(`[data-home-section="${section}"]`);
    if(!node || !scroller)return;
    const rect=node.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();
    const top=bounds.top+24,bottom=bounds.bottom-88;
    let target=scroller.scrollTop;
    if(rect.height>bottom-top || rect.top<top)target+=rect.top-top;
    else if(rect.bottom>bottom)target+=rect.bottom-bottom;
    target=Math.max(0,Math.min(target,scroller.scrollHeight-scroller.clientHeight));
    active=section;jumpTarget=Math.abs(target-scroller.scrollTop)>1?section:null;
    scroller.scrollTo({top:target,behavior:$presentation.motion?'smooth':'instant'});
    node.focus({preventScroll:true});
  }
</script>
<div class="home-page" bind:this={root}>
  {#if !page}<h1>{$t('Home')}</h1>{:else}<div class="section-heading"><h1>{$t(sectionInfo[page].label)}</h1><Button shape="plain" onclick={()=>onnavigate('home')}><DirectionIcon direction="left"/>{$t('Home')}</Button></div>{/if}
  {#each displayed as section (section)}
    <section id={section==='explore'?'explore':`home-${section}`} class="home-section" class:home-explore={section==='explore'} data-home-section={section} use:activate={section} tabindex="-1" aria-label={$t(sectionInfo[section].label)}>
      {#if section==='instances'}
        <InstanceLibrary instances={config.instances} {icons} bind:view {statusText} {oncreate} {onselect} {ondoubleclick} {onmenu} {onmenukeys} {menuId} full={!!page} onviewall={()=>onnavigate('instances')}/>
      {:else if ready}
        {#if section==='news'}
          {#await loadNews() then {default:News}}<News limit={6} paginated instances={config.instances}/>{:catch}{@render failed()}{/await}
        {:else if section==='explore'}
          {#await loadExplore() then {default:Explore}}<Explore bind:kind instances={config.instances} {versions} bind:target {oncreated} {onpackselected} packActionLabel={$t('Select')} {isBusy} {onadded}/>{:catch}{@render failed()}{/await}
        {:else if section==='screenshots'}
          {#if page || reached[section]}{#await loadScreenshots() then {default:Screenshots}}<Screenshots shelf instances={config.instances} full={!!page} onviewall={()=>onnavigate(section)}/>{:catch}{@render failed()}{/await}{:else}<HomeShelf {section} full={!!page}><p role="status">{$t('Loading…')}</p></HomeShelf>{/if}
        {:else}
          {#if page || reached[section]}{#await loadResources() then {default:ResourceLibrary}}<ResourceLibrary mode={section} {config} {isBusy} {onconfig} {icons} onopen={(id,item)=>onresource(id,section==='worlds'?'Worlds':'Servers',item)} embedded gallery={!page} onviewall={()=>onnavigate(section)}/>{:catch}{@render failed()}{/await}{:else}<HomeShelf {section} full={!!page}><p role="status">{$t('Loading…')}</p></HomeShelf>{/if}
        {/if}
      {:else}<p role="status">{$t('Loading…')}</p>{/if}
    </section>
  {:else}<div class="empty"><img class="empty-chest" src="/chest.svg" alt="" aria-hidden="true"/><h2>{$t('Your home is empty')}</h2></div>{/each}
</div>
<HomeDock sections={$homeShelves} active={page || active} onchoose={choose} onchange={order=>homeShelves.set(order)}/>
{#snippet failed()}<p role="alert">{$t('Could not load page')} <Button onclick={()=>window.location.reload()}>{$t('Retry')}</Button></p>{/snippet}
<style>
  .empty-chest{display:block;width:8rem;height:8rem;margin:0 auto 1.71428571rem;filter:grayscale(1);opacity:.5}
  .home-page{padding-bottom:4.57142857rem}
  .home-section{margin-top:2.85714286rem;outline:none;min-width:0}
  .home-section:first-of-type{margin-top:1.71428571rem}
  .home-page :global(.news-section > h2),.home-page :global(.explore-title h2){font-size:1.42857143rem;letter-spacing:0}
  .home-page :global(.home-library > .library-heading){margin-bottom:1.14285714rem}
</style>
