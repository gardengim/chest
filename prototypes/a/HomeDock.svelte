<script lang="ts">
  import {tick} from 'svelte';
  import SectionIcon from './SectionIcon.svelte';
  let {sections,allSections,active,onselect,onopen,onorder}:{sections:readonly string[];allSections:readonly string[];active:string;onselect:(section:string)=>void;onopen:(section:string)=>void;onorder:(sections:string[])=>void}=$props();
  let expanded=$state(false),dock:HTMLElement,root:HTMLElement,more:HTMLButtonElement;
  let tray=$state<HTMLElement>();
  let drag=$state<{section:string;pointer:number;startX:number;startY:number;x:number;y:number;started:boolean}|null>(null);
  let target=$state<'dock'|'hidden'|null>(null),insertAt=$state(0),before=$state<string|null>(null),announcement=$state('');
  let surface=$state<{width:number;height:number;slots:{section:string;x:number;y:number;hidden:boolean}[];hiddenX:number;hiddenWidth:number}>({width:0,height:65,slots:[],hiddenX:0,hiddenWidth:0});
  function rectangle(x:number,y:number,w:number,h:number){return `M${x} ${y}h${Math.max(0,w)}v${h}h-${Math.max(0,w)}z`;}
  function measure(node:HTMLElement,_layout:unknown){
    function update(){const frame=node.getBoundingClientRect(),scale=frame.height/node.offsetHeight || 1,reveal=node.querySelector<HTMLElement>('.hidden-reveal')!.getBoundingClientRect();surface={width:frame.width/scale,height:frame.height/scale,hiddenX:(reveal.left-frame.left)/scale,hiddenWidth:reveal.width/scale,slots:[...node.querySelectorAll<HTMLElement>('[data-dock-item],[data-hidden-item],button.more')].map(item=>{const rect=item.getBoundingClientRect();return {section:item.dataset.dockItem || item.dataset.hiddenItem || (expanded?'Collapse':'More'),x:(rect.left-frame.left+rect.width/2)/scale-20,y:(rect.top-frame.top+rect.height/2)/scale-20,hidden:!!item.dataset.hiddenItem};})};}
    const observer=new ResizeObserver(update);observer.observe(node);void tick().then(update);return {update(){void tick().then(update);},destroy(){observer.disconnect();}};
  }
  const holes=$derived(surface.slots.map(slot=>{const left=slot.hidden?Math.max(slot.x,surface.hiddenX):slot.x,right=slot.hidden?Math.min(slot.x+40,surface.hiddenX+surface.hiddenWidth):slot.x+40;return right>left?rectangle(left,slot.y,right-left,40):'';}).join(' '));
  const selectedSlot=$derived(surface.slots.find(slot=>!slot.hidden && slot.section===active));
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
  <nav class="home-dock" bind:this={root} use:measure={{sections,expanded,hidden}} aria-label="Home sections" onpointerover={event=>hovered=hintKey(event)} onpointerleave={()=>hovered=''} onfocusin={event=>{focused=event.target instanceof Element && event.target.matches(':focus-visible')?hintKey(event):'';}} onfocusout={()=>focused=''}>
    <svg class="inventory-surface" width={surface.width} height={surface.height} viewBox={`0 0 ${surface.width || 1} ${surface.height}`} shape-rendering="crispEdges" aria-hidden="true">
      <defs><clipPath id="a-hidden-clip"><rect x={surface.hiddenX} y="0" width={surface.hiddenWidth} height={surface.height}/></clipPath></defs>
      <path d={`${rectangle(1,6,surface.width-2,surface.height-12)} ${holes}`} fill="var(--frame)" fill-rule="evenodd"/>
      <path d={`${rectangle(2,7,surface.width-4,surface.height-14)} ${holes}`} fill="var(--inventory-stone)" fill-rule="evenodd"/>
      <path d={`M2 7h${Math.max(0,surface.width-4)}v1H3v${surface.height-15}H2z`} fill="white" opacity=".4"/>
      <path d={`M${surface.width-3} 8h1v${surface.height-15}H3v-1h${Math.max(0,surface.width-6)}z`} fill="black" opacity=".4"/>
      {#each surface.slots as slot}
        <g clip-path={slot.hidden?'url(#a-hidden-clip)':undefined}>
          <rect x={slot.x} y={slot.y} width="40" height="40" fill="rgb(66 68 70 / 50%)"/>
          <path d={`M${slot.x-1} ${slot.y-1}h42v1h-41v41h-1z`} fill="black" opacity=".55"/>
          <path d={`M${slot.x+40} ${slot.y}h1v41h-41v-1h40z`} fill="white" opacity=".25"/>
          <g transform={`translate(${slot.x} ${slot.y})`} opacity={drag?.started && drag.section===slot.section?.toString()?'.3':'1'}><SectionIcon section={slot.section} size={40}/></g>
        </g>
      {/each}
    </svg>
    <div class="visible-group" bind:this={dock} role="group" aria-label="Visible sections" class:drop-end={target==='dock' && !before}>
      {#each sections as section (section)}
        <a href={`#shelf-${section}`} data-dock-item={section} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowDown" aria-label={section} data-hint={section} aria-describedby={hint===section?'dock-hint':undefined} aria-current={active===section?'location':undefined} class:dragging={drag?.started && drag.section===section} class:drop-before={target==='dock' && before===section} onpointerdown={event=>begin(event,section)} ondragstart={event=>event.preventDefault()} onkeydown={event=>keys(event,section)} onclick={event=>choose(event,section)}>
          
        </a>
      {/each}
    </div>
    <div class="hidden-reveal" class:expanded style:width={expanded?`${hidden.length*47+11}px`:'0px'} inert={!expanded} aria-hidden={!expanded}>
      <div id="hidden-section-tray" class="hidden-group" bind:this={tray} role="group" aria-label="Hidden sections" class:drop-hidden={target==='hidden'}>
        {#each hidden as section (section)}<a href={`#page-${section}`} data-hidden-item={section} aria-label={section} data-hint={section} aria-describedby={hint===section?'dock-hint':undefined} class:dragging={drag?.started && drag.section===section} onpointerdown={event=>begin(event,section)} ondragstart={event=>event.preventDefault()} aria-keyshortcuts="Alt+ArrowUp" onkeydown={event=>keys(event,section,true)} onclick={event=>choose(event,section,true)}></a>{/each}
      </div>

    </div>
    <button class="more" type="button" bind:this={more} aria-label={expanded?'Collapse':'More'} data-hint="__more__" aria-describedby={hint===(expanded?'Collapse':'More')?'dock-hint':undefined} aria-expanded={expanded} aria-controls="hidden-section-tray" onclick={()=>{if(suppressClick){suppressClick=false;return;}expanded=!expanded;}}></button>
    <svg class="inventory-selector" width={surface.width} height={surface.height} viewBox={`0 0 ${surface.width || 1} ${surface.height}`} shape-rendering="crispEdges" aria-hidden="true">
      {#if selectedSlot}
        {@const x=selectedSlot.x-7.5}{@const y=selectedSlot.y-7.5}
        <path d={`${rectangle(x,y,55,55)} ${rectangle(selectedSlot.x,selectedSlot.y,40,40)}`} fill="var(--frame)" fill-rule="evenodd"/>
        <path d={`${rectangle(x+1.25,y+1.25,52.5,52.5)} ${rectangle(selectedSlot.x,selectedSlot.y,40,40)}`} fill="color-mix(in srgb,var(--inventory) 86%,black)" fill-rule="evenodd"/>
        <path d={`M${x+1.25} ${y+1.25}h52.5v1.25h-51.25v51.25h-1.25z`} fill="white" opacity=".6"/>
        <path d={`M${x+52.5} ${y+2.5}h1.25v51.25H${x+2.5}v-1.25h50z`} fill="black" opacity=".47"/>
        <path d={`M${selectedSlot.x-1.25} ${selectedSlot.y-1.25}h42.5v1.25H${selectedSlot.x}v41.25h-1.25z`} fill="black" opacity=".47"/>
        <path d={`M${selectedSlot.x+40} ${selectedSlot.y}h1.25v41.25H${selectedSlot.x}V${selectedSlot.y+40}h40z`} fill="white" opacity=".4"/>
      {/if}
    </svg>
  </nav>
</div>
{#if drag?.started}<div class="drag-ghost" style:left={`${drag.x+12}px`} style:top={`${drag.y+12}px`} aria-hidden="true"><SectionIcon section={drag.section} size={24}/></div>{/if}
<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
<style>
.dock-container{position:fixed;left:calc(50% + 32px);bottom:18px;transform:translateX(-50%) scale(.9);transform-origin:50% 100%;z-index:5}.inventory-surface,.inventory-selector{position:absolute;inset:0;pointer-events:none;overflow:visible}.inventory-surface{z-index:0;color:#bec2c3}.inventory-selector{z-index:2}.visible-group,.hidden-reveal,.more{z-index:1}.dock-hint{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);padding:7px 11px;background:var(--surface);color:#e5e7e4;border:var(--pixel) solid var(--frame);box-shadow:var(--bevel-raised);font-size:12px;white-space:nowrap;pointer-events:none}.home-dock{--inventory-stone:color-mix(in srgb,var(--inventory) 62%,black);position:relative;isolation:isolate;display:flex;gap:2px;padding:7.5px 5px;background:transparent;border:0;box-shadow:none}
.home-dock a,.home-dock button{position:relative;display:grid;place-items:center;width:45px;height:50px;padding:0;margin:0;background:transparent;border:0;border-radius:0;box-shadow:none;color:#929799;cursor:pointer}
a{touch-action:none;user-select:none}a:hover,.home-dock button:hover{background:#ffffff09;color:#e0e3e0}.home-dock a[aria-current]{color:#c3cfb5}a:focus-visible,button:focus-visible{outline:var(--stroke) solid var(--focus-ring);outline-offset:-2px}.home-dock button.more{margin-left:4px;border-left:var(--divider) solid #ffffff18}
.hidden-reveal{overflow:hidden;opacity:0;transition:width 180ms ease-out,opacity 140ms ease-out}.hidden-reveal.expanded{opacity:1}.visible-group,.hidden-group{position:relative;display:flex;gap:2px;align-items:center}.visible-group{min-width:8px}.hidden-group{width:max-content;min-width:0;border-left:var(--divider) solid #ffffff24;margin-left:6px;padding-left:6px}.hidden-group a{color:#a8adb0;flex:0 0 45px}.dragging{opacity:.3}.drop-before::before,.visible-group.drop-end::after{content:'';position:absolute;left:-3px;top:3px;bottom:3px;width:var(--stroke);background:var(--focus-ring)}.visible-group.drop-end::after{left:auto;right:-3px}.drop-hidden{outline:var(--stroke) solid var(--focus-ring);outline-offset:2px}
.drag-ghost{position:fixed;z-index:1000;pointer-events:none;padding:10px;background:var(--surface);color:#d2d9cb;border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-raised)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media(prefers-reduced-motion:reduce){.hidden-reveal{transition:none}}
@media(max-width:600px){.dock-container{bottom:10px}}
</style>
