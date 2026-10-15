<script lang="ts">
  import type {Snippet} from 'svelte';
  import type {HTMLAttributes} from 'svelte/elements';
  let {layout='gallery',minimum,gap,columnWidth,fill='auto-fill',children,style:customStyle,class:className,...attributes}:Omit<HTMLAttributes<HTMLDivElement>,'children'> & {layout?:'gallery'|'list';minimum?:string;gap?:string;columnWidth?:string;fill?:'auto-fill'|'auto-fit';children:Snippet}=$props();
  const gridStyle=$derived(Object.entries({'--card-min':minimum,'--card-gap':gap,'--card-column-width':columnWidth,'--card-grid-repeat':fill}).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}:${value}`).concat(customStyle || []).join(';'));
</script>
<div {...attributes} class={['card-grid',layout==='gallery'?'gallery':'list',className]} data-layout={layout} style={gridStyle}>{@render children()}</div>
<style>
.card-grid{display:grid;grid-template-columns:repeat(var(--card-grid-repeat,auto-fill),minmax(min(var(--card-min),100%),1fr));gap:var(--card-gap);min-width:0;align-items:stretch}
.card-grid[data-layout='list']{grid-template-columns:minmax(0,1fr)}
:global(.shelf-body.horizontal) .card-grid[data-layout='gallery']{grid-auto-flow:column;grid-auto-columns:min(100cqi,var(--card-column-width,clamp(14rem,28cqi,var(--card-min))));grid-template-columns:none}
.card-grid :global(.launcher-card),.card-grid :global(.screenshot-tile){min-width:0}
</style>
