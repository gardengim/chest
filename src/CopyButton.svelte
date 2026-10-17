<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import {t} from './i18n';
  let {text}:{text:string}=$props();
  let state=$state('Copy');
  $effect(()=>{void text;state='Copy';});
  async function copy(){
    try{await navigator.clipboard.writeText(text);state='Copied';}
    catch{state='Copy failed';}
  }
</script>
<Button class="icon-button" aria-label={$t(state)} title={$t(state)} onclick={copy}><Icon name="squares-overlapping" size={16}/></Button>
<span class="copy-status" role="status">{state==='Copy'?'':$t(state)}</span>
<style>.copy-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}</style>
