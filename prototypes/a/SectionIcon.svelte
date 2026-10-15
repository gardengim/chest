<script lang="ts">
  let {section,size=24}:{section:string;size?:number}=$props();
  const paths:Record<string,string>={
    Instances:'M1 1h6v6H1z M9 1h6v6H9z M1 9h6v6H1z M9 9h6v6H9z M3 3v2h2V3z M11 3v2h2V3z M3 11v2h2v-2z M11 11v2h2v-2z',
    Worlds:'M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2z M5 3H4v2H3v6h1v2h2v-3H5V7h2V3z M9 3v3h3v3h-2v4h1v-1h1v-1h1V5h-1V4h-1V3z',
    Servers:'M1 1h14v6H1z M1 9h14v6H1z M3 3v2h2V3z M7 3v2h6V3z M3 11v2h2v-2z M7 11v2h6v-2z',
    News:'M3 1h12v14H1V4h2z M5 3v4h4V3z M11 3v1h2V3z M11 6v1h2V6z M5 9v1h8V9z M5 12v1h8v-1z M2 5v8h1V5z',
    Explore:'M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2z M5 3H4v2H3v6h1v2h1v1h6v-1h1v-2h1V5h-1V3z M10 4h2v2h-1v2h-1v2H8v1H6v1H4v-2h1V8h1V6h2V5h2z M7 7v2h2V7z',
    Collapse:'M10 3h2v2h-2v2H8v2h2v2h2v2h-2v-2H8V9H6V7h2V5h2z',
    More:'M2 7h2v2H2z M7 7h2v2H7z M12 7h2v2h-2z',
  };
</script>
<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" d={paths[section] || paths.Instances}/></svg>
