<script lang="ts" generics="T extends string">
  import { t } from './i18n';
  import Button from './Button.svelte';
  let { options, value, prefix, label, onchange }: {
    options: readonly T[]; value: T; prefix: string; label: string; onchange: (value: T) => void;
  } = $props();

  function keys(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click();
    buttons[next].focus();
  }
</script>

<div class="tabs" role="tablist" tabindex="-1" aria-label={$t(label)} onkeydown={keys}>
  {#each options as option}
    <Button shape="tab" id={`${prefix}-tab-${encodeURIComponent(option)}`} role="tab" aria-selected={value === option}
      aria-controls={`${prefix}-panel-${encodeURIComponent(option)}`} selected={value === option}
      tabindex={value === option ? 0 : -1} onclick={() => onchange(option)}>{$t(option)}</Button>
  {/each}
</div>
