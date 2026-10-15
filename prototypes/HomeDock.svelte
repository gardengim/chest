<script lang="ts">
  import SectionIcon from './SectionIcon.svelte';
  let {sections,active,onselect,oncustomize}:{sections:readonly string[];active:string;onselect:(section:string)=>void;oncustomize:(event:MouseEvent)=>void}=$props();
  const width=$derived((sections.length+1)*36+8);
  const selected=$derived(sections.indexOf(active));
  function rectangle(x:number,y:number,w:number,h:number){return `M${x} ${y}h${w}v${h}h-${w}z`;}
  const holes=$derived(Array.from({length:sections.length+1},(_,index)=>rectangle(6+index*36,10,32,32)).join(' '));
</script>
<nav class="home-dock" aria-label="Home sections" style:width={`${width*1.25}px`}>
  <svg class="dock-frame" width={width*1.25} height="65" viewBox={`0 0 ${width} 52`} shape-rendering="crispEdges" aria-hidden="true">
    <!-- One continuous stone housing, with genuinely transparent openings. -->
    <path d={`${rectangle(1,5,width-2,42)} ${holes}`} fill="var(--frame)" fill-rule="evenodd"/>
    <path d={`${rectangle(2,6,width-4,40)} ${holes}`} fill="var(--dock-stone)" fill-rule="evenodd"/>
    <path d={`M2 6h${width-4}v1H3v39H2z`} fill="white" opacity=".4"/>
    <path d={`M${width-3} 7h1v39H3v-1h${width-6}z`} fill="black" opacity=".4"/>
    {#each Array(sections.length+1) as _,index}
      {@const x=6+index*36}
      <rect {x} y="10" width="32" height="32" fill="var(--dock-fill)"/>
      <path d={`M${x-1} 9h34v1h-33v33h-1z`} fill="black" opacity=".55"/>
      <path d={`M${x+32} 10h1v33h-33v-1h32z`} fill="white" opacity=".25"/>
      <g transform={`translate(${x} 10)`}><SectionIcon section={sections[index] || 'More'} size={32}/></g>
    {/each}

  </svg>
  <div class="dock-items">
    {#each sections as section}
      <a href={`#shelf-${section}`} aria-label={section} title={section} aria-current={active===section?'location':undefined} onclick={event=>{event.preventDefault();onselect(section);}}></a>
    {/each}
    <button type="button" aria-label="Customize home" title="Customize home" aria-haspopup="dialog" onclick={oncustomize}></button>
  </div>
  <svg class="dock-selector" width={width*1.25} height="65" viewBox={`0 0 ${width} 52`} shape-rendering="crispEdges" aria-hidden="true">
    {#if selected>=0}
      {@const x=selected*36}
      <!-- Raised selection: a broad stone face, outer bevel, and inner recess. -->
      <path d={`${rectangle(x,4,44,44)} ${rectangle(x+6,10,32,32)}`} fill="var(--frame)" fill-rule="evenodd"/>
      <path d={`${rectangle(x+1,5,42,42)} ${rectangle(x+6,10,32,32)}`} fill="var(--inventory)" fill-rule="evenodd"/>
      <path d={`M${x+1} 5h42v1h-41v41h-1z`} fill="white" opacity=".6"/>
      <path d={`M${x+42} 6h1v41h-41v-1h40z`} fill="black" opacity=".47"/>
      <path d={`M${x+5} 9h34v1h-33v33h-1z`} fill="black" opacity=".47"/>
      <path d={`M${x+38} 10h1v33h-33v-1h32z`} fill="white" opacity=".4"/>
    {/if}
  </svg>
</nav>
<style>
.home-dock{--dock-stone:color-mix(in srgb,var(--inventory) 70%,black);--dock-fill:rgb(84 86 74 / 50%);position:fixed;left:calc(50% + 32px);bottom:18px;transform:translateX(-50%);z-index:5;height:65px;isolation:isolate}
.dock-frame,.dock-selector{position:absolute;inset:0;pointer-events:none;overflow:visible}.dock-frame{z-index:0}.dock-selector{z-index:2}
.dock-items{position:relative;z-index:1;display:flex;padding:7.5px 5px}
.dock-items a,.dock-items button{display:grid;place-items:center;flex:0 0 45px;width:45px;height:50px;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:#d0d2c3;text-decoration:none;cursor:pointer}
.dock-items a:hover,.dock-items button:hover{background:#ffffff0d}.dock-items a:focus-visible,.dock-items button:focus-visible{outline:var(--stroke) solid var(--focus-ring);outline-offset:-3px}.dock-items button:disabled{opacity:1;cursor:default}
@media(max-width:600px){.home-dock{bottom:10px}}
</style>
