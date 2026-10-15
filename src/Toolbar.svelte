<script lang="ts" module>
  export interface ToolbarItem {id:string;label:string;content:import('svelte').Snippet;priority?:number;}
</script>
<script lang="ts">
  import Icon from './Icon.svelte';
  import {tick,untrack,type Snippet} from 'svelte';
  import SearchField from './SearchField.svelte';
  import Button from './Button.svelte';
  import {t} from './i18n';
  let {label,heading,trailing,navigation,searchLabel,value=$bindable(''),placeholder,maxlength,onsearch,filters,status,items=[]}:{label?:string;heading?:Snippet;trailing?:Snippet;navigation?:Snippet;searchLabel?:string;value?:string;placeholder?:string;maxlength?:number;onsearch?:(event:Event)=>void;filters?:Snippet;status?:Snippet;items?:ToolbarItem[]}=$props();
  let root:HTMLDivElement,menu:HTMLDivElement;
  let more=$state<HTMLSpanElement>();
  let hidden=$state<string[]>([]),open=$state(false);
  let widths=new Map<string,number>();
  let generation=0;
  const visible=$derived(items.filter(item=>!hidden.includes(item.id)));
  const overflow=$derived(items.filter(item=>hidden.includes(item.id)));
  async function reset(){const current=++generation;hidden=[];await tick();if(current===generation)measure();}
  function measure(){
    if(!root || !root.clientWidth)return;
    const row=root.querySelector<HTMLElement>('.toolbar-row')!;
    for(const node of Array.from(row.querySelectorAll<HTMLElement>('[data-tool]')))widths.set(node.dataset.tool!,node.getBoundingClientRect().width);
    const font=parseFloat(getComputedStyle(root).fontSize);
    const gap=parseFloat(getComputedStyle(row).columnGap);
    const title=row.querySelector<HTMLElement>('.toolbar-title');
    const trailingWidth=row.querySelector<HTMLElement>('.toolbar-trailing')?.getBoundingClientRect().width || 0;
    const nav=row.querySelector<HTMLElement>('.toolbar-navigation');
    const titleWidth=title?.firstElementChild?.getBoundingClientRect().width || 0;
    const navWidth=nav?.getBoundingClientRect().width || 0;
    // Keep a useful search field before spending space on secondary actions.
    const searchWidth=searchLabel?Math.min(12*font,root.clientWidth):0;
    const fields=row.querySelector<HTMLElement>('.toolbar-filters');
    const fieldsWidth=fields?.getBoundingClientRect().width || 0;
    const base=trailingWidth+searchWidth+fieldsWidth+navWidth+(titleWidth && root.clientWidth>40*font?titleWidth:0);
    const fixedCount=Number(!!trailing)+Number(!!searchLabel)+Number(!!fields)+Number(!!nav)+Number(!!title && root.clientWidth>40*font);
    let remaining=[...items];
    const needed=()=>base+remaining.reduce((sum,item)=>sum+(widths.get(item.id)||6*font),0)+gap*Math.max(0,fixedCount+remaining.length-1)+(remaining.length<items.length?2.6*font+gap:0);
    for(const item of [...items].sort((a,b)=>(a.priority??0)-(b.priority??0))){if(needed()<=root.clientWidth)break;remaining=remaining.filter(other=>other.id!==item.id);}
    const next=items.filter(item=>!remaining.includes(item)).map(item=>item.id);
    if(next.join()!==hidden.join())hidden=next;
    if(!next.length && open){menu?.hidePopover();open=false;}
  }
  function observe(node:HTMLDivElement){
    let frame=0;
    const update=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;measure();});};
    const resize=new ResizeObserver(update);resize.observe(node);
    const probe=node.querySelector<HTMLElement>('.toolbar-scale')!;resize.observe(probe);
    return {destroy(){generation++;cancelAnimationFrame(frame);resize.disconnect();}};
  }
  const itemSignature=$derived(JSON.stringify(items.map(({id,label,priority})=>[id,label,priority])));
  $effect(()=>{itemSignature;$t;untrack(()=>{widths.clear();void reset();});});
  $effect(()=>{void navigation;untrack(()=>{void tick().then(measure);});});
  async function toggle(){if(open){menu.hidePopover();return;}open=true;await tick();menu.showPopover();const box=more!.getBoundingClientRect();const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(box.right-bounds.width,innerWidth-bounds.width-8))+'px';menu.style.top=Math.max(8,Math.min(box.bottom+4,innerHeight-bounds.height-8))+'px';menu.querySelector<HTMLElement>('button,select,input')?.focus();}
  function dismiss(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();menu.hidePopover();more?.querySelector('button')?.focus();}}
