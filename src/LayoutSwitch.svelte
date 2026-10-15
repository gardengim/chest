<script lang="ts">
  import {t} from './i18n';
  import SegmentedControl from './SegmentedControl.svelte';
  let {value=$bindable<'gallery'|'list'>('gallery'),label,disabled=false}: {
    value?:'gallery'|'list';label:string;disabled?:boolean;
  }=$props();
  const options=$derived([
    {value:'gallery' as const,label:$t('Gallery'),icon:'layout-gallery'},
    {value:'list' as const,label:$t('List'),icon:'layout-list'},
  ]);
</script>

<SegmentedControl class="view-switch" bind:value {options} {label} {disabled}/>
