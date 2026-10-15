<script lang="ts">
  import ContextMenu from './ContextMenu.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import { t } from './i18n';
  import Button from './Button.svelte';
  import InstanceName from './InstanceName.svelte';
  import Icon from './Icon.svelte';
  import type { Instance } from './types';
  import type { instanceUI, InstanceChoice } from './instance-ui';
  let {instance,trigger,position,state,native,onchoose,onclose}:{
    instance:Instance;trigger:HTMLButtonElement;position?:{x:number;y:number};state:ReturnType<typeof instanceUI>;native:boolean;
    onchoose:(action:InstanceChoice)=>void;onclose:(restore?:boolean)=>void;
  }=$props();
</script>

<ContextMenu title={$t('{name} actions',{name:instance.name})} {trigger} x={position?.x ?? trigger.getBoundingClientRect().right+8} y={position?.y ?? trigger.getBoundingClientRect().top} ignoreTrigger onclose={()=>onclose()}>
  {#snippet heading()}<InstanceName {instance}/>{/snippet}
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('open')}><DirectionIcon direction="right"/>{$t("Open")}</Button>
  <Button shape="plain" role="menuitem" disabled={state.transitional} onclick={()=>onchoose('action')}><Icon name={state.actionIcon} size={16}/>{$t(state.actionLabel)}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('group')}><Icon name="folder" size={16}/>{$t("Group…")}</Button>
  <div role="separator"></div>
  <Button shape="plain" role="menuitem" disabled={!native} onclick={()=>onchoose('folder')}><Icon name="folder" size={16}/>{$t("Open folder")}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('settings')}><Icon name="gear" size={16}/>{$t("Settings")}</Button>
  <Button shape="plain" role="menuitem" onclick={()=>onchoose('console')}><Icon name="terminal" size={16}/>{$t("Log")}</Button>
  <div role="separator"></div>
  <Button shape="plain" role="menuitem" disabled={!state.canCopy} onclick={()=>onchoose('duplicate')}><Icon name="copy" size={16}/>{$t("Duplicate")}</Button>
  <Button shape="plain" role="menuitem" disabled={!native} onclick={()=>onchoose('shortcut')}><DirectionIcon direction="right"/>{$t("Create shortcut")}</Button>
  <Button shape="plain" role="menuitem" disabled={!native || !state.canCopy} onclick={()=>onchoose('export')}><Icon name="download" size={16}/>{$t("Export")}</Button>
  <Button shape="plain" role="menuitem" tone="danger" disabled={state.busy} onclick={()=>onchoose('delete')}><Icon name="close" size={16}/>{$t("Delete")}</Button>
</ContextMenu>
