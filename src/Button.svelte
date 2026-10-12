<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    children?: Snippet;
    tone?: 'neutral' | 'accent' | 'danger';
    shape?: 'button' | 'plain' | 'card' | 'tab' | 'rail';
    selected?: boolean;
  };
  let { children, tone='neutral', shape='button', selected=false,
    type='button', class:className, ...attributes }: Props = $props();
</script>

<button {...attributes} {type} class={['ui-button',className]} data-tone={tone} data-shape={shape} data-selected={selected || undefined}>
  {@render children?.()}
</button>

<style>
  /* Low-specificity defaults let page classes set layout without reimplementing feedback. */
  :global {

  :where(.ui-button) {
    --button-fill: #55585c;
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    --button-text: #f0f0f1;
    --button-edge:var(--bevel-highlight);
    --button-shadow: inset var(--bevel) var(--bevel) var(--bevel-highlight), inset calc(-1 * var(--bevel)) calc(-1 * var(--bevel)) var(--bevel-shadow), 0 var(--depth) var(--bevel-shadow);
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    min-height:var(--control-height);
    padding:0 14px;
    border:var(--stroke) solid var(--frame);
    border-radius:0;
    background:var(--button-fill);
    color:var(--button-text);
    box-shadow:var(--button-shadow);
    font:inherit;
    font-size:12px;
    cursor:pointer;
    transition:background-color .12s, border-color .12s, box-shadow .12s, transform .12s, color .12s;
  }
  :where(.ui-button[data-tone='accent']) {
    --button-fill:#416c29;
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    --button-text:#fff;
    --button-edge:var(--bevel-highlight);
    font-weight:600;
  }
  :where(.ui-button[data-tone='danger']) {
    --button-fill:#773f35;
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    --button-text:#ffe0d8;
    --button-edge:var(--bevel-highlight);
  }
  :where(.ui-button[data-selected][data-shape='button']) {
    --button-fill:#626c5b;
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    --button-text:#eff5e6;
    border-color:#93b66c;
  }
  :where(.ui-button):hover:enabled {
    background-color:var(--button-hover);
    border-color:var(--button-edge);
    transform:translateY(calc(-1 * var(--pixel)));
  }
  :where(.ui-button):active:enabled {
    transform:translateY(var(--pixel));
    box-shadow:inset var(--bevel) var(--bevel) var(--bevel-shadow);
  }
  :where(.ui-button):focus-visible {
    outline:var(--stroke) solid #b5e681;
    outline-offset:3px;
  }
  :where(.ui-button):disabled { opacity:.5; cursor:not-allowed; }

  :where(.ui-button[data-shape='plain']), :where(.ui-button[data-shape='rail']) {
    --button-fill:transparent;
    --button-hover:#ffffff09;
    --button-text:inherit;
    --button-shadow:none;
    border:0;
    padding:8px 0;
  }
  :where(.ui-button[data-shape='plain'][data-tone='danger']) { --button-text:#e6ada0; }
  :where(.ui-button[data-shape='card']) {
    --button-fill:var(--card-fill,#36383b);
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    --button-text:var(--card-text,#ececed);
    --button-edge:var(--bevel-highlight);
    --button-shadow:inset var(--bevel) var(--bevel) var(--bevel-highlight), inset calc(-1 * var(--bevel)) calc(-1 * var(--bevel)) var(--bevel-shadow), 0 var(--depth) var(--bevel-shadow);
    display:block;
    min-height:0;
    padding:0;
    text-align:left;
    overflow:hidden;
  }
  /* Vertical tabs use the sidebar palette and open toward the page. */
  :where(.ui-button[data-shape='rail']) {
    --button-fill:var(--rail-tab,#353b43);
    --button-hover:var(--rail-hover,#444d58);
    --button-text:#d8dde3;
    isolation:isolate;
    width:calc(100% - var(--rail-inset) + var(--stroke));
    height:56px;
    min-height:56px;
    margin-left:var(--rail-inset);
    padding:8px;
    flex:none;
    background:transparent;
    transform:none;
  }
  :where(.ui-button[data-shape='rail'])::before,
  :where(.ui-button[data-shape='rail'])::after {
    content:'';
    position:absolute;
    pointer-events:none;
    clip-path:var(--rail-outline);
  }
  :where(.ui-button[data-shape='rail'])::before { inset:0; z-index:-2; background:var(--frame); }
  :where(.ui-button[data-shape='rail'])::after {
    clip-path:var(--rail-fill);
    inset:2px;
    z-index:-1;
    background:var(--button-fill);
    box-shadow:inset var(--bevel) var(--bevel) var(--bevel-highlight), inset 0 calc(-1 * var(--bevel)) var(--bevel-shadow);
    transition:background-color .12s, box-shadow .12s;
  }
  :where(.ui-button[data-shape='rail']):hover:enabled,
  :where(.ui-button[data-shape='rail']):active:enabled { background:transparent; transform:none; box-shadow:none; }
  :where(.ui-button[data-shape='rail']):hover:enabled::after { background-color:var(--button-hover); }
  /* Press feedback wins over member bevels, activity hover, and hidden group headers. */
  .ui-button[data-shape='rail'][data-tone]:not([data-selected]):active:enabled::after {
    display:block;
    box-shadow:inset var(--bevel) var(--bevel) var(--bevel-shadow);
  }
  .ui-button[data-shape='rail']:not([data-selected]):active:enabled > * { translate:var(--pixel) var(--pixel); }
  :where(.ui-button[data-shape='rail'][data-selected]) {
    --button-fill:var(--rail-selected,#1c1d1f);
    --button-hover:var(--rail-selected,#1c1d1f);
    z-index:1;
  }
  :where(.ui-button[data-shape='rail'][data-selected])::before,
  :where(.ui-button[data-shape='rail'][data-selected])::after { right:calc(-1 * var(--stroke)); }
  :where(.ui-button[data-shape='rail'][data-selected])::after { background-image:linear-gradient(90deg, var(--rail-join-start,#2c3137), var(--rail-selected,#1c1d1f) 85%); }

  /* Tabs share feedback but stay connected to the inventory panel. */
  :where(.ui-button[data-shape='tab']) {
    --button-fill:#929498;
    --button-hover:color-mix(in srgb,var(--button-fill) 88%,white);
    isolation:isolate;
    min-height:44px;
    margin:0;
    padding:12px 14px;
    border:0;
    background:transparent;
    color:#222;
    box-shadow:none;
    transform:none;
  }
  :where(.ui-button[data-shape='tab'])::before, :where(.ui-button[data-shape='tab'])::after {
    content:'';
    position:absolute;
    pointer-events:none;
  }
  :where(.ui-button[data-shape='tab'])::before {
    inset:0 0 -2px;
    z-index:-2;
    background:var(--frame);
    clip-path:polygon(0 4px, 2px 4px, 2px 2px, 4px 2px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 2px, calc(100% - 2px) 2px, calc(100% - 2px) 4px, 100% 4px, 100% 100%, 0 100%);
  }
  :where(.ui-button[data-shape='tab'])::after {
    inset:2px 2px 0;
    z-index:-1;
    background:var(--button-fill);
    box-shadow:inset var(--bevel) var(--bevel) var(--bevel-highlight-strong), inset -1px 0 var(--bevel-shadow);
    clip-path:polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% 100%, 0 100%);
    transition:background-color .12s, box-shadow .12s;
  }
  :where(.ui-button[data-shape='tab']):hover:enabled,
  :where(.ui-button[data-shape='tab']):active:enabled { background:transparent; transform:none; box-shadow:none; }
  :where(.ui-button[data-shape='tab']):hover:enabled::after { background:var(--button-hover); }
  :where(.ui-button[data-shape='tab']:not([data-selected])):active:enabled::after { box-shadow:inset var(--bevel) var(--bevel) var(--bevel-shadow); }
  :where(.ui-button[data-shape='tab'][data-selected]) {
    --button-fill:var(--inventory);
    --button-hover:var(--inventory);
    min-height:48px;
    padding-bottom:16px;
    color:#171717;
    z-index:1;
  }
  /* Cover the panel border and bevel, including fractional-pixel positioning. */
  :where(.ui-button[data-shape='tab'][data-selected])::before { bottom:calc(-1 * var(--stroke) - 2 * var(--bevel)); }
  :where(.ui-button[data-shape='tab'][data-selected])::after { bottom:calc(-1 * var(--stroke) - 2 * var(--bevel)); box-shadow:inset var(--bevel) var(--bevel) var(--bevel-highlight-strong), inset -1px 0 var(--bevel-shadow); }
  @media (max-width:980px) { :where(.ui-button[data-shape='tab']) { padding-inline:9px; } }
  @media (max-width:750px) { :where(.ui-button[data-shape='tab']) { padding-inline:8px; } }
  @media (prefers-reduced-motion:reduce) { :where(.ui-button), :where(.ui-button)::after { transition:none; } }

  }
</style>
