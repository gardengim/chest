<script lang="ts">
  import SkinFace from './SkinFace.svelte';
  import type {Account} from './types';
  let {account,size=20}:{account:Account;size?:number}=$props();
</script>
<span class="account-name"><SkinFace {account} {size}/><bdi>{account.name}</bdi></span>
<style>.account-name{display:inline-flex;align-items:center;gap:0.57142857rem;vertical-align:middle;min-width:0}.account-name>bdi{overflow-wrap:anywhere}</style>
