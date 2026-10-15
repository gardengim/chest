<script lang="ts">
  import type {Snippet} from 'svelte';
  import {version} from '../package.json';
  import {onMount} from 'svelte';
  import {t} from './i18n';
  import {native} from './api';
  import Button from './Button.svelte';
  import {appUpdate,initializeUpdater,checkForUpdates,installUpdate,restartUpdatedApp} from './app-updater';
  let {heading=true,headingLabel='Chest updates',startupChecks}:{heading?:boolean;headingLabel?:string;startupChecks?:Snippet}=$props();
  onMount(()=>{void initializeUpdater();});
  const busy=$derived(['checking','downloading','installing'].includes($appUpdate.phase));
  const percent=$derived($appUpdate.progress?.total?Math.min(100,Math.round($appUpdate.progress.downloaded/$appUpdate.progress.total*100)):null);
</script>
<section class="panel app-updater" aria-label={$t('Chest updates')}>
  {#if heading}<h2>{$t(headingLabel)}</h2>{/if}
  <p>Chest {$appUpdate.info?.current_version || version}</p>
  {#if !native}<p>{$t('Desktop app required')}</p><div class="form-actions"><Button disabled>{$t('Check')}</Button>{@render startupChecks?.()}</div>
  {:else}
    {#if $appUpdate.info?.version}<p>{$t('Available version')}: {$appUpdate.info.version}</p>{/if}
    {#if $appUpdate.info?.notes}<div class="update-notes">{$appUpdate.info.notes}</div>{/if}
    {#if $appUpdate.phase==='current'}<p role="status">{$t('Up to date')}</p>{/if}
    {#if $appUpdate.phase==='checking'}<p role="status">{$t('Checking…')}</p>{/if}
    {#if $appUpdate.phase==='downloading' || $appUpdate.phase==='installing'}
      <p role="status">{$t($appUpdate.phase==='installing'?'Installing…':'Downloading…')}{percent===null?'':` ${percent}%`}</p>
      <progress max="100" value={percent ?? undefined} aria-label={$t('Update progress')}></progress>
    {/if}
    {#if $appUpdate.error}<p class="inline-error" role="alert">{$t($appUpdate.error)}</p>{/if}
      <div class="form-actions">
        <Button disabled={busy || $appUpdate.phase==='ready'} onclick={checkForUpdates}>{$t('Check')}</Button>
        {@render startupChecks?.()}
        {#if $appUpdate.phase==='ready'}<Button tone="accent" onclick={restartUpdatedApp}>{$t('Restart')}</Button>
        {:else if $appUpdate.info?.version}<Button tone="accent" disabled={busy || $appUpdate.info.development || $appUpdate.info.test_profile} onclick={installUpdate}>{$t('Update')}</Button>{/if}
      </div>
    {#if $appUpdate.info?.test_profile}<p class="hint">{$t('Installing app updates is disabled in test profiles.')}</p>{/if}
    {#if $appUpdate.info?.development}<p class="hint">{$t('Updates can only be installed in release builds.')}</p>{/if}
  {/if}
</section>
