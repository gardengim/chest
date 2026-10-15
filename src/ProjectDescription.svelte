<script lang="ts">
  import {api,native} from './api';
  import {t} from './i18n';
  import Button from './Button.svelte';
  import Scrollbar from './Scrollbar.svelte';
  import type {CatalogSource,ProjectDescription} from './types';
  let {source,project,url}:{source:CatalogSource;project:string;url:string}=$props();
  let content=$state(''),loading=$state(false),error=$state(''),linkError=$state(false),retry=$state(0);
  let scroller=$state<HTMLDivElement>();
  const uid=$props.id();
  $effect(()=>{
    const provider=source,id=project,base=url;void retry;
    let alive=true;content='';error='';linkError=false;loading=true;
    void api.projectDescription(provider,id).then(async(description:ProjectDescription)=>{
      if(!alive || !description?.body)return;
      const {renderDescription}=await import('./rich-description');
      if(alive)content=renderDescription(description,base,$t('Open embedded content'));
    }).catch(()=>{if(alive)error=$t('Could not load description.');}).finally(()=>{if(alive)loading=false;});
    return()=>{alive=false;};
  });
  function handleContent(node:HTMLElement){
    const click=(event:MouseEvent)=>{
      const link=(event.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;
      if(!link || !native)return;
      event.preventDefault();linkError=false;
      void api.openDescriptionLink(link.href).catch(()=>linkError=true);
    };
    const failed=(event:Event)=>{
      if(!(event.target instanceof HTMLImageElement))return;
      const fallback=document.createElement('span');fallback.textContent=event.target.alt || $t('Image unavailable');event.target.replaceWith(fallback);
    };
    node.addEventListener('click',click);node.addEventListener('error',failed,true);
    return {destroy(){node.removeEventListener('click',click);node.removeEventListener('error',failed,true);}};
  }
</script>
<div class="description-panel">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region needs keyboard access.) -->
  <div class="description-scroll" bind:this={scroller} id={uid} role="region" aria-label={$t('Description')} aria-busy={loading} tabindex="0">
    {#if loading}<p role="status">{$t('Loading description…')}</p>
    {:else if error}<p role="alert">{error}</p><Button onclick={()=>retry++}>{$t('Retry')}</Button>
    {:else if content}<div class="rich-description" use:handleContent>{@html content}</div>
    {:else}<p class="hint">{$t('No description available.')}</p>{/if}
    {#if linkError}<p role="alert">{$t('Could not open link.')}</p>{/if}
  </div>
  <Scrollbar {scroller} placement="container" label={$t('Scroll description')}/>
</div>
<style>
.description-panel{position:relative;min-width:0;min-height:0;flex:1;border:var(--stroke) solid var(--frame);box-shadow:var(--bevel-inset);background:var(--theme-input);color:var(--theme-input-text);--text:var(--theme-input-text);--muted:var(--theme-input-muted)}
.description-scroll{height:100%;overflow:auto;overscroll-behavior:contain;padding:1rem;padding-right:calc(1rem + var(--scrollbar-size));min-width:0;outline-offset:calc(-1 * var(--stroke))}
.description-scroll:focus-visible{outline:var(--stroke) solid var(--focus-ring)}
.rich-description{line-height:1.6;overflow-wrap:anywhere;min-width:0}
.rich-description :global(*){max-width:100%;box-sizing:border-box}
.rich-description :global(:is(h1,h2,h3,h4,h5,h6)){font:inherit;font-weight:700;line-height:1.3;margin:1.2em 0 .6em;color:inherit}
.rich-description :global(:is(h1,h2)){font-size:1.25em}
.rich-description :global(:is(p,ul,ol,blockquote,pre,table,details)){margin:.75em 0;font-size:inherit}
.rich-description :global(:first-child){margin-top:0}
.rich-description :global(img){display:block;width:auto;height:auto;margin:.75em auto;image-rendering:auto}
.rich-description :global(:is(ul,ol)){padding-left:1.5em}
.rich-description :global(a){color:inherit;text-decoration:underline;text-underline-offset:.2em}
.rich-description :global(a:hover){text-decoration-thickness:var(--stroke)}
.rich-description :global(a:focus-visible){outline:var(--stroke) solid var(--focus-ring);outline-offset:var(--pixel)}
.rich-description :global(blockquote){border-left:var(--stroke) solid var(--frame);padding-left:1em}
.rich-description :global(:is(pre,code)){font-family:ui-monospace,monospace;font-size:.9em;white-space:pre-wrap;overflow-wrap:anywhere}
.rich-description :global(pre){padding:.75em;box-shadow:var(--bevel-inset)}
.rich-description :global(.rich-table-scroll){overflow-x:auto;max-width:100%}
.rich-description :global(table){border-collapse:collapse;max-width:100%}
.rich-description :global(:is(th,td)){border:var(--divider) solid var(--frame);padding:.5em;overflow-wrap:anywhere}
.rich-description :global(hr){border:0;border-top:var(--divider) solid var(--frame);margin:1em 0}
.rich-description :global(summary){cursor:pointer;font-weight:600}
</style>
