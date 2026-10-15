<script lang="ts">
  import { t } from './i18n';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import { api } from './api';
  import { loaderLabel, type Loader } from './types';
  let { gameVersion, loader=$bindable<Loader>('vanilla'), loaderVersion=$bindable(''), ready=$bindable(false), disabled=false }:
    {gameVersion:string;loader?:Loader;loaderVersion?:string;ready?:boolean;disabled?:boolean}=$props();
  let versions=$state<string[]>([]);let error=$state('');let retry=$state(0);
  $effect(()=>{
    const game=gameVersion;const kind=loader;void retry;
    let alive=true;ready=false;error='';versions=[];
    if(kind==='vanilla'){loaderVersion='';ready=true;return;}
    if(!game)return;
    api.loaderVersions(game,kind).then(list=>{
      if(!alive)return;
      versions=list;
      if(!list.length){error=$t('No stable {loader} loader is available for this release.',{loader:loaderLabel(kind)});loaderVersion='';return;}
      if(!list.includes(loaderVersion))loaderVersion=list[0];
      ready=true;
    }).catch(e=>{if(alive)error=String(e);});
    return ()=>{alive=false;};
  });
</script>

<label>{$t("Mod loader")}<Select bind:value={loader} {disabled}><option value="vanilla">{$t("Vanilla")}</option><option value="fabric">Fabric</option><option value="quilt">Quilt</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option></Select></label>
{#if loader!=='vanilla'}
  <label>{$t('{loader} loader version',{loader:loaderLabel(loader)})}<Select bind:value={loaderVersion} disabled={disabled || !ready}>
    {#if !ready}<option value={loaderVersion}>{$t(error?'Unavailable':'Loading compatible loaders…')}</option>{/if}
    {#each versions as version}<option value={version}>{version}</option>{/each}
  </Select></label>
  {#if error}<div class="inline-error">{error}<Button shape="plain" type="button" disabled={disabled} onclick={()=>retry++}>{$t("Retry")}</Button></div>{/if}
{/if}
