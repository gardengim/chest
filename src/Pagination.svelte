<script lang="ts">
  import NavigationControls from './NavigationControls.svelte';
  import {t} from './i18n';
  import {locale} from './preferences';
  let {label,page,pages,disabled=false,description,onchange}:{label:string;page:number;pages:number;disabled?:boolean;description?:string;onchange:(page:number)=>void}=$props();
  const count=$derived(Math.max(1,Math.floor(pages)));
  const current=$derived(Math.max(0,Math.min(Math.floor(page),count-1)));
  const number=$derived(new Intl.NumberFormat($locale));
  function change(delta:number){const next=current+delta;if(!disabled && next>=0 && next<count)onchange(next);}
</script>
{#if count>1}
<div class="pagination">
  <NavigationControls {label} previousDisabled={disabled || current===0} nextDisabled={disabled || current===count-1} onprevious={()=>change(-1)} onnext={()=>change(1)} status={`${number.format(current+1)} / ${number.format(count)}`} statusLabel={$t('Page {page} of {pages}',{page:current+1,pages:count})} {description}/>
</div>
{/if}
<style>.pagination{display:flex;justify-content:center;min-width:0;margin-block:1.5rem}</style>
