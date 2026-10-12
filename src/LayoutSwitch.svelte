<script lang="ts">
  import { t } from './i18n';
  import Button from './Button.svelte';
  let { value = $bindable<'gallery' | 'list'>('gallery'), label }: {
    value?: 'gallery' | 'list'; label: string;
  } = $props();
</script>

<div class="view-switch" role="group" aria-label={label}>
  {#each ['gallery', 'list'] as layout}
    <Button selected={value === layout} aria-pressed={value === layout}
      onclick={() => value = layout as typeof value}>{$t(layout === 'gallery' ? 'Gallery' : 'List')}</Button>
  {/each}
</div>
