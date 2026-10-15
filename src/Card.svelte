<script lang="ts">
  import {untrack,type Snippet} from 'svelte';
  import {observeVisibility} from './visibility';
  import {loadCardArtwork} from './card-artwork';
  import type {HTMLAttributes} from 'svelte/elements';
  import Button from './Button.svelte';
  import ArtworkImage from './ArtworkImage.svelte';
  import ScreenshotBackdrop from './ScreenshotBackdrop.svelte';
  type Props=Omit<HTMLAttributes<HTMLElement>,'children'|'title'> & {
    disabled?:boolean;artworkKey?:string;loadIcon?:()=>Promise<string|null>;title:string;icon?:string|null;background?:string|null;instanceId?:string;
    width?:string;height?:string;minHeight?:string;maxHeight?:string;padding?:string;iconSize?:string;
    media?:'icon'|'image'|'none';imageFit?:'cover'|'contain';mediaRatio?:string;backgroundOpacity?:number;bodyMinHeight?:string;
    backgroundFromIcon?:boolean;badge?:string;layout?:'gallery'|'list';
    interactive?:boolean;children?:Snippet;actions?:Snippet;art?:Snippet;
  };
  let {title,icon,background,backgroundFromIcon=false,media='icon',imageFit='cover',mediaRatio,backgroundOpacity=.8,bodyMinHeight,instanceId,artworkKey='',loadIcon,badge,layout='gallery',interactive=true,
    children,actions,art,width,height,minHeight,maxHeight,padding,iconSize,style:customStyle,class:className,...attributes}:Props=$props();
  const cardStyle=$derived(Object.entries({
    '--card-width':width,'--card-height':height,'--card-min-height':minHeight,'--card-max-height':maxHeight,
    '--card-padding':padding,'--card-icon-size':iconSize,'--card-media-ratio':mediaRatio,
    '--card-image-fit':imageFit,'--card-background-opacity':backgroundOpacity,'--card-body-min':bodyMinHeight,
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
  const image=$derived(candidate && candidate!==failedIcon?candidate:null);
</script>
{#snippet contents()}
  <ScreenshotBackdrop id={instanceId} sources={background?[background]:backgroundFromIcon && image?[image]:instanceId?undefined:[]} fallback={image || undefined} variant="card"/>
  {#if media==='none'}<span class="card-visibility" use:observe></span>{:else}<div class="shared-card-art" use:observe>
    {#if art}{@render art()}{:else}<ArtworkImage source={image} onfailure={()=>failedIcon=image || ''} fallback="none" lazy/>{/if}
    {#if badge}<span class="catalog-kind">{badge}</span>{/if}
  </div>{/if}
  <div class="shared-card-body">
    <h3>{title}</h3>
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
:global(.launcher-card){--text:var(--theme-card-text);--muted:var(--theme-card-muted);--icon-ink:var(--icon-on-card);--link:var(--theme-link);--negative-text:var(--theme-danger-text);position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;min-width:0;width:var(--card-width,100%);height:var(--card-height,auto);min-height:var(--card-min-height,0);max-height:var(--card-max-height,none);margin:0;padding:0;text-align:left;font-size:.85714286rem;overflow:hidden;border:var(--stroke) solid var(--frame);background:var(--card-fill,var(--theme-surface));color:var(--text);box-shadow:var(--shadow-drop)}
:global(.launcher-card:has(.card-backdrop img)){--text:var(--theme-overlay-text);--muted:var(--theme-overlay-muted);--icon-ink:#ececec}
:global(.launcher-card)::after{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;box-shadow:var(--bevel-raised)}
:global(.launcher-card.ui-button:not(:disabled):active)::after{box-shadow:var(--bevel-pressed)}
:global(.launcher-card[data-highlighted='true']){outline:var(--stroke) solid var(--focus-ring);outline-offset:.14285714rem}
.shared-card-art{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;aspect-ratio:var(--card-media-ratio,2 / 1);flex-shrink:0;color:var(--muted)}
.shared-card-art :global(img),.shared-card-art :global(svg){width:28%;max-width:var(--card-icon-size);height:auto;aspect-ratio:1;object-fit:contain;color:inherit;filter:drop-shadow(0 .85714286rem .71428571rem #0003)}
:global(.launcher-card[data-media='image']) .shared-card-art :global(img){width:100%;max-width:none;height:100%;aspect-ratio:auto;object-fit:var(--card-image-fit,cover);image-rendering:auto;filter:none}
:global(.launcher-card[data-media='image']) .shared-card-art :global(span:not(.catalog-kind)){padding:var(--card-padding);font-size:.85714286rem;color:var(--muted)}
.shared-card-body{display:flex;flex-direction:column;flex:1;min-width:0;min-height:var(--card-body-min,8rem);width:100%;padding:var(--card-padding);text-shadow:0 1px .21428571rem #0008;container-type:inline-size}
:global(.launcher-card) .shared-card-body h3{font-size:1.28571429rem;margin:0 0 .35714286rem;overflow-wrap:anywhere;color:var(--text)}
:global(.launcher-card) .shared-card-body :global(p),:global(.launcher-card) .shared-card-body :global(small){color:var(--muted)}
.catalog-kind{position:absolute;bottom:.64285714rem;right:.71428571rem;color:var(--theme-input-text);background:var(--theme-input);border:var(--divider) solid var(--frame);padding:.21428571rem .42857143rem;font-size:.71428571rem}
:global(.launcher-card) :global(.card-backdrop){inset:0;width:auto;height:100%;background:var(--theme-card)}
:global(.launcher-card) :global(.card-backdrop img.visible){opacity:var(--card-background-opacity,.8)}
:global(.launcher-card) :global(.card-backdrop:not(:has(img))::after){display:none}
:global(.launcher-card) :global(.card-backdrop::after){background:linear-gradient(180deg,#0002,#0006 48%,#0009 100%)}
:global(.launcher-card[data-layout='list']){flex-direction:row;align-items:stretch}
:global(.launcher-card[data-layout='list']) .shared-card-art{width:clamp(3rem,24%,8.28571429rem);aspect-ratio:auto}
:global(.launcher-card[data-layout='list']) .shared-card-art :global(img),:global(.launcher-card[data-layout='list']) .shared-card-art :global(svg){width:65%}
:global(.launcher-card[data-layout='list'][data-media='image']) .shared-card-art :global(img){width:100%}
:global(.launcher-card[data-layout='list']) .catalog-kind{display:none}
.shared-card-actions{display:flex;align-items:center;gap:.71428571rem;flex-wrap:wrap;margin-top:auto;padding-top:1.14285714rem}
.shared-card-actions:empty{display:none}
.shared-card-actions :global(.ui-button){--button-fill:#0006;--button-hover:#0008;--button-text:var(--text);--icon-ink:inherit;--button-shadow:var(--bevel-raised);border-color:#ffffff26;backdrop-filter:blur(.42857143rem);-webkit-backdrop-filter:blur(.42857143rem);height:auto;min-height:var(--control-height);white-space:normal;padding:.5em .71428571rem}
.shared-card-actions :global(.card-action-more){font-size:1.57142857rem;line-height:1;padding:.25em .57142857rem}
:global(.launcher-card.disabled-entry) .shared-card-art{opacity:.5}
.card-visibility{position:absolute;inset:0;pointer-events:none}
@container(max-width:17.14285714rem){.shared-card-actions :global(.secondary-action){display:none}}
</style>
