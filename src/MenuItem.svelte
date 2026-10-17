<script lang="ts">
  import type {Snippet} from 'svelte';
  import type {HTMLButtonAttributes} from 'svelte/elements';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  let {icon,direction,rotation=0,children,tone='neutral',...attributes}:HTMLButtonAttributes & {icon?:string;rotation?:number;direction?:'left'|'right'|'up'|'down';children?:Snippet;tone?:'neutral'|'accent'|'danger'}=$props();
</script>
<Button {...attributes} shape="plain" role="menuitem" {tone}>
  {#if direction}<DirectionIcon {direction}/>{:else if icon}<Icon name={icon} {rotation} size={16}/>{/if}
  {@render children?.()}
</Button>
