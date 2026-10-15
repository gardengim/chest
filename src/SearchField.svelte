<script lang="ts">
  import Icon from './Icon.svelte';
  import {t} from './i18n';
  let {value=$bindable(''),label,placeholder,maxlength,oninput}:{value?:string;label:string;placeholder?:string;maxlength?:number;oninput?:(event:Event)=>void}=$props();
</script>
<label class="search-field">
  <Icon name="search" size={16}/>
  <input type="search" aria-label={label} placeholder={placeholder ?? $t('Search…')} {maxlength} bind:value {oninput}/>
</label>
<style>
.search-field{display:flex;align-items:center;gap:0.57142857rem;min-width:0;width:100%;height:var(--control-height);margin:0;padding:0 0.85714286rem;background:var(--theme-input);border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-inset);color:var(--theme-input-muted)}
.search-field:focus-within{outline:var(--stroke) solid var(--focus-ring);outline-offset:1px}
.search-field :global(svg){flex:none;color:var(--control-icon)}
.search-field input{min-width:0;width:100%;height:100%;min-height:0;margin:0;padding:0;background:transparent;border:0;box-shadow:none;font-size:0.85714286rem;color:var(--theme-input-text)}
.search-field input:focus{outline:none}
</style>
