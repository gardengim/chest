<script lang="ts">
  import {tick,onDestroy} from 'svelte';
  import {flip} from 'svelte/animate';
  import {layoutOffset,insertionIndex,movedEnough} from './reorder';
  import HomeDockMenu from './HomeDockMenu.svelte';
  import {homeDockPosition,homeDockOrientation,homeHiddenOrder} from './preferences';
  import Button from './Button.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import {t} from './i18n';
  import {presentation} from './visibility';
  import {homeSections,sectionInfo,moveShelf,dockIsVertical,type HomeSection} from './home-layout';
  let {sections,active,onchoose,onchange}:{sections:HomeSection[];active:HomeSection|null;onchoose:(section:HomeSection,visible:boolean)=>void;onchange:(sections:HomeSection[])=>void}=$props();
  let expanded=$state(false),announcement=$state(''),hiddenWidth=$state(0),hiddenHeight=$state(0);
  let root:HTMLElement;
  let menu=$state<{section:HomeSection|null;x:number;y:number;trigger:HTMLElement}|null>(null);
  const vertical=$derived(dockIsVertical($homeDockPosition,$homeDockOrientation));
  const expandsBack=$derived(vertical?$homeDockPosition.startsWith('bottom-'):$homeDockPosition.endsWith('-right'));
  const toggleDirection=$derived(vertical?(expanded!==expandsBack?'up':'down'):(expanded!==expandsBack?'left':'right'));
  function context(event:MouseEvent){event.preventDefault();const section=(event.target as Element).closest<HTMLElement>('[data-section]')?.dataset.section as HomeSection|undefined;menu={section:section || null,x:event.clientX,y:event.clientY,trigger:event.currentTarget as HTMLElement};}
  function contextKeys(event:KeyboardEvent){
    if(event.key!=='ContextMenu' && !(event.shiftKey && event.key==='F10'))return;
    event.preventDefault();const target=event.target as HTMLElement;const rect=target.getBoundingClientRect();
    menu={section:target.closest<HTMLElement>('[data-section]')?.dataset.section as HomeSection || null,x:rect.left,y:rect.bottom,trigger:target};
  }
  function reorder(section:HomeSection,delta:number){if(sections.includes(section))update(moveShelf(sections,section,sections.indexOf(section)+delta),section);else homeHiddenOrder.set(moveShelf(hidden,section,hidden.indexOf(section)+delta));}
  function toggle(section:HomeSection){if(sections.includes(section)){homeHiddenOrder.set([...hidden,section]);update(sections.filter(item=>item!==section),section);}else update([...sections,section],section);}
  function focusDock(){(root.querySelector<HTMLButtonElement>('[data-home-more]') || root.querySelector<HTMLButtonElement>('button'))?.focus();}
  let drag=$state<{section:HomeSection;pointer:number;x:number;y:number;originX:number;originY:number;left:number;top:number;bounds:{left:number;top:number;right:number;bottom:number;width:number;height:number};started:boolean}|null>(null);
  // Keep existing targets still while dragging, but clamp against the whole
  // available area using CSS percentages of the live size, without observer lag.
  const dragLeft=$derived(drag?Math.max(drag.bounds.left,drag.left):0);
  const dragTop=$derived(drag?Math.max(drag.bounds.top,drag.top):0);
  let drop=$state<{group:'visible'|'hidden';index:number}|null>(null);
  const shown=$derived(drag?.started && drop?.group==='visible' && sections.includes(drag.section)?moveShelf(sections,drag.section,drop.index):sections);
  let suppressClick=false;
  let holdReady=$state(false);
  let holdTimer:ReturnType<typeof setTimeout>|undefined;
  function clearHold(){clearTimeout(holdTimer);holdTimer=undefined;holdReady=false;}
  onDestroy(clearHold);
  const showTargets=$derived(!!drag && (holdReady || drag.started));
  const hidden=$derived([...new Set([...$homeHiddenOrder,...homeSections])].filter(section=>!sections.includes(section)));
  const hideTarget=$derived(showTargets && !!drag && sections.includes(drag.section) && !hidden.length);
  const shownHidden=$derived(drag?.started && drop?.group==='hidden' && hidden.includes(drag.section)?moveShelf(hidden,drag.section,drop.index):hidden);
  const label=(section:HomeSection)=>$t(sectionInfo[section].label);
  function begin(event:PointerEvent,section:HomeSection){
    if(event.button!==0 || !event.isPrimary)return;
    clearHold();suppressClick=false;menu=null;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const frame=root.getBoundingClientRect(),bounds=root.closest('.home-dock-position')!.getBoundingClientRect();
    drag={left:frame.left,top:frame.top,bounds:{left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,width:bounds.width,height:bounds.height},section,pointer:event.pointerId,x:event.clientX,y:event.clientY,originX:event.clientX,originY:event.clientY,started:false};
    holdTimer=setTimeout(()=>{if(drag)holdReady=true;},350);
  }
  function move(event:PointerEvent){
    if(!drag || event.pointerId!==drag.pointer)return;
    if(!drag.started && !movedEnough(event.clientX-drag.originX,event.clientY-drag.originY,12))return;
    event.preventDefault();
    if(!drag.started && hidden.length)expanded=true;
    drag={...drag,x:event.clientX,y:event.clientY,started:true};
    const bounds=root.getBoundingClientRect();
    if(vertical)root.scrollTop+=event.clientY>bounds.bottom-16?12:event.clientY<bounds.top+16?-12:0;
    else root.scrollLeft+=event.clientX>bounds.right-16?12:event.clientX<bounds.left+16?-12:0;
    const axis=vertical?'y':'x';
    const coordinate=(vertical?event.clientY-bounds.top+root.scrollTop:event.clientX-bounds.left+root.scrollLeft);
    const inside=event.clientX>=bounds.left && event.clientX<=bounds.right && event.clientY>=bounds.top && event.clientY<=bounds.bottom;
    const node=inside?Array.from(root.querySelectorAll<HTMLElement>('[data-home-drop]')).find(node=>{
      if(node.closest('[inert]') || !node.offsetWidth || !node.offsetHeight)return false;
      const start=layoutOffset(node,root,axis);
      return coordinate>=start && coordinate<=start+(vertical?node.offsetHeight:node.offsetWidth);
    }):undefined;
    drop=null;
    if(!node)return;
    const group=node.dataset.homeDrop==='visible'?'visible':'hidden';
    if(group==='hidden')expanded=true;
    const buttons=Array.from(node.querySelectorAll<HTMLElement>('[data-section]')).filter(button=>button.dataset.section!==drag!.section);
    const direction=(vertical?event.clientY-drag.originY:event.clientX-drag.originX)>=0?1:-1;
    const index=buttons.length?insertionIndex(buttons,root,coordinate,axis,direction,8):group==='hidden'?hidden.length:0;
    drop={group,index};
  }
  function update(order:HomeSection[],section:HomeSection){
    onchange(order);
    const index=order.indexOf(section);
    announcement=index<0?$t('{name} hidden',{name:label(section)}):$t('{name} moved to position {position}',{name:label(section),position:index+1});
  }
  function end(event?:PointerEvent,cancel=false){
    if(!drag || (event && event.pointerId!==drag.pointer))return;
    if(drag.started){
      suppressClick=true;
      if(drop && !cancel){
        if(drop.group==='visible')update(moveShelf(sections,drag.section,drop.index),drag.section);
        else{homeHiddenOrder.set(moveShelf(hidden,drag.section,drop.index));if(sections.includes(drag.section))update(sections.filter(section=>section!==drag!.section),drag.section);}
      }
    }
    clearHold();drag=null;drop=null;
  }
  function choose(section:HomeSection,visible:boolean){
    if(suppressClick){suppressClick=false;return;}
    expanded=false;onchoose(section,visible);
  }
  async function keys(event:KeyboardEvent,section:HomeSection,visible:boolean){
    if(!event.altKey)return;
    if(['ArrowLeft','ArrowRight'].includes(event.key)){
      event.preventDefault();const order=visible?sections:hidden;const next=order.indexOf(section)+(event.key==='ArrowLeft'?-1:1);
      if(next>=0 && next<order.length)reorder(section,event.key==='ArrowLeft'?-1:1);
    }else if((visible && event.key==='ArrowDown') || (!visible && event.key==='ArrowUp')){
      event.preventDefault();toggle(section);
      await tick();focusDock();
    }
  }
  function positionPreview(node:HTMLElement,point:{x:number;y:number}){
    const position=(point:{x:number;y:number})=>{const box=node.getBoundingClientRect();node.style.left=Math.max(8,Math.min(point.x+12,innerWidth-box.width-8))+'px';node.style.top=Math.max(8,Math.min(point.y+12,innerHeight-box.height-8))+'px';};
    position(point);
    return {update:position};
  }
  function measureSize(node:HTMLElement){
    const observer=new ResizeObserver(()=>{
      const {width,height}=node.getBoundingClientRect();
      hiddenWidth=width;hiddenHeight=height;
    });
    observer.observe(node);
    return {destroy:()=>observer.disconnect()};
  }

