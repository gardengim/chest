<script lang="ts">
  import {symbolBody,symbolViewBox} from './symbols';
  let {name,size=20,rotation=0}:{name:string;size?:number;rotation?:number}=$props();
  const viewBox=$derived(symbolViewBox(name));
  const dimensions=$derived(viewBox.split(' ').map(Number));
  const nativeWidth=$derived(dimensions[2] || 9),nativeHeight=$derived(dimensions[3] || 9);
  let inButton=$state(false);
  const density=typeof window==='undefined'?1:window.devicePixelRatio || 1;
  function buttonContext(node:SVGSVGElement){
    const button=node.closest<HTMLElement>('.ui-button');
    inButton=!!button && button.dataset.shape!=='card';
  }
  // Button glyphs are smaller; snap their pixels to whole physical screen pixels.
  const scale=$derived(inButton
    ?Math.max(1,Math.round(size*.85*density/Math.max(nativeWidth,nativeHeight)))/density
    :Math.max(1,Math.round(size/Math.max(nativeWidth,nativeHeight))));
  const renderedWidth=$derived(nativeWidth*scale),renderedHeight=$derived(nativeHeight*scale);
</script>
{#if name==='chest'}
  <img src="/chest.svg" width={size} height={size} style:--icon-size={`${size/14}rem`} alt="" aria-hidden="true" draggable="false"/>
{:else}
  <svg use:buttonContext width={renderedWidth} height={renderedHeight} style:--icon-width={`${renderedWidth}px`} style:--icon-height={`${renderedHeight}px`} style:rotate={`${rotation}deg`} viewBox={viewBox} shape-rendering="crispEdges" aria-hidden="true" focusable="false" data-symbol={name}>
    {@html symbolBody(name)}
  </svg>
{/if}

<style>svg{color:var(--icon-ink);width:var(--icon-width);height:var(--icon-height);flex-shrink:0}:global(:root[dir="rtl"]) svg[data-symbol="arrow-bend-right"]{scale:-1 1}img{width:var(--icon-size);height:var(--icon-size);flex-shrink:0}</style>
