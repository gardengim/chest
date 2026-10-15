<script lang="ts">
  let {section,size=32}:{section:string;size?:number}=$props();
</script>
<svg width={size} height={size} viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">
  <g transform={section==='Instances'?'translate(0 -1.5)':section==='News'?'translate(.5 0)':undefined}>
  {#if section==='Instances'}
    <path fill="#242721" d="M2 5h12v12H2z M18 5h12v12H18z M2 19h12v11H2z M18 19h12v11H18z"/>
    <path fill="#a8bb83" d="M3 6h10v4H3z M19 6h10v4H19z M3 20h10v4H3z M19 20h10v4H19z"/>
    <path fill="#776448" d="M3 10h10v6H3z M19 10h10v6H19z M3 24h10v5H3z M19 24h10v5H19z"/>
    <path fill="#ffffff45" d="M3 6h10v1H4v9H3z M19 6h10v1h-9v9h-1z M3 20h10v1H4v8H3z M19 20h10v1h-9v8h-1z"/>
    <path fill="#00000040" d="M11 10h2v6H5v-1h6z M27 10h2v6h-8v-1h6z M11 24h2v5H5v-1h6z M27 24h2v5h-8v-1h6z"/>
  {:else if section==='Worlds'}
    <path fill="#222923" d="M10 2h12v2h4v4h3v4h2v8h-2v4h-3v4h-4v2H10v-2H6v-4H3v-4H1v-8h2V8h3V4h4z"/>
    <path fill="#74939a" d="M10 4h12v2h3v3h2v4h2v6h-2v4h-2v3h-3v2H10v-2H7v-3H5v-4H3v-6h2V9h2V6h3z"/>
    <path fill="#a9ba85" d="M10 4h7v3h-4v3H9v4H5V9h2V6h3z M19 8h6v3h2v6h-5v3h-4v-5h-3v-4h4z M9 19h5v3h3v4h-4v2h-3v-2H7v-3h2z"/>
    <path fill="#ffffff40" d="M10 4h12v1H11v2H8v3H6v4H4v-1h1V9h2V6h3z"/>
    <path fill="#00000030" d="M27 13h2v6h-2v4h-2v3h-3v2H10v-2h11v-2h3v-3h2v-4h1z"/>
  {:else if section==='Servers'}
    <path fill="#252725" d="M4 2h24v12H4z M4 18h24v12H4z M14 14h4v4h-4z"/>
    <path fill="#aeb5b4" d="M5 3h22v10H5z M5 19h22v10H5z"/>
    <path fill="#ffffff66" d="M5 3h22v1H6v9H5z M5 19h22v1H6v9H5z"/>
    <path fill="#00000044" d="M25 5h2v8H7v-2h18z M25 21h2v8H7v-2h18z"/>
    <path fill="#414843" d="M13 6h10v2H13z M13 9h10v1H13z M13 22h10v2H13z M13 25h10v1H13z"/>
    <path fill="#658a4c" d="M8 6h3v4H8z M8 22h3v4H8z"/><path fill="#c3d8a0" d="M8 6h3v1H8z M8 22h3v1H8z"/>
  {:else if section==='News'}
    <path fill="#292a26" d="M6 2h23v28H2V8h4z"/><path fill="#c9c6b5" d="M7 3h21v26H3V9h3v18h1z"/>
    <path fill="#ffffff70" d="M7 3h21v1H8v23H7z M3 9h3v1H4v17H3z"/><path fill="#00000033" d="M26 5h2v24H5v-2h21z"/>
    <path fill="#697b57" d="M10 6h8v8h-8z"/><path fill="#9daf7c" d="M10 6h8v2h-6v6h-2z"/>
    <path fill="#686b61" d="M20 6h4v2h-4z M20 10h4v1h-4z M20 13h4v1h-4z M10 17h14v2H10z M10 22h14v2H10z"/>
  {:else if section==='Explore'}
    <path fill="#252925" d="M10 1h12v2h4v4h3v4h2v10h-2v4h-3v4h-4v2H10v-2H6v-4H3v-4H1V11h2V7h3V3h4z"/>
    <path fill="#b8bba5" d="M10 3h12v2h3v3h2v4h2v8h-2v4h-2v3h-3v2H10v-2H7v-3H5v-4H3v-8h2V8h2V5h3z"/>
    <path fill="#565e50" d="M11 6h10v2h3v4h2v8h-2v4h-3v2H11v-2H8v-4H6v-8h2V8h3z"/>
    <path fill="#ffffff60" d="M10 3h12v1H11v2H8v3H6v4H4v-1h1V8h2V5h3z"/>
    <path fill="#00000040" d="M27 12h2v8h-2v4h-2v3h-3v2H10v-2h11v-2h3v-3h2v-4h1z"/>
    <path fill="#8cc5bb" d="M21 8h3v3h-2v3h-2v3h-3v-3h-3v-3h3v-1h4z"/>
    <path fill="#dbc6a0" d="M11 24H8v-3h2v-3h2v-3h3v3h3v3h-3v1h-4z"/>
    <path fill="#e5e8d4" d="M14 14h4v4h-4z"/>
  {:else}
    <path fill="currentColor" d="M5 14h4v4H5z M14 14h4v4h-4z M23 14h4v4h-4z"/>
  {/if}
  </g>
</svg>
