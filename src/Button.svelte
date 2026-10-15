<script lang="ts">
  import './button.css';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    children?: Snippet;
    tone?: 'neutral' | 'accent' | 'danger';
    shape?: 'button' | 'plain' | 'card' | 'tab' | 'rail' | 'dock' | 'segment';
    selected?: boolean;
  };
  let { children, tone='neutral', shape='button', selected=false,
    type='button', class:className, ...attributes }: Props = $props();
</script>

<button {...attributes} onclick={event=>{if(attributes['aria-disabled']===true || attributes['aria-disabled']==='true'){event.preventDefault();event.stopPropagation();return;}attributes.onclick?.(event);}} {type} class={['ui-button',className]} data-tone={tone} data-shape={shape} data-selected={selected || undefined}>
  {@render children?.()}
</button>
