<script lang="ts">
  import Icon from './Icon.svelte';

  let { source, fallback='block', size=48, lazy=false }: {
    source?: string | null; fallback?: 'block' | 'cube'; size?: number; lazy?: boolean;
  } = $props();
  let failed=$state(false);
  $effect(()=>{void source;failed=false;});
</script>

{#if source && !failed}
  <img class="artwork" src={source} alt="" loading={lazy?'lazy':'eager'} onerror={()=>failed=true}/>
{:else if fallback==='cube'}
  <Icon name="cube" {size}/>
{:else}
  <img class="artwork" src="/minecraft.png" alt="" loading={lazy?'lazy':'eager'}/>
{/if}

<style>img{object-fit:contain;}</style>
