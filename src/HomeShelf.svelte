<script lang="ts">
  import type {Snippet} from 'svelte';
  import Button from './Button.svelte';
  import Scrollbar from './Scrollbar.svelte';
  import Toolbar from './Toolbar.svelte';
  import NavigationControls from './NavigationControls.svelte';
  import {t} from './i18n';
  import {presentation} from './visibility';
  import {sectionInfo,type HomeSection} from './home-layout';
  let {section,full=false,count,tools,children,onviewall,moreContent=false}:{section:HomeSection;full?:boolean;count?:number;moreContent?:boolean;tools?:Snippet<[Snippet,Snippet|undefined]>;children:Snippet;onviewall?:()=>void}=$props();
  const bodyId=$props.id();
  let body=$state<HTMLDivElement>();
  let width=$state(0),left=$state(0),total=$state(0);
  const scrollable=$derived(total>width+1);
  const showNavigation=$derived(!full && !!onviewall && (scrollable || moreContent));
  function scroll(direction:number){body?.scrollBy({left:direction*width*.85,behavior:$presentation.motion?'smooth':'instant'});}
</script>
<div class="home-shelf" class:full>
  {#if tools}{@render tools(heading,showNavigation?navigation:undefined)}{:else}<Toolbar {heading} navigation={showNavigation?navigation:undefined}/>{/if}
  <div id={bodyId} class="shelf-body" class:horizontal={!full} bind:this={body}>
    {@render children()}
  </div>
  {#if !full}<Scrollbar scroller={body} targetId={bodyId} orientation="horizontal" label={$t('{name} navigation',{name:$t(sectionInfo[section].label)})} onmeasure={metrics=>{width=metrics.viewport;left=metrics.position;total=metrics.total;}}/>{/if}
</div>
{#snippet heading()}<h2>{$t(sectionInfo[section].label)}{#if count!==undefined}<span class="count">{count}</span>{/if}</h2>{/snippet}
{#snippet navigation()}<div class="shelf-navigation"><Button onclick={onviewall}>{$t('View all')}</Button>{#if scrollable}<NavigationControls label={$t('{name} navigation',{name:$t(sectionInfo[section].label)})} previousLabel={$t('Previous {name}',{name:$t(sectionInfo[section].label)})} nextLabel={$t('Next {name}',{name:$t(sectionInfo[section].label)})} previousDisabled={left<1} nextDisabled={left+width>=total-1} onprevious={()=>scroll(-1)} onnext={()=>scroll(1)}/>{/if}</div>{/snippet}
<style>
  .home-shelf{min-width:0}
  .shelf-navigation{display:flex;flex-wrap:wrap;max-width:100%;gap:0.71428571rem;align-items:center}
  .shelf-body{min-width:0;container-type:inline-size}
  .horizontal{overflow-x:auto;overscroll-behavior-x:contain}
</style>
