<script lang="ts">
  import {tick} from 'svelte';
  import SectionIcon from './SectionIcon.svelte';
  let {sections,allSections,active,onselect,onopen,onorder}:{sections:readonly string[];allSections:readonly string[];active:string;onselect:(section:string)=>void;onopen:(section:string)=>void;onorder:(sections:string[])=>void}=$props();
  let expanded=$state(false),dock:HTMLElement,root:HTMLElement,more:HTMLButtonElement;
  let tray=$state<HTMLElement>();
  let drag=$state<{section:string;pointer:number;startX:number;startY:number;x:number;y:number;started:boolean}|null>(null);
  let target=$state<'dock'|'hidden'|null>(null),insertAt=$state(0),before=$state<string|null>(null),announcement=$state('');
  function alignDock(node:HTMLElement){
    function align(){node.parentElement!.style.left=`${Math.round((document.documentElement.clientWidth+64-node.offsetWidth)/2)}px`;}
    const observer=new ResizeObserver(align);observer.observe(node);window.addEventListener('resize',align);align();return {destroy(){observer.disconnect();window.removeEventListener('resize',align);}};
  }
  let suppressClick=false;
  let hovered=$state(''),focused=$state('');
  const hint=$derived((hovered || focused)==='__more__'?(expanded?'Collapse':'More'):(hovered || focused));
  function hintKey(event:Event){return event.target instanceof Element?event.target.closest<HTMLElement>('[data-hint]')?.dataset.hint || '':'';}
  const hidden=$derived(allSections.filter(section=>!sections.includes(section)));
  function begin(event:PointerEvent,section:string){if(event.button!==0)return;suppressClick=false;drag={section,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,started:false};}
  function contains(node:HTMLElement|undefined,x:number,y:number,padding=0){if(!node)return false;const rect=node.getBoundingClientRect();return x>=rect.left-padding && x<=rect.right+padding && y>=rect.top-padding && y<=rect.bottom+padding;}
  function move(event:PointerEvent){
    if(!drag || drag.pointer!==event.pointerId)return;
    if(!drag.started && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
    drag={...drag,started:true,x:event.clientX,y:event.clientY};event.preventDefault();target=null;before=null;
    if(contains(more,event.clientX,event.clientY)){expanded=true;target='hidden';return;}
    if(contains(dock,event.clientX,event.clientY,6)){
      target='dock';const items=[...dock.querySelectorAll<HTMLElement>('[data-dock-item]')].filter(item=>item.dataset.dockItem!==drag!.section);
      insertAt=items.filter(item=>{const rect=item.getBoundingClientRect();return event.clientX>rect.left+rect.width/2;}).length;
      before=items[insertAt]?.dataset.dockItem || null;
    }else if(expanded && contains(tray,event.clientX,event.clientY)){target='hidden';}
  }
  function finish(event?:PointerEvent,cancel=false){
    if(!drag || (event && event.pointerId!==drag.pointer))return;
    if(drag.started){suppressClick=true;if(!cancel && target){const order=sections.filter(section=>section!==drag!.section);if(target==='dock')order.splice(insertAt,0,drag.section);onorder(order);announcement=target==='dock'?`${drag.section} moved to position ${insertAt+1}`:`${drag.section} hidden`;}}
    drag=null;target=null;before=null;
  }
  function choose(event:MouseEvent,section:string,isHidden=false){event.preventDefault();if(suppressClick){suppressClick=false;return;}if(isHidden){expanded=false;onopen(section);}else{expanded=false;onselect(section);}}
  function keys(event:KeyboardEvent,section:string,isHidden=false){
    if(!event.altKey)return;
    if((isHidden && event.key==='ArrowUp') || (!isHidden && event.key==='ArrowDown')){event.preventDefault();onorder(isHidden?[...sections,section]:sections.filter(item=>item!==section));announcement=`${section} ${isHidden?'shown':'hidden'}`;void tick().then(()=>more.focus());return;}
    if(isHidden || !['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const order=[...sections],from=order.indexOf(section),to=from+(event.key==='ArrowLeft'?-1:1);if(to<0 || to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];onorder(order);announcement=`${section} moved to position ${to+1}`;
  }

</script>
<svelte:window onpointermove={move} onpointerup={event=>finish(event)} onpointercancel={event=>finish(event,true)} onkeydown={event=>{if(event.key==='Escape'){if(drag)finish(undefined,true);else if(expanded){expanded=false;more?.focus();}}}} onpointerdown={event=>{suppressClick=false;if(expanded && !(event.target instanceof Node && root?.contains(event.target)))expanded=false;}}/>
<div class="dock-container">
  {#if hint && !drag?.started}<div class="dock-hint" id="dock-hint" role="tooltip">{hint}</div>{/if}
  <nav class="home-dock" bind:this={root} use:alignDock aria-label="Home sections" onpointerover={event=>hovered=hintKey(event)} onpointerleave={()=>hovered=''} onfocusin={event=>{focused=event.target instanceof Element && event.target.matches(':focus-visible')?hintKey(event):'';}} onfocusout={()=>focused=''}>
    <div class="visible-group" bind:this={dock} role="group" aria-label="Visible sections" class:drop-end={target==='dock' && !before}>
      {#each sections as section (section)}
        <a href={`#shelf-${section}`} data-dock-item={section} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowDown" aria-label={section} data-hint={section} aria-describedby={hint===section?'dock-hint':undefined} aria-current={active===section?'location':undefined} class:dragging={drag?.started && drag.section===section} class:drop-before={target==='dock' && before===section} onpointerdown={event=>begin(event,section)} ondragstart={event=>event.preventDefault()} onkeydown={event=>keys(event,section)} onclick={event=>choose(event,section)}>
          {#if active===section}<div class="selection-surface" aria-hidden="true"></div>{/if}<span class="tool-icon"><SectionIcon {section} size={32}/></span>
        </a>
      {/each}
    </div>
    <div class="hidden-reveal" class:expanded style:width={expanded?`${hidden.length*42+11}px`:'0px'} inert={!expanded} aria-hidden={!expanded}>
      <div id="hidden-section-tray" class="hidden-group" bind:this={tray} role="group" aria-label="Hidden sections" class:drop-hidden={target==='hidden'}>
        {#each hidden as section (section)}<a href={`#page-${section}`} aria-label={section} data-hint={section} aria-describedby={hint===section?'dock-hint':undefined} class:dragging={drag?.started && drag.section===section} onpointerdown={event=>begin(event,section)} ondragstart={event=>event.preventDefault()} aria-keyshortcuts="Alt+ArrowUp" onkeydown={event=>keys(event,section,true)} onclick={event=>choose(event,section,true)}><SectionIcon {section} size={32}/></a>{/each}
      </div>

    </div>
    <button class="more" type="button" bind:this={more} aria-label={expanded?'Collapse':'More'} data-hint="__more__" aria-describedby={hint===(expanded?'Collapse':'More')?'dock-hint':undefined} aria-expanded={expanded} aria-controls="hidden-section-tray" onclick={()=>{if(suppressClick){suppressClick=false;return;}expanded=!expanded;}}><SectionIcon section={expanded?'Collapse':'More'} size={32}/></button>
  </nav>
</div>
{#if drag?.started}<div class="drag-ghost" style:left={`${drag.x+12}px`} style:top={`${drag.y+12}px`} aria-hidden="true"><SectionIcon section={drag.section} size={32}/></div>{/if}
<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
<style>
.dock-container{position:fixed;left:calc(50% + 32px);bottom:18px;z-index:5}.dock-hint{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);padding:7px 11px;background:var(--surface);color:#e5e7e4;border:var(--pixel) solid var(--frame);box-shadow:var(--bevel-raised);font-size:12px;white-space:nowrap;pointer-events:none}.home-dock{display:flex;gap:2px;padding:4px;background:#282a2c;border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-raised),0 var(--depth) 0 var(--bevel-shadow)}
.home-dock a,.home-dock button{position:relative;display:grid;place-items:center;width:40px;height:40px;padding:0;margin:0;background:transparent;border:0;border-radius:0;box-shadow:none;color:#929799;cursor:pointer}
a{touch-action:none;user-select:none}a:hover,.home-dock button:hover{background:#ffffff09;color:#e0e3e0}.home-dock a[aria-current]{color:#c3cfb5}.selection-surface{position:absolute;inset:0;pointer-events:none;background:var(--surface);box-shadow:var(--bevel-raised),0 var(--depth) 0 var(--bevel-shadow);transform:translateY(calc(-1 * var(--pixel)))}.tool-icon{position:relative;display:grid;place-items:center}
a:focus-visible,button:focus-visible{outline:var(--stroke) solid var(--focus-ring);outline-offset:-2px}.home-dock button.more{margin-left:4px;border-left:var(--divider) solid #ffffff18}
.hidden-reveal{overflow:hidden;opacity:0;transition:width 180ms ease-out,opacity 140ms ease-out}.hidden-reveal.expanded{opacity:1}.visible-group,.hidden-group{position:relative;display:flex;gap:2px;align-items:center}.visible-group{min-width:8px}.hidden-group{width:max-content;min-width:0;border-left:var(--divider) solid #ffffff24;margin-left:6px;padding-left:6px}.hidden-group a{color:#a8adb0;flex:0 0 40px}.dragging{opacity:.3}.drop-before::before,.visible-group.drop-end::after{content:'';position:absolute;left:-3px;top:3px;bottom:3px;width:var(--stroke);background:var(--focus-ring)}.visible-group.drop-end::after{left:auto;right:-3px}.drop-hidden{outline:var(--stroke) solid var(--focus-ring);outline-offset:2px}
.drag-ghost{position:fixed;z-index:1000;pointer-events:none;padding:10px;background:var(--surface);color:#d2d9cb;border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-raised)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media(prefers-reduced-motion:reduce){.hidden-reveal{transition:none}}
@media(max-width:600px){.dock-container{bottom:10px}}
</style>
