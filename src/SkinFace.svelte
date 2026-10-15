<script lang="ts">
  import Icon from './Icon.svelte';
  import {accountSkin} from './account-skins';
  import {observeVisibility} from './visibility';
  import type {Account} from './types';
  let {account,size=24}:{account?:Account|null;size?:number}=$props();
  let visible=$state(false),image=$state<{id:string;source:string|null}|null>(null),failed=$state('');
  function observe(node:HTMLElement){return {destroy:observeVisibility(node,value=>visible=value)};}
  $effect(()=>{
    const id=account?.id;if(!id || !visible)return;
    let alive=true;const refresh=()=>{void accountSkin(id).then(source=>{if(alive)image={id,source};});};refresh();
    window.addEventListener('focus',refresh);return()=>{alive=false;window.removeEventListener('focus',refresh);};
  });
  const source=$derived(image?.id===account?.id && image?.source!==failed?image?.source:null);
</script>
<span class="skin-face" use:observe style:--face-size={`${size/14}rem`} aria-hidden="true" data-account={account?.id}>
  {#if source}<img class="base" src={source} alt="" draggable="false" onerror={()=>failed=source}/><img class="hat" src={source} alt="" draggable="false"/>{:else}<Icon name="user" {size}/>{/if}
</span>
<style>
  .skin-face{position:relative;display:inline-block;flex:none;width:var(--face-size);height:var(--face-size);overflow:hidden;vertical-align:middle}
  img{position:absolute;width:calc(var(--face-size) * 8);height:auto;max-width:none;left:calc(-1 * var(--face-size));top:calc(-1 * var(--face-size));image-rendering:pixelated}
  .hat{left:calc(-5 * var(--face-size))}
</style>
