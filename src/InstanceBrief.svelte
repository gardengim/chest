<script lang="ts">
  import { t } from './i18n';
  import { loaderLabel, type Instance } from './types';
  let { instance }: { instance:Instance } = $props();
  const seconds=$derived(instance.playtime_seconds || 0);
  const minutes=$derived(Math.floor(seconds/60));
  const playtime=$derived(seconds===0?$t('Not played yet'):minutes===0?$t('<1 min played'):minutes<60?$t('{minutes} min played',{minutes}):minutes%60?$t('{hours} h {minutes} min played',{hours:Math.floor(minutes/60),minutes:minutes%60}):$t('{hours} h played',{hours:Math.floor(minutes/60)}));
</script>

<p class="instance-brief">
  <span>{instance.version==='pending'?$t('Preparing modpack'):instance.version}</span>
  {#if instance.version!=='pending' && instance.loader!=='vanilla'}
    <span aria-hidden="true">·</span>
    <span>{$t(loaderLabel(instance.loader))}{instance.loader_version?` ${instance.loader_version}`:''}</span>
  {/if}
  <span aria-hidden="true">·</span>
  <span>{playtime}</span>
</p>

<style>
  .instance-brief { display:flex; flex-wrap:wrap; align-items:baseline; gap:0.28571429rem 0.5rem; margin:0; color:var(--muted); line-height:1.6; }
  .instance-brief > span { white-space:normal; overflow-wrap:anywhere; min-width:0; }
</style>