</script>
<svelte:window onresize={()=>end(undefined,true)} onpointermove={move} onpointerup={event=>end(event)} onpointercancel={event=>end(event,true)} onpointerdown={event=>{suppressClick=false;if(expanded && event.target instanceof Node && !root?.contains(event.target))expanded=false;}} onkeydown={event=>{if(event.key==='Escape'){if(menu){menu=null;focusDock();}else if(drag)end(undefined,true);else if(expanded){expanded=false;focusDock();}}}}/>
<div dir="ltr" class="home-dock-position" data-position={$homeDockPosition} class:vertical>
  <div class="home-dock-anchor"
    style:position={drag && showTargets?'fixed':undefined}
    style:width={drag && showTargets?'max-content':undefined}
    style:left={drag && showTargets?`${dragLeft}px`:undefined}
    style:top={drag && showTargets?`${dragTop}px`:undefined}
    style:translate={drag && showTargets?`min(0px, calc(${drag.bounds.right - dragLeft}px - 100%)) min(0px, calc(${drag.bounds.bottom - dragTop}px - 100%))`:undefined}
    style:max-width={drag && showTargets?`${drag.bounds.width}px`:undefined}
    style:max-height={drag && showTargets?`${drag.bounds.height}px`:undefined}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions (The navigation landmark offers a context menu through both pointer and keyboard.) -->
    <nav class="home-dock" class:vertical bind:this={root} tabindex="-1" aria-label={$t('Home sections')} oncontextmenu={context} onkeydown={contextKeys}>
      <div class="dock-group visible-tools" class:inactive={!sections.length && !showTargets} class:empty-visible={!sections.length && showTargets} class:drop-empty={!sections.length && drop?.group==='visible'} role="group" aria-label={$t('Visible sections')} data-home-drop="visible">
        {#if !sections.length && showTargets}<span class="empty-drop" aria-hidden="true">+</span>{/if}
        {@render items(shown,true)}
      </div>
      {#if hideTarget}<div class="hide-target" class:drop-hidden={drop?.group==='hidden'} data-home-drop="hidden" role="group" aria-label={$t('Hide shelf')}><span aria-hidden="true">−</span></div>{/if}
      <div class="dock-reveal" class:expanded style:width={vertical?undefined:expanded && hidden.length?`${hiddenWidth}px`:'0px'} style:height={vertical?(expanded && hidden.length?`${hiddenHeight}px`:'0px'):'auto'} inert={!expanded} aria-hidden={!expanded}>
        <div class="dock-group hidden-tools" class:no-visible={!sections.length} use:measureSize id="home-hidden-tools" role="group" aria-label={$t('Hidden sections')} data-home-drop="hidden">
          {@render items(shownHidden,false)}
        </div>
      </div>
      {#if hidden.length}<Button shape="dock" class="dock-label" data-home-more data-home-drop="hidden" aria-label={$t(expanded?'Collapse':'More')} aria-expanded={expanded} aria-controls="home-hidden-tools" onclick={()=>{if(suppressClick){suppressClick=false;return;}expanded=!expanded;}}><span class="dock-toggle" aria-hidden="true">{#if !expanded && !sections.length}⋯{:else}<DirectionIcon logical={false} direction={toggleDirection}/>{/if}</span></Button>{/if}
    </nav>
  </div>
</div>
{#if menu}<HomeDockMenu {...menu} {sections} {hidden} onmove={reorder} ontoggle={toggle} onclose={()=>menu=null}/>{/if}
{#if drag?.started}<div class="dock-drag" use:positionPreview={{x:drag.x,y:drag.y}} aria-hidden="true">{label(drag.section)}</div>{/if}
<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
{#snippet items(order:HomeSection[],visible:boolean)}
  {#each order as section (section)}
    <div class="dock-item" animate:flip={{duration:$presentation.motion?160:0}} class:dragging={drag?.started && drag.section===section}>
      <Button shape="dock" class="dock-label" selected={active===section} aria-current={active===section?(visible?'location':'page'):undefined} data-section={section} aria-label={label(section)} aria-keyshortcuts={visible?'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowDown':'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp'} onpointerdown={event=>begin(event,section)} onkeydown={event=>keys(event,section,visible)} onclick={()=>choose(section,visible)}><span dir="auto" class="dock-text">{label(section)}</span></Button>
    </div>
  {/each}
{/snippet}
<style>
  .home-dock-position{position:fixed;left:calc(var(--rail-width) + 0.85714286rem);right:0.85714286rem;top:1.14285714rem;bottom:1.14285714rem;display:flex;align-items:flex-end;justify-content:center;z-index:15;pointer-events:none}
  .home-dock-anchor{position:relative;max-width:100%;max-height:100%;display:flex;pointer-events:auto}
  .home-dock{--focus-ring:var(--theme-surface-muted);--icon-ink:var(--icon-on-surface);--text:var(--theme-surface-text);--muted:var(--theme-surface-muted);display:flex;align-items:center;padding:calc(4 * var(--pixel));background:var(--theme-surface);border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-raised),var(--shadow-drop);max-width:100%;max-height:100%;min-width:0;min-height:0;overflow:auto}
  .dock-group{position:relative;display:flex;gap:calc(2 * var(--pixel));flex-shrink:0;align-items:center;min-width:var(--pixel)}
  .visible-tools{margin-right:calc(2 * var(--pixel))}
  .visible-tools.inactive{display:none}
  .empty-visible,.hide-target{display:grid;place-items:center;flex:none;width:2.85714286rem;height:2.85714286rem;border:var(--stroke) dashed var(--edge);color:var(--muted);font-size:1.71428571rem;box-shadow:var(--bevel-inset)}
  .hide-target{margin-right:calc(2 * var(--pixel))}
  .empty-drop{display:grid;place-items:center;pointer-events:none}
  .empty-visible.drop-empty,.hide-target.drop-hidden{border-color:var(--muted);background:var(--surface)}
  .home-dock :global(.dock-label){width:auto;min-width:2.85714286rem;padding:0 0.85714286rem;white-space:nowrap;font-size:1rem;line-height:1}
  .dock-text{display:block;translate:0 -1px}
  .home-dock :global(.dock-label[data-selected]::before){translate:0 0}
  .dock-toggle{display:grid;place-items:center;width:1.71428571rem;height:1.71428571rem;font-size:1.71428571rem;line-height:1}
  .dock-item{position:relative;flex:none;touch-action:none}
  .dragging{opacity:.6}
  .dock-reveal{flex-shrink:0;overflow:hidden;opacity:0;transition:width var(--motion-layout) ease-out,height var(--motion-layout) ease-out,opacity var(--motion-fast) ease-out}
  .dock-reveal.expanded{opacity:1;margin-right:calc(2 * var(--pixel))}
  .hidden-tools{width:max-content;padding-left:calc(12 * var(--pixel));border-left:var(--divider) solid var(--edge)}
  .hidden-tools.no-visible{padding-left:0;border-left:0}
  .dock-drag{max-width:calc(100vw - 1rem);overflow-wrap:anywhere;position:fixed;z-index:1000;pointer-events:none;background:var(--surface);padding:0.57142857rem;border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-raised),var(--shadow-drop)}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .home-dock-position[data-position^='top-']{align-items:flex-start}
  .home-dock-position[data-position^='middle-']{align-items:center}
  .home-dock-position[data-position$='-left']{justify-content:flex-start}
  .home-dock-position[data-position$='-right']{justify-content:flex-end}
  .vertical .home-dock,.vertical .dock-group{flex-direction:column;align-items:stretch}
  .vertical .home-dock{width:max-content}
  .vertical .dock-reveal{align-self:stretch}
  .vertical .hidden-tools{width:auto}
  .vertical .dock-item{display:flex}
  .vertical :global(.dock-label){width:100%;justify-content:center}
  .vertical .visible-tools{margin-right:0;margin-bottom:calc(2 * var(--pixel))}
  .vertical .dock-reveal.expanded{margin-right:0;margin-bottom:calc(2 * var(--pixel))}
  .vertical .hidden-tools{padding-left:0;border-left:0;padding-top:calc(12 * var(--pixel));border-top:var(--divider) solid var(--edge)}
  .vertical .hidden-tools.no-visible{padding-top:0;border-top:0}
  .vertical .empty-visible,.vertical .hide-target{width:100%;min-height:2.85714286rem;align-self:stretch}
  .vertical .hide-target{margin-right:0;margin-bottom:calc(2 * var(--pixel))}
  @media(prefers-reduced-motion:reduce){.dock-reveal{transition:none}}
  :global(:root[dir="rtl"]) .home-dock-position{left:.85714286rem;right:calc(var(--rail-width) + .85714286rem)}
</style>
