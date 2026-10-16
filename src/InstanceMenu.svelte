<script lang="ts">
  import ContextMenu from './ContextMenu.svelte';
  import { t } from './i18n';
  import MenuItem from './MenuItem.svelte';
  import InstanceName from './InstanceName.svelte';
  import type { Instance } from './types';
  import type { instanceUI, InstanceChoice } from './instance-ui';
  let {instance,trigger,position,state,native,onchoose,onclose}:{
    instance:Instance;trigger:HTMLButtonElement;position?:{x:number;y:number};state:ReturnType<typeof instanceUI>;native:boolean;
    onchoose:(action:InstanceChoice)=>void;onclose:(restore?:boolean)=>void;
  }=$props();
</script>

<ContextMenu title={$t('{name} actions',{name:instance.name})} {trigger} x={position?.x ?? trigger.getBoundingClientRect().right+8} y={position?.y ?? trigger.getBoundingClientRect().top} ignoreTrigger onclose={()=>onclose()}>
  {#snippet heading()}<InstanceName {instance}/>{/snippet}
  <MenuItem onclick={()=>onchoose('open')} direction="right">{$t("Open")}</MenuItem>
  <MenuItem disabled={state.transitional} onclick={()=>onchoose('action')} icon={state.actionIcon}>{$t(state.actionLabel)}</MenuItem>
  <MenuItem onclick={()=>onchoose('group')} icon="folder">{$t("Group…")}</MenuItem>
  <div role="separator"></div>
  <MenuItem disabled={!native} onclick={()=>onchoose('folder')} icon="folder">{$t("Open folder")}</MenuItem>
  <MenuItem onclick={()=>onchoose('settings')} icon="gear">{$t("Settings")}</MenuItem>
  <MenuItem onclick={()=>onchoose('console')} icon="terminal">{$t("Log")}</MenuItem>
  <div role="separator"></div>
  <MenuItem disabled={!state.canCopy} onclick={()=>onchoose('duplicate')} icon="copy">{$t("Duplicate")}</MenuItem>
  <MenuItem disabled={!native} onclick={()=>onchoose('shortcut')} direction="right">{$t("Create shortcut")}</MenuItem>
  <MenuItem disabled={!native || !state.canCopy} onclick={()=>onchoose('export')} icon="download">{$t("Export")}</MenuItem>
  <MenuItem tone="danger" disabled={state.busy} onclick={()=>onchoose('delete')} icon="close">{$t("Delete")}</MenuItem>
</ContextMenu>
