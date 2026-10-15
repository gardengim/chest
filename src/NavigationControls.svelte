<script lang="ts">
  import Button from './Button.svelte';
  import DirectionIcon from './DirectionIcon.svelte';
  import {t} from './i18n';
  let {label,previousLabel,nextLabel,previousDisabled=false,nextDisabled=false,onprevious,onnext,status,statusLabel,description}:{label:string;previousLabel?:string;nextLabel?:string;previousDisabled?:boolean;nextDisabled?:boolean;onprevious:()=>void;onnext:()=>void;status?:string;statusLabel?:string;description?:string}=$props();
</script>
<nav class="navigation-controls" aria-label={label}>
  <Button class="navigation-step" aria-label={previousLabel || $t('Previous')} title={previousLabel || $t('Previous')} aria-disabled={previousDisabled} tabindex={previousDisabled?-1:undefined} onclick={onprevious}><DirectionIcon direction="left"/></Button>
  {#if status}<span class="navigation-status" role="status" aria-live="polite" aria-atomic="true" aria-label={statusLabel} title={description || statusLabel}><span>{status}</span>{#if description}<small aria-hidden="true">{description}</small>{/if}</span>{/if}
  <Button class="navigation-step" aria-label={nextLabel || $t('Next')} title={nextLabel || $t('Next')} aria-disabled={nextDisabled} tabindex={nextDisabled?-1:undefined} onclick={onnext}><DirectionIcon direction="right"/></Button>
</nav>
<style>
  .navigation-controls{display:flex;align-items:center;justify-content:center;gap:clamp(.25rem,1.5vw,.71428571rem);max-width:100%;min-width:0;color:var(--navigation-text,var(--muted))}
  .navigation-controls :global(.navigation-step){width:var(--control-height);min-width:0;min-height:0;max-width:100%;aspect-ratio:1;flex:0 1 var(--control-height);padding:0}
  .navigation-status{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15rem;min-width:0;overflow-wrap:anywhere;text-align:center;font-size:.85714286rem;line-height:1.4}
  .navigation-status small{font-size:.78571429rem;color:inherit;line-height:1.4;margin:0}
</style>
