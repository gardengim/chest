<script lang="ts">
  import { t } from './i18n';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import type { Instance } from './types';
  import type { instanceUI, InstanceChoice } from './instance-ui';
  let {instance,trigger,position,state,native,onchoose,onclose}:{
    instance:Instance;trigger:HTMLButtonElement;position?:{x:number;y:number};state:ReturnType<typeof instanceUI>;native:boolean;
    onchoose:(action:InstanceChoice)=>void;onclose:(restore?:boolean)=>void;
  }=$props();
  function attach(node:HTMLDivElement){
    const anchor=trigger.getBoundingClientRect();
    const rect=node.getBoundingClientRect();
    node.style.left=`${Math.max(8,Math.min((position?.x ?? anchor.right+8),innerWidth-rect.width-8))}px`;
    node.style.top=`${Math.max(8,Math.min((position?.y ?? anchor.top),innerHeight-rect.height-8))}px`;
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function outside(event:PointerEvent){if(!node.contains(event.target as Node) && !trigger.contains(event.target as Node))onclose();}
    const dismiss=()=>onclose();
    document.addEventListener('pointerdown',outside,true);
    document.addEventListener('scroll',dismiss,true);
    window.addEventListener('resize',dismiss);
    return {destroy(){document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);}};
  }
  function keys(event:KeyboardEvent){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onclose(true);return;}
    if(event.key==='Tab'){onclose(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const buttons=Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
    buttons[next]?.focus();
  }
</script>

<div class="instance-context-menu" role="menu" tabindex="-1" aria-label={$t('{name} actions',{name:instance.name})} use:attach onkeydown={keys} oncontextmenu={event=>event.preventDefault()}>
  <div class="instance-menu-title">{instance.name}</div>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('open')}><Icon name="arrow" size={16}/>{$t("Open")}</Button>
  <Button shape="plain" role="menuitem" disabled={state.transitional} onclick={()=>onchoose('action')}><Icon name={state.actionIcon} size={16}/>{$t(state.actionLabel)}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('group')}><Icon name="folder" size={16}/>{$t("Group…")}</Button>
  <div role="separator"></div>
  <Button shape="plain" role="menuitem" disabled={!native} onclick={()=>onchoose('folder')}><Icon name="folder" size={16}/>{$t("Open folder")}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('settings')}><Icon name="gear" size={16}/>{$t("Settings")}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('console')}><Icon name="terminal" size={16}/>{$t("Log")}</Button>
  <div role="separator"></div>
  <Button shape="plain" role="menuitem" disabled={!state.canCopy} onclick={()=>onchoose('duplicate')}><Icon name="copy" size={16}/>{$t("Duplicate")}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || !state.canCopy} onclick={()=>onchoose('export')}><Icon name="download" size={16}/>{$t("Export")}</Button>
  <Button shape="plain" role="menuitem" tone="danger" disabled={state.busy} onclick={()=>onchoose('delete')}><Icon name="close" size={16}/>{$t("Delete")}</Button>
</div>
