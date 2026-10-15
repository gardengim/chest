<script lang="ts" generics="Value extends string">
  import './button.css';
  import Icon from './Icon.svelte';
  type Option={value:Value;label:string;icon?:string;disabled?:boolean};
  const id=$props.id();
  let {value=$bindable(),options,label,name=id,disabled=false,class:className}: {
    value:Value;options:Option[];label:string;name?:string;disabled?:boolean;class?:string;
  }=$props();
</script>

<div class={['segmented-control',className]} class:icon-only={options.every(option=>!!option.icon)} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}>
  {#each options as option (option.value)}
    <label class="ui-button" data-tone="neutral" data-shape="segment" data-selected={value===option.value || undefined} title={option.label}>
      <input type="radio" {name} value={option.value} bind:group={value} disabled={disabled || option.disabled} aria-label={option.label}/>
      {#if option.icon}<Icon name={option.icon} size={24}/>{:else}<span class="segment-label">{option.label}</span>{/if}
    </label>
  {/each}
</div>
<style>
.segmented-control{display:inline-flex;flex:none;width:max-content;max-width:100%;gap:0}
.segmented-control>.ui-button{margin:0;display:inline-flex;color:var(--button-text)}
.segmented-control:not(.icon-only)>.ui-button{width:auto;height:auto;min-width:0;padding:.5em clamp(.25rem,2vw,1rem);flex:1 1 auto}
.segment-label{min-width:0;overflow-wrap:anywhere}
/* Keep native radio interaction and focus while the label supplies button visuals. */
.segmented-control input[type='radio']:is(:hover,:active){top:0;box-shadow:none}
.segmented-control input[type='radio']{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:0;opacity:0;transform:none;transition:none;cursor:inherit}
</style>
