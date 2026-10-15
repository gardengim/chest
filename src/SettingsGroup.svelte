<script lang="ts">
  import type {Snippet} from 'svelte';
  let {title,children}:{title:string;children:Snippet}=$props();
</script>
<section class="settings-group">
  <h3>{title}</h3>
  <div class="settings-group-body">{@render children()}</div>
</section>
<style>
.settings-group{min-width:0;padding-block:1.28571429rem;border-top:var(--divider) solid var(--frame)}
h3{margin:0 0 1rem;font-size:1.07142857rem}
.settings-group-body{display:grid;gap:1rem;min-width:0}
.settings-group-body :global(label){margin:0;min-width:0}
.settings-group-body :global(.runtime-java){margin:0}
.settings-group-body :global(.hint){display:block;margin:.42857143rem 0 0;line-height:1.5;font-size:.85714286rem}
</style>
