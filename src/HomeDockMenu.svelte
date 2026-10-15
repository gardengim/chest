<script lang="ts">
  import {tick} from 'svelte';
  import Button from './Button.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import type {Direction} from './directions';
  import {t} from './i18n';
  import {homeDockPosition,homeDockOrientation} from './preferences';
  import {sectionInfo,dockIsVertical,type HomeSection,type DockPosition} from './home-layout';
  let {section,sections,hidden,trigger,x,y,onmove,ontoggle,onclose}:{section:HomeSection|null;sections:HomeSection[];hidden:HomeSection[];trigger:HTMLElement;x:number;y:number;onmove:(section:HomeSection,delta:number)=>void;ontoggle:(section:HomeSection)=>void;onclose:()=>void}=$props();
  const visible=$derived(!!section && sections.includes(section));
  const order=$derived(visible?sections:hidden);
  const positions:({id:DockPosition;label:string;direction:Direction}|null)[]=[
    {id:'top-left',label:'Top left',direction:'up-left'},{id:'top-center',label:'Top center',direction:'up'},{id:'top-right',label:'Top right',direction:'up-right'},
    {id:'middle-left',label:'Middle left',direction:'left'},null,{id:'middle-right',label:'Middle right',direction:'right'},
    {id:'bottom-left',label:'Bottom left',direction:'down-left'},{id:'bottom-center',label:'Bottom center',direction:'down'},{id:'bottom-right',label:'Bottom right',direction:'down-right'},
  ];
  let submenu=$state<'position'|'orientation'|null>(null);
  let submenuTrigger:HTMLButtonElement;
  let subpanel=$state<HTMLElement>();
  async function reveal(name:'position'|'orientation',event:MouseEvent|KeyboardEvent){
    submenuTrigger=event.currentTarget as HTMLButtonElement;
    submenu=submenu===name?null:name;
    await tick();
    if(!subpanel || !submenu)return;
    const anchor=submenuTrigger.getBoundingClientRect(),box=subpanel.getBoundingClientRect();
    subpanel.style.left=`${Math.max(8,anchor.right+box.width+12<innerWidth?anchor.right+4:anchor.left-box.width-4)}px`;
    subpanel.style.top=`${Math.max(8,Math.min(anchor.top,innerHeight-box.height-8))}px`;
    subpanel.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function close(){onclose();trigger.focus({preventScroll:true});}
  function attach(node:HTMLElement){
    const rect=node.getBoundingClientRect();
    node.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;
    node.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside=(event:PointerEvent)=>{if(!node.contains(event.target as Node))onclose();};
    const dismiss=()=>onclose();document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',dismiss);
    return {destroy(){document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',dismiss);}};
  }
  function keys(event:KeyboardEvent){
    if(submenu && ['Escape','ArrowLeft'].includes(event.key)){event.preventDefault();event.stopPropagation();submenu=null;submenuTrigger?.focus();return;}
    if(event.key==='Escape' || event.key==='Tab'){if(event.key==='Escape')event.preventDefault();event.stopPropagation();close();return;}
    if(event.key==='ArrowRight' && document.activeElement instanceof HTMLButtonElement && document.activeElement.hasAttribute('aria-controls')){event.preventDefault();document.activeElement.click();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const buttons=Array.from(((event.target as HTMLElement).closest('[role=menu]') as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button=>button.closest('[role=menu]')===(event.target as HTMLElement).closest('[role=menu]'));
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  }
</script>
<div class="instance-context-menu dock-menu" role="menu" tabindex="-1" aria-label={$t('Toolbar options')} use:attach onkeydown={keys} oncontextmenu={event=>event.preventDefault()}>
  {#if section}<div class="instance-menu-title">{$t(sectionInfo[section].label)}</div>
    {#if order.indexOf(section)>0}<Button shape="plain" role="menuitem" onclick={()=>{onmove(section!,-1);close();}}>{$t('Move up')}</Button>{/if}{#if order.indexOf(section)<order.length-1}<Button shape="plain" role="menuitem" onclick={()=>{onmove(section!,1);close();}}>{$t('Move down')}</Button>{/if}
    <Button shape="plain" role="menuitem" onclick={()=>{ontoggle(section!);close();}}>{$t(visible?'Hide {name}':'Show {name}',{name:$t(sectionInfo[section].label)})}</Button>
    <div role="separator"></div>
  {/if}
  <Button shape="plain" role="menuitem" aria-haspopup="menu" aria-expanded={submenu==='position'} aria-controls="dock-position-menu" onclick={event=>reveal('position',event)}>{$t('Toolbar position')}<DirectionIcon direction="right" compact/></Button>
  <Button shape="plain" role="menuitem" aria-haspopup="menu" aria-expanded={submenu==='orientation'} aria-controls="dock-orientation-menu" onclick={event=>reveal('orientation',event)}>{$t('Orientation')}<DirectionIcon direction="right" compact/></Button>
  {#if submenu}
    <div bind:this={subpanel} id={`dock-${submenu}-menu`} class="instance-context-menu dock-submenu" role="menu" tabindex="-1" aria-label={$t(submenu==='position'?'Toolbar position':'Orientation')}>
      {#if submenu==='position'}
        <div class="position-grid" role="group" aria-label={$t('Toolbar position')}>
          {#each positions as position}{#if position}<Button shape="plain" role="menuitemradio" aria-checked={$homeDockPosition===position.id} selected={$homeDockPosition===position.id} aria-label={$t(position.label)} title={$t(position.label)} onclick={()=>{homeDockPosition.set(position.id);close();}}><DirectionIcon direction={position.direction}/></Button>{:else}<span class="position-center" aria-hidden="true"></span>{/if}{/each}
        </div>
      {:else}
        {#each ['horizontal','vertical'] as direction}<Button shape="plain" role="menuitemradio" aria-checked={(dockIsVertical($homeDockPosition,$homeDockOrientation)?'vertical':'horizontal')===direction} onclick={()=>{homeDockOrientation.set(direction as 'horizontal'|'vertical');close();}}>{$t(direction==='horizontal'?'Horizontal':'Vertical')}</Button>{/each}
      {/if}
    </div>
  {/if}
</div>
<style>
  .dock-menu{overflow:visible}
  .dock-menu :global(button[aria-controls]){justify-content:space-between;gap:1.71428571rem}
  .dock-submenu{min-width:12.14285714rem}

  .position-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.28571429rem;padding:0.28571429rem 0.71428571rem 0.71428571rem}
  .position-grid :global(button){justify-content:center;min-height:2.57142857rem;font-size:1.57142857rem;border:var(--stroke) solid var(--edge);box-shadow:var(--bevel-raised)}
  .position-grid :global(button[aria-checked='true']){background:var(--surface);border-color:var(--focus-ring);box-shadow:var(--bevel-inset)}
  .position-center{margin:0.85714286rem;background:var(--edge);opacity:.4}
</style>
