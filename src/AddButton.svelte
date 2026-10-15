<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import {t} from './i18n';
  let {onclick,disabled=false}:{onclick:()=>void;disabled?:boolean}=$props();
</script>
<Button tone="accent" {disabled} {onclick}><Icon name="plus" size={16}/>{$t('Add')}</Button>
