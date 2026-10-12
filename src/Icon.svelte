<script lang="ts">
  let { name, size=20 }: {name:string; size?:number} = $props();
  const paths:Record<string,string> = {
    plus:'M12 5v14 M5 12h14', play:'M8 5l11 7-11 7z', pause:'M8 5v14 M16 5v14', stop:'M6 6h12v12H6z',
    arrow:'M5 12h14 M13 6l6 6-6 6', folder:'M3 7V5h6l2 2h10v13H3z',
    check:'M5 12l4 4L19 6', download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
    cube:'M12 3l9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9',
    gear:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    close:'M6 6l12 12 M6 18L18 6', copy:'M8 8h13v13H8z M16 8V3H3v13h5',
    leaf:'M5 19C0 9 8 3 21 3c0 13-6 21-16 16 M5 19L17 7', terminal:'M4 6l6 6-6 6 M13 18h7',
    bolt:'M13 2L5 14h6l-1 8 9-12h-6z', search:'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M16 16l6 6',
  };
</script>
{#if name === 'chest'}
  <img src="/chest.svg" width={size} height={size} alt="" aria-hidden="true" draggable="false"/>
{:else if name === 'running'}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 7h3v7H2z M7 2h3v12H7z M12 5h3v9h-3z"/></svg>
{:else if name === 'user'}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" d="M6 1h4v1h1v5h-1v1H6V7H5V2h1z M7 3v3h2V3z M4 9h8v1h1v1h1v4h-2v-4h-1v-1H5v1H4v4H2v-4h1v-1h1z"/></svg>
{:else}
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] || paths.cube}/></svg>

{/if}
