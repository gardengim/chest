<script lang="ts">
  import {untrack,type Snippet} from 'svelte';
  import {observeVisibility} from './visibility';
  import {loadCardArtwork} from './card-artwork';
  import type {HTMLAttributes} from 'svelte/elements';
  import Button from './Button.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import ScreenshotBackdrop from './ScreenshotBackdrop.svelte';
  type Props=Omit<HTMLAttributes<HTMLElement>,'children'|'title'> & {
    disabled?:boolean;artworkKey?:string;loadIcon?:()=>Promise<string|null>;title:string;icon?:string|null;fallbackIcon?:string;background?:string|null;instanceId?:string;
    width?:string;height?:string;minHeight?:string;maxHeight?:string;padding?:string;iconSize?:string;
    media?:'icon'|'image'|'none';imageFit?:'cover'|'contain';mediaRatio?:string;aspectRatio?:string;backgroundOpacity?:number;bodyMinHeight?:string;
    backgroundFromIcon?:boolean;badge?:string;layout?:'gallery'|'list';
    interactive?:boolean;children?:Snippet;actions?:Snippet;art?:Snippet;
  };
  let {title,icon,fallbackIcon,background,backgroundFromIcon=false,media='icon',imageFit='cover',mediaRatio,aspectRatio,backgroundOpacity=.8,bodyMinHeight,instanceId,artworkKey='',loadIcon,badge,layout='gallery',interactive=true,
    children,actions,art,width,height,minHeight,maxHeight,padding,iconSize,style:customStyle,class:className,...attributes}:Props=$props();
  const cardStyle=$derived(Object.entries({
    '--card-width':width,'--card-height':height,'--card-min-height':minHeight,'--card-max-height':maxHeight,
    '--card-padding':padding,'--card-icon-size':iconSize,'--card-media-ratio':mediaRatio,
    '--card-aspect-ratio':aspectRatio ?? (height?'auto':undefined),'--card-image-fit':imageFit,'--card-background-opacity':backgroundOpacity,'--card-body-min':bodyMinHeight,
  }).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}:${value}`).concat(customStyle || []).join(';'));
  let inView=$state(false),resolved=$state<{key:string;icon:string|null}|null>(null);
  function observe(node:HTMLElement){
    $effect(()=>{if(loadIcon)return observeVisibility(node,visible=>inView=visible);});
  }
  $effect(()=>{
    const key=artworkKey;
    if(!key || !inView || resolved?.key===key)return;
    let alive=true;
    const load=untrack(()=>loadIcon);
    if(load)void loadCardArtwork(key,load).then(value=>{if(alive)resolved={key,icon:value};});
    return()=>{alive=false;};
  });
  let failedIcon=$state('');
  const candidate=$derived(icon || (resolved?.key===artworkKey?resolved?.icon:null));
  const image=$derived(candidate && candidate!==failedIcon?candidate:fallbackIcon || null);
</script>
{#snippet contents()}
  <ScreenshotBackdrop id={instanceId} sources={background?[background]:backgroundFromIcon && image?[image]:instanceId?undefined:[]} fallback={image || undefined} variant="card"/>
  {#if media==='none'}<span class="card-visibility" use:observe></span>{:else}<div class="shared-card-art" use:observe>
    {#if art}{@render art()}{:else}<ArtworkImage source={image} onfailure={()=>failedIcon=image || ''} fallback="none" lazy/>{/if}
    {#if badge}<span class="catalog-kind">{badge}</span>{/if}
  </div>{/if}
  <div class="shared-card-body">
    <h3><bdi>{title}</bdi></h3>
    {@render children?.()}
    {#if actions}<div class="shared-card-actions">{@render actions()}</div>{/if}
  </div>
{/snippet}
{#if interactive}
  <Button shape="card" class={['launcher-card',className]} data-layout={layout} data-media={media} style={cardStyle} {...attributes}>{@render contents()}</Button>
{:else}
  <article {...attributes} class={['launcher-card',className]} data-layout={layout} data-media={media} style={cardStyle}>{@render contents()}</article>
{/if}

<style>
:global(.launcher-card){--card-action-fill:color-mix(in srgb,var(--theme-control) 65%,transparent);--card-action-hover:color-mix(in srgb,var(--theme-control) 80%,transparent);--card-action-text:var(--theme-control-text);--card-action-icon:var(--icon-on-control);--text:var(--theme-card-text);--muted:var(--theme-card-muted);--icon-ink:var(--icon-on-card);--link:var(--theme-link);--negative-text:var(--theme-danger-text);position:relative;isolation:isolate;container-type:inline-size;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;min-width:0;width:var(--card-width,100%);height:var(--card-height,auto);min-height:var(--card-min-height,0);max-height:var(--card-max-height,none);margin:0;padding:0;text-align:start;font-size:.85714286rem;overflow:hidden;border:var(--stroke) solid var(--frame);background:var(--card-fill,var(--theme-surface));color:var(--text);box-shadow:var(--shadow-drop)}
:global(.launcher-card:has(.card-backdrop img)){--card-action-fill:#0006;--card-action-hover:#0008;--card-action-text:var(--theme-overlay-text);--card-action-icon:#ececec;--text:var(--theme-overlay-text);--muted:var(--theme-overlay-muted);--icon-ink:#ececec}
:global(.launcher-card)::after{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;box-shadow:var(--bevel-raised)}
:global(.launcher-card.ui-button:not(:disabled):active)::after{box-shadow:var(--bevel-pressed)}
:global(.launcher-card[data-highlighted='true']){outline:var(--stroke) solid var(--focus-ring);outline-offset:.14285714rem}
.shared-card-art{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;aspect-ratio:var(--card-media-ratio,2 / 1);flex-shrink:0;color:var(--muted)}
.shared-card-art :global(img),.shared-card-art :global(svg){width:28%;max-width:var(--card-icon-size);height:auto;aspect-ratio:1;object-fit:contain;color:inherit;filter:drop-shadow(0 .85714286rem .71428571rem #0003)}
:global(.launcher-card[data-media='image']) .shared-card-art :global(img){width:100%;max-width:none;height:100%;position:absolute;inset:0;aspect-ratio:auto;object-fit:var(--card-image-fit,cover);object-position:center;image-rendering:auto;filter:none}
:global(.launcher-card[data-media='image']) .shared-card-art :global(span:not(.catalog-kind)){padding:var(--card-padding);font-size:.85714286rem;color:var(--muted)}
.shared-card-body{display:flex;flex-direction:column;flex:1;min-width:0;min-height:var(--card-body-min,8rem);row-gap:.35714286rem;width:100%;padding:var(--card-padding);text-shadow:none}
:global(.launcher-card) .shared-card-body h3{font-size:1.28571429rem;margin:0;overflow-wrap:anywhere;color:var(--text)}
:global(.launcher-card) .shared-card-body :global(p),:global(.launcher-card) .shared-card-body :global(small){color:var(--muted)}
.catalog-kind{position:absolute;bottom:.64285714rem;inset-inline-end:.71428571rem;color:var(--theme-input-text);background:var(--theme-input);border:var(--divider) solid var(--frame);padding:.21428571rem .42857143rem;font-size:.71428571rem}
:global(.launcher-card) :global(.card-backdrop){inset:0;width:auto;height:100%;background:var(--theme-card)}
:global(.launcher-card) :global(.card-backdrop img.visible){opacity:var(--card-background-opacity,.8)}
:global(.launcher-card) :global(.card-backdrop:not(:has(img))::after){display:none}
:global(.launcher-card) :global(.card-backdrop::after){background:linear-gradient(180deg,#0002,#0006 48%,#0009 100%)}
:global(.launcher-card[data-layout='gallery']){display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:min-content auto}
/* A spanning ratio guide sets a preferred size; real content can make either row taller. */
:global(.launcher-card[data-layout='gallery'])::before{content:'';grid-area:1 / 1 / 3 / 2;width:calc(100% + 2 * var(--stroke));margin:calc(-1 * var(--stroke));aspect-ratio:var(--card-aspect-ratio,3 / 4);max-height:var(--card-height,none);align-self:start;visibility:hidden;pointer-events:none}
:global(.launcher-card[data-layout='gallery']) .shared-card-art{grid-area:1 / 1}
:global(.launcher-card[data-layout='gallery']) .shared-card-body{grid-area:2 / 1}
:global(.launcher-card[data-layout='gallery'][data-media='image']){grid-template-rows:auto min-content}
:global(.launcher-card[data-layout='gallery'][data-media='image']) .shared-card-art{aspect-ratio:auto;flex:1;min-height:4rem}
:global(.launcher-card[data-layout='gallery'][data-media='image']) .shared-card-body{flex:0 0 auto;min-height:var(--card-body-min,0)}
:global(.launcher-card[data-layout='list']){flex-direction:row;align-items:stretch}
:global(.launcher-card[data-layout='list']) .shared-card-body{min-height:var(--card-body-min,8rem)}
:global(.launcher-card[data-layout='list']) .shared-card-art{width:clamp(3rem,24%,8.28571429rem);aspect-ratio:auto}
:global(.launcher-card[data-layout='list']) .shared-card-art :global(img),:global(.launcher-card[data-layout='list']) .shared-card-art :global(svg){width:65%}
:global(.launcher-card[data-layout='list'][data-media='image']) .shared-card-art :global(img){width:100%}
:global(.launcher-card[data-layout='list']) .catalog-kind{display:none}
.shared-card-actions{display:flex;align-items:center;gap:.71428571rem;flex-wrap:wrap;margin-top:auto;padding-top:1.14285714rem}
.shared-card-actions:empty{display:none}
:global(:where(.launcher-card) .ui-button){--button-fill:var(--card-action-fill);--button-hover:var(--card-action-hover);--button-text:var(--card-action-text);--icon-ink:var(--card-action-icon);backdrop-filter:blur(.57142857rem) brightness(1.25);-webkit-backdrop-filter:blur(.57142857rem) brightness(1.25);white-space:normal}
:global(:where(.launcher-card) .ui-button:not(.icon-button)){height:auto;min-height:var(--control-height);padding:.5em .71428571rem}
:global(.launcher-card:has(.card-backdrop img)) .shared-card-body{text-shadow:0 1px .21428571rem #0008}
:global(.launcher-card.disabled-entry) .shared-card-art{opacity:.5}
.card-visibility{position:absolute;inset:0;pointer-events:none}
@container(max-width:19.71428571rem){.shared-card-actions :global(.secondary-action){display:none}}
</style>
