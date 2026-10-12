<script lang="ts">let {kind='grass'}:{kind?:string}=$props();</script>
<svg viewBox="0 0 64 64" class="artwork" aria-hidden="true">
  {#if kind === 'application'}
    <path d="M10 8h44v48H10z" fill="#202529"/>
    <path d="M12 10h40v44H12z" fill="#5c7560"/>
    <path d="M12 10h40v9H12z" fill="#97b681"/>
    <path d="M16 13h3v3h-3zm6 0h3v3h-3zm6 0h3v3h-3z" fill="#354438"/>
    <path d="m19 27 8 7-8 7 3 3 12-10-12-10zm16 14h11v4H35z" fill="#e0e9d7"/>
    <path d="M12 19h2v33h38v2H12z" fill="#b9c6aa"/>
  {:else if kind === 'grass'}
    <path d="M8 22L32 8l24 14-24 14z" fill="#88ad67"/><path d="M8 22v27l24 14V36z" fill="#745640"/><path d="M32 36l24-14v27L32 63z" fill="#4c3b2f"/>
    <path d="M8 22v9l8 5v-6l8 5v-5l8 6v-1" fill="#6c9150"/><path d="M32 36v7l8-5v-6l8-4v6l8-5v-7" fill="#557a3e"/>
    <path d="M14 40l5 3v6l-5-3 M24 48l5 3v5l-5-3" fill="#9b7953"/>
  {:else if kind === 'stone'}
    <path d="M8 22L32 8l24 14-24 14z" fill="#a1a2a6"/><path d="M8 22v27l24 14V36z" fill="#747780"/><path d="M32 36l24-14v27L32 63z" fill="#4e515c"/><path d="M13 34l8 5 M18 48l10 6 M39 46l10-6" stroke="#979ba6" stroke-width="5"/>
  {:else if kind === 'amethyst'}
    <path d="M19 45l-8-19 9-11 10 8 8-17 11 12 6 26-20 16z" fill="#aa8ad7"/><path d="M30 23l8-17 2 38-5 16z" fill="#d1b2ed"/><path d="M40 44l9-26 6 26-20 16z" fill="#69509e"/><path d="M19 45l1-30 10 8 5 37z" fill="#9673c5"/>
  {:else}
    <path d="M15 39L8 21l17 5 8-19 8 19 17-5-7 18-18 21z" fill="#e5b365"/><path d="M33 7v53l18-21 7-18-17 5z" fill="#b78345"/>
  {/if}
</svg>
