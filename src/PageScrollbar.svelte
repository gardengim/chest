<script lang="ts">
  import { t } from './i18n';
  import { onMount } from 'svelte';

  let scroller:HTMLElement | null=null;
  let height=$state(0);
  let total=$state(0);
  let position=$state(0);
  const maximum=$derived(Math.max(0,total-height));
  const thumb=$derived(Math.min(height,Math.max(32,height*height/(total||1))));
  const top=$derived(maximum ? position/maximum*(height-thumb) : 0);

  onMount(()=>{
    scroller=document.getElementById("main-content");
    if(!scroller)return;
    const update=()=>{
      height=scroller!.clientHeight;
      total=scroller!.scrollHeight;
      position=scroller!.scrollTop;
    };
    const observer=new ResizeObserver(update);
    observer.observe(scroller);
    for(const child of Array.from(scroller.children))observer.observe(child);
    scroller.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update);
    update();
    return()=>{
      observer.disconnect();
      scroller?.removeEventListener('scroll',update);
      window.removeEventListener('resize',update);
    };
  });

  function drag(event:PointerEvent){
    if(event.button!==0)return;
    event.preventDefault();
    const track=event.currentTarget as HTMLDivElement;
    const offset=event.clientY>=top&&event.clientY<=top+thumb ? event.clientY-top : thumb/2;
    const move=(y:number)=>scroller?.scrollTo({top:Math.max(0,y-offset)/(height-thumb)*maximum,behavior:'instant'});
    move(event.clientY);
    track.setPointerCapture(event.pointerId);
    track.onpointermove=e=>move(e.clientY);
    const release=()=>{track.onpointermove=null;track.onpointerup=null;track.onpointercancel=null;};
    track.onpointerup=release;
    track.onpointercancel=release;
  }

  function keys(event:KeyboardEvent){
    const next:Record<string,number>={ArrowDown:position+40,ArrowUp:position-40,PageDown:position+height,PageUp:position-height,Home:0,End:maximum};
    if(event.key in next){event.preventDefault();scroller?.scrollTo({top:next[event.key],behavior:'instant'});}
  }
</script>

{#if maximum>0}
  <div class="page-scrollbar" role="scrollbar" tabindex="0" aria-label={$t("Scroll page")} aria-controls="main-content" aria-orientation="vertical" aria-valuemin="0" aria-valuemax={maximum} aria-valuenow={Math.round(position)} onpointerdown={drag} onkeydown={keys}>
    <div class="thumb" style:height={`${thumb}px`} style:transform={`translateY(${top}px)`}></div>
  </div>
{/if}

<style>
  .page-scrollbar { position:fixed; inset:0 0 0 auto; width:12px; z-index:20; touch-action:none; background:transparent; }
  .thumb { width:8px; margin:0 2px; border-radius:0; background:var(--scroll-thumb); box-shadow:inset 1px 1px var(--scroll-highlight), inset -1px -1px var(--scroll-shadow); }
  .page-scrollbar:hover .thumb, .page-scrollbar:focus-visible .thumb { background:var(--scroll-thumb-hover); }
  .page-scrollbar:active .thumb { background:var(--scroll-thumb-active); }
  .page-scrollbar:focus-visible { outline:1px solid var(--scroll-highlight); outline-offset:-1px; }
</style>
