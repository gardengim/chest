<script lang="ts">
  import Icon from './Icon.svelte';
  import {directionAngles,type Direction} from './directions';
  let {direction='right',compact=false,logical=true}:{direction?:Direction;compact?:boolean;logical?:boolean}=$props();
</script>
<span class="direction-icon" data-direction={direction} data-logical={logical || undefined} style={`--direction-angle:${directionAngles[direction]}deg`} aria-hidden="true"><Icon name="triangle" size={compact?10:18}/></span>
<style>.direction-icon{display:inline-grid;place-items:center;flex:none;line-height:0;vertical-align:middle;pointer-events:none;rotate:var(--direction-angle)}
:global(:root[dir="rtl"]) .direction-icon[data-logical]:is([data-direction='left'],[data-direction='right']){rotate:calc(-1 * var(--direction-angle))}
</style>
