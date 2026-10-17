<script lang="ts">
  import Message from './Message.svelte';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import { api } from './api';
  import { loaderLabel, type Loader } from './types';
  let { gameVersion, loader=$bindable<Loader>('vanilla'), loaderVersion=$bindable(''), ready=$bindable(false), disabled=false, preserveSelection=false }:
    {gameVersion:string;loader?:Loader;loaderVersion?:string;ready?:boolean;disabled?:boolean;preserveSelection?:boolean}=$props();
  const errorId=$props.id();
  let versions=$state<string[]>([]);let error=$state('');let retry=$state(0);
  let previousSelection='';
  $effect(()=>{
    const game=gameVersion;const kind=loader;void retry;
    const selection=JSON.stringify([game,kind]);
    const changed=previousSelection!=='' && previousSelection!==selection;
    previousSelection=selection;
    let alive=true;ready=false;error='';versions=[];
    if(kind==='vanilla'){if(changed)loaderVersion='';ready=true;return;}
    if(!game)return;
    api.loaderVersions(game,kind).then(list=>{
      if(!alive)return;
      versions=list;
      if(!list.length){error=$t('No stable {loader} loader is available for this release.',{loader:loaderLabel(kind)});if(changed)loaderVersion='';return;}
      if((changed || !preserveSelection) && !list.includes(loaderVersion))loaderVersion=list[0];
      ready=true;
    }).catch(e=>{if(alive)error=String(e);});
    return ()=>{alive=false;};
  });
</script>

<label>{$t("Mod loader")}<Select id={errorId+'-loader'} bind:value={loader} {disabled}><option value="vanilla">{$t("Vanilla")}</option><option value="fabric">Fabric</option><option value="quilt">Quilt</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option></Select></label>
{#if loader!=='vanilla'}
  <label>{$t('{loader} loader version',{loader:loaderLabel(loader)})}<Select bind:value={loaderVersion} disabled={disabled || !ready} aria-invalid={!!error} aria-describedby={error?errorId:undefined}>
    {#if !ready}<option value={loaderVersion}>{$t(error?'Unavailable':'Loading compatible loaders…')}</option>{/if}
    {#if ready && !versions.includes(loaderVersion)}<option value={loaderVersion}>{loaderVersion || $t('Automatic')}</option>{/if}
    {#each versions as version}<option value={version}>{version}</option>{/each}
  </Select></label>
  {#if error}<Message tone="error" text={error} actions={[{label:$t('Retry'),disabled,onclick:()=>{retry++;document.getElementById(errorId+'-loader')?.focus();}}]} id={errorId}/>{/if}
{/if}
