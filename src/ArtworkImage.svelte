<script lang="ts">
  import {minecraftArtwork} from './builtin-artwork';
  let { source, fallback='block', lazy=false,onfailure }: {
    onfailure?:()=>void;source?: string | null; fallback?: 'block' | 'none'; lazy?: boolean;
  } = $props();
  let failed=$state(false);
  $effect(()=>{void source;failed=false;});
</script>

{#if source && !failed}
  <img class="artwork" src={source} alt="" loading={lazy?'lazy':'eager'} onerror={()=>{failed=true;onfailure?.();}}/>
{:else if fallback==='block'}
  <img class="artwork" src={minecraftArtwork} alt="" loading={lazy?'lazy':'eager'}/>
{/if}

<style>img{object-fit:contain;image-rendering:pixelated}</style>
