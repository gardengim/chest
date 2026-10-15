<script lang="ts">
  import InstanceIcon from './InstanceIcon.svelte';
  import type {Instance} from './types';
  let {instance,size=20}:{instance:Instance;size?:number}=$props();
</script>
<span class="instance-name"><InstanceIcon id={instance.id} {size}/><bdi>{instance.name}</bdi></span>
<style>.instance-name{display:inline-flex;align-items:center;gap:0.57142857rem;vertical-align:middle;min-width:0}.instance-name>bdi{overflow-wrap:anywhere}</style>
