<script lang="ts" module>
  export type ScrollMetrics={viewport:number;total:number;position:number};
</script>
<script lang="ts">
  import {locale} from './preferences';
  let {scroller,targetId,orientation='vertical',placement='page',label,onmeasure}:{scroller?:HTMLElement;targetId?:string;orientation?:'vertical'|'horizontal';placement?:'page'|'container';label:string;onmeasure?:(metrics:ScrollMetrics)=>void}=$props();
  let visible=$state(false),viewport=$state(0),total=$state(0),position=$state(0);
  let target:HTMLElement|null=null;
  let rtl=$state(false);
  let hiding:ReturnType<typeof setTimeout>|undefined;
  const horizontal=$derived(orientation==='horizontal');
  const maximum=$derived(Math.max(0,total-viewport));
  const thumb=$derived(Math.min(viewport,Math.max(32,viewport*viewport/(total || 1))));
  const logicalOffset=$derived(maximum?position/maximum*(viewport-thumb):0);
  const offset=$derived(horizontal && rtl?viewport-thumb-logicalOffset:logicalOffset);
  function reveal(){visible=true;clearTimeout(hiding);hiding=setTimeout(()=>visible=false,1100);}
  $effect(()=>{
    void $locale;
    const node=scroller || (targetId?document.getElementById(targetId):null);
    const axis=horizontal;
    if(!node)return;
    target=node;rtl=axis && getComputedStyle(node).direction==='rtl';
    const wasHost=node.classList.contains('pixel-scroll-host');node.classList.add('pixel-scroll-host');
    let frame=0;
    const update=()=>{
      viewport=axis?node.clientWidth:node.clientHeight;
      total=axis?node.scrollWidth:node.scrollHeight;
      position=Math.max(0,Math.min(total-viewport,axis?node.scrollLeft*(rtl?-1:1):node.scrollTop));
      onmeasure?.({viewport,total,position});
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
    const observer=new ResizeObserver(schedule);observer.observe(node);
    const children=new Set<Element>();
    const observe=()=>{
      for(const child of children)if(child.parentElement!==node){observer.unobserve(child);children.delete(child);}
      for(const child of Array.from(node.children))if(!children.has(child)){children.add(child);observer.observe(child);}
      schedule();
    };
    const mutations=new MutationObserver(observe);mutations.observe(node,{childList:true,subtree:true});observe();
    const scroll=()=>{schedule();reveal();};
    node.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',schedule);
    schedule();reveal();
    return()=>{
      clearTimeout(hiding);cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();
      node.removeEventListener('scroll',scroll);window.removeEventListener('resize',schedule);
      if(!wasHost)node.classList.remove('pixel-scroll-host');target=null;
    };
  });
  function move(value:number){target?.scrollTo(horizontal?{left:value*(rtl?-1:1),behavior:'instant'}:{top:value,behavior:'instant'});}
  function drag(event:PointerEvent){
    if(event.button!==0 || viewport<=thumb)return;
    event.preventDefault();reveal();
    const track=event.currentTarget as HTMLElement,box=track.getBoundingClientRect();
    const coordinate=(event:PointerEvent)=>(horizontal?event.clientX-box.left:event.clientY-box.top);
    const point=coordinate(event),grab=point>=offset && point<=offset+thumb?point-offset:thumb/2;
    const update=(event:PointerEvent)=>{const fraction=Math.max(0,Math.min(viewport-thumb,coordinate(event)-grab))/(viewport-thumb);move((rtl?1-fraction:fraction)*maximum);};
    update(event);track.setPointerCapture(event.pointerId);track.onpointermove=update;
    const release=()=>{track.onpointermove=null;track.onpointerup=null;track.onpointercancel=null;};
    track.onpointerup=release;track.onpointercancel=release;
  }
  function keys(event:KeyboardEvent){
    const step=40;
    const next:Record<string,number>={PageDown:position+viewport,PageUp:position-viewport,Home:0,End:maximum,
      ...(horizontal?{ArrowRight:position+(rtl?-step:step),ArrowLeft:position+(rtl?step:-step)}:{ArrowDown:position+step,ArrowUp:position-step})};
    if(event.key in next){event.preventDefault();move(next[event.key]);reveal();}
  }
</script>
{#if maximum>1}
  <div class="pixel-scrollbar" class:visible class:page-scrollbar={!horizontal} data-orientation={orientation} data-placement={placement} role="scrollbar" tabindex="0" aria-label={label} aria-controls={targetId || scroller?.id || undefined} aria-orientation={orientation} aria-valuemin="0" aria-valuemax={maximum} aria-valuenow={Math.round(position)} onpointerdown={drag} onkeydown={keys}>
    <div class="thumb" style:width={horizontal?`${thumb}px`:undefined} style:height={horizontal?undefined:`${thumb}px`} style:transform={`translate${horizontal?'X':'Y'}(${offset}px)`}></div>
  </div>
{/if}
