<script lang="ts">
  import {onMount} from 'svelte';
  import {t} from './i18n';
  import {native} from './api';
  import Button from './Button.svelte';
  import {appUpdate,initializeUpdater,checkForUpdates,installUpdate,restartUpdatedApp} from './app-updater';
  let {heading=true}:{heading?:boolean}=$props();
  onMount(()=>{void initializeUpdater();});
  const busy=$derived(['checking','downloading','installing'].includes($appUpdate.phase));
  const percent=$derived($appUpdate.progress?.total?Math.min(100,Math.round($appUpdate.progress.downloaded/$appUpdate.progress.total*100)):null);
</script>
<section class="panel app-updater" aria-label={$t('Chest updates')}>
  {#if heading}<h2>{$t('Chest updates')}</h2>{/if}
  {#if $appUpdate.info}<p>Chest {$appUpdate.info.current_version}</p>{/if}
  {#if !native}<p>{$t('Desktop app required')}</p>
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
    {#if $appUpdate.phase==='ready'}<Button tone="accent" onclick={restartUpdatedApp}>{$t('Restart')}</Button>
    {:else}
      <div class="form-actions">
        <Button disabled={busy} onclick={checkForUpdates}>{$t('Check')}</Button>
        {#if $appUpdate.info?.version}<Button tone="accent" disabled={busy || $appUpdate.info.development || $appUpdate.info.test_profile} onclick={installUpdate}>{$t('Update')}</Button>{/if}
      </div>
    {/if}
    {#if $appUpdate.info?.test_profile}<p class="hint">{$t('App updates are disabled in test profiles.')}</p>{/if}
    {#if $appUpdate.info?.development}<p class="hint">{$t('Updates install in release builds.')}</p>{/if}
  {/if}
</section>