</script>
<div class="collection-toolbar" role={label?'group':undefined} aria-label={label} bind:this={root} use:observe>
  <span class="toolbar-scale" aria-hidden="true"></span>
  <div class="toolbar-row" class:has-heading={!!heading}>
    {#if heading}<div class="toolbar-title">{@render heading()}</div>{/if}
    {#each visible.filter(item=>item.priority===100) as item (item.id)}<div class="toolbar-item toolbar-primary" data-tool={item.id}>{@render item.content()}</div>{/each}
    {#if searchLabel}<div class="toolbar-search"><SearchField label={searchLabel} bind:value {placeholder} {maxlength} oninput={onsearch}/></div>{/if}
    {#if filters}<div class="toolbar-filters">{@render filters()}</div>{/if}
    {#each visible.filter(item=>item.priority!==100) as item (item.id)}<div class="toolbar-item" data-tool={item.id}>{@render item.content()}</div>{/each}
    {#if status}<span class="toolbar-status" role="status">{@render status()}</span>{/if}
    {#if overflow.length}<span class="toolbar-more" bind:this={more}><Button aria-label={$t('More actions')} aria-expanded={open} aria-haspopup="dialog" onclick={toggle}><Icon name="more" size={18}/></Button></span>{/if}
    {#if navigation}<div class="toolbar-navigation">{@render navigation()}</div>{/if}
    {#if trailing}<div class="toolbar-trailing">{@render trailing()}</div>{/if}
  </div>
  <div class="inventory-dropdown toolbar-overflow" popover="auto" role="dialog" tabindex="-1" aria-label={$t('More actions')} bind:this={menu} ontoggle={event=>open=event.newState==='open'} onkeydown={dismiss}>
    {#if open}{#each overflow as item (item.id)}<div class="overflow-item" aria-label={item.label}>{@render item.content()}</div>{/each}{/if}
  </div>
</div>
<style>
.collection-toolbar{min-width:0;max-width:100%;container-type:inline-size;margin-bottom:1.28571429rem}
.toolbar-scale{position:absolute;width:1rem;height:1rem;visibility:hidden;pointer-events:none}
.toolbar-row{display:flex;align-items:center;justify-content:flex-end;gap:.85714286rem;flex-wrap:wrap;min-width:0}
.toolbar-trailing{order:6;flex:0 0 auto;min-width:0;max-width:100%;margin-left:auto}
.toolbar-title{order:0;flex:1 1 auto;min-width:0}.toolbar-title :global(h2){display:inline-flex;align-items:center;gap:.71428571rem;margin:0;font-size:1.42857143rem;flex-wrap:wrap}
.toolbar-search{order:2;flex:1 1 12rem;max-width:24rem;min-width:0}.toolbar-row:not(.has-heading) .toolbar-search{max-width:none}
.toolbar-primary{order:1}.toolbar-item:not(.toolbar-primary){order:3}.toolbar-item{flex:0 1 auto;min-width:0;max-width:100%}.toolbar-filters{order:3;flex:0 1 14rem;min-width:0;max-width:100%}.toolbar-filters :global(label){margin:0;min-width:0}
.toolbar-status{order:2;margin-right:auto;color:var(--navigation-text);font-size:.85714286rem;min-width:0}
.toolbar-more{order:4;flex:none}.toolbar-navigation{order:5;flex:0 0 auto;max-width:100%}
.toolbar-overflow{max-width:calc(100vw - 1rem);max-height:calc(100dvh - 1rem);padding:.71428571rem}
.toolbar-overflow:popover-open{display:grid;gap:.71428571rem}.overflow-item{min-width:0}.overflow-item :global(.ui-button){width:100%}
@container(max-width:40rem){.toolbar-title{order:-2;flex-basis:100%}.toolbar-title :global(h2){max-width:100%}.toolbar-search{max-width:none;flex-basis:8rem}.toolbar-row{justify-content:flex-start}.toolbar-navigation{margin-left:auto}}
</style>
