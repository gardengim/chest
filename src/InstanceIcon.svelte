<script lang="ts">
  import ArtworkImage from './ArtworkImage.svelte';
  import {instanceArtwork} from './instance-artwork';
  let {id,size=20}:{id?:string;size?:number}=$props();
</script>
<span class="instance-icon-ref" style:width={`${size/14}rem`} style:height={`${size/14}rem`} aria-hidden="true"><ArtworkImage source={id?$instanceArtwork[id]:undefined}/></span>
<style>.instance-icon-ref{display:inline-flex;flex:none;vertical-align:middle}.instance-icon-ref :global(img){width:100%;height:100%;object-fit:contain;image-rendering:pixelated}</style>
