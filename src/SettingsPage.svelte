<script lang="ts">
  import {onMount} from 'svelte';
  import {showDialog} from './dialog';
  import AppUpdater from './AppUpdater.svelte';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import { locale,autoUpdateChecks,doubleClickLaunch,reduceMotion,defaultInstanceLocation } from './preferences';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import RuntimeFields from './RuntimeFields.svelte';
  import Icon from './Icon.svelte';
  import { api, native } from './api';
  import type { Config, DebugLaunch } from './types';
  import type { SettingsFormState, Perform } from './ui-state';

  let { config, debugLaunch, ontoggleOffline, draft=$bindable(), signingIn, onsignin, onconfig, onnotice, perform }: {
    config: Config; debugLaunch: DebugLaunch; ontoggleOffline: ()=>Promise<void>; draft: SettingsFormState; signingIn: boolean; onsignin: ()=>void;
    onconfig: (config:Config)=>void; onnotice: (message:string)=>void; perform: Perform;
  } = $props();
  let launcherInfo=$state<Awaited<ReturnType<typeof api.launcherInfo>>|null>(null);
  let infoError=$state('');
  let signOutAccount=$state<Config['accounts'][number]|null>(null);
  let accountPending=$state(false);
  async function loadInfo(){infoError='';try{launcherInfo=await api.launcherInfo();}catch(e){infoError=String(e);}}
  onMount(()=>{if(native)void loadInfo();});
  async function useAccount(id:string){accountPending=true;try{await perform(async()=>onconfig(await api.account(id)));}finally{accountPending=false;}}
  async function signOut(){
    if(!signOutAccount || accountPending)return;
    const id=signOutAccount.id;accountPending=true;
    try{await perform(async()=>{await api.signOut(id);onconfig(await api.config());signOutAccount=null;});}finally{accountPending=false;}
  }
  let debugPending=$state(false);
  async function toggleOffline(){debugPending=true;try{await ontoggleOffline();}finally{debugPending=false;}}
  let tab=$state<'Accounts'|'Settings'>('Accounts');
  const tabs=['Accounts','Settings'] as const;
  async function saveSettings() {
    if(draft.pending)return;
    draft.pending=true;
    await perform(async()=>{
      onconfig(await api.settings(draft.clientId,draft.javaPath,draft.memory));
      onnotice('Default settings saved.');
    });
    draft.pending=false;
  }
</script>

<div class="page-title">

  <h1>{$t("Accounts & settings")}</h1>

</div>
<Tabs options={tabs} value={tab} prefix="profile" label={$t("Accounts and settings pages")} onchange={value=>tab=value}/>
<div class="instance-content" id={`profile-panel-${tab}`} role="tabpanel" aria-labelledby={`profile-tab-${tab}`}>
  {#if tab==='Accounts'}
  <section class="panel">
    {#if debugLaunch.available}
      <div class="offline-debug">
        <h2>{$t("Offline debugging")}</h2>
        <p class="muted">{$t("Single-player testing as ChestDebug. No multiplayer or Realms.")}</p>
        <Button disabled={debugPending} selected={debugLaunch.enabled} onclick={toggleOffline}>{$t(debugLaunch.enabled?'Disable':'Enable')}</Button>
        {#if debugLaunch.enabled}<p class="hint">{$t("Enabled for this session.")}</p>{/if}
      </div>
    {/if}
    <h2>{$t("Microsoft accounts")}</h2>

    {#each config.accounts as a}
      <div class="account-row">
        <Icon name="user" size={24}/>
        <span>
          <strong>{a.name}</strong>
          <small>{$t(a.id===config.active_account?'Active account':'Microsoft account')}</small>
        </span>
        {#if a.id!==config.active_account}
          <Button disabled={accountPending} onclick={()=>useAccount(a.id)}>{$t("Use")}</Button>
        {/if}
        <Button shape="plain" disabled={accountPending} onclick={()=>signOutAccount=a}>{$t("Sign out")}</Button>
      </div>
    {/each}
    <Button tone="accent" disabled={signingIn || !native || !config.client_id} onclick={onsignin}>
      <Icon name="user" size={17}/>{$t("Sign in")}</Button>
    {#if !config.client_id}
      <p class="hint">{$t("Set Chest’s application ID in")} <Button shape="plain" onclick={()=>tab='Settings'}>{$t("Settings")}</Button> {$t("to enable sign-in.")}</p>
    {/if}
  </section>
  {:else}
  <section class="panel launcher-settings">
    <h2>{$t("Launcher")}</h2>
    <label>{$t('Language')}<Select aria-label={$t('Language')} bind:value={$locale}><option value="en">English</option><option value="ko">한국어</option></Select></label>
    <label class="setting-toggle"><input type="checkbox" bind:checked={$doubleClickLaunch}/>{$t('Double-click to play')}</label>
    <label class="setting-toggle"><input type="checkbox" bind:checked={$autoUpdateChecks}/>{$t('Check for updates on startup')}</label>
    <label class="setting-toggle"><input type="checkbox" bind:checked={$reduceMotion}/>{$t('Reduce motion')}</label>
  </section>
  <form class="panel default-settings" onsubmit={e=>{e.preventDefault();void saveSettings();}}>
    <h2>{$t("Default settings")}</h2>

    <p class="hint">{$t("Applies to new instances.")}</p>
    <RuntimeFields disabled={draft.pending} bind:memory={draft.memory} bind:javaPath={draft.javaPath}/>
    <details class="developer-settings" open={!config.client_id}>
      <summary>{$t("Microsoft application setup")}</summary>
      <label>{$t("Chest application (client) ID")}<input bind:value={draft.clientId} placeholder="00000000-0000-0000-0000-000000000000"/>
        <span class="hint">{$t("Public client ID with personal accounts and localhost callback. See README.")}</span>
      </label>
    </details>
    <Button type="submit" tone="accent" disabled={draft.pending}>{$t(draft.pending?'Saving…':'Save')}</Button>
  </form>
  {#if native}
  <section class="panel storage-settings">
    <h2>{$t('Storage')}</h2>
    <div class="settings-field-row"><label>{$t('Default instance folder')}<input bind:value={$defaultInstanceLocation} placeholder={$t('Automatic')}/></label><Button aria-label={$t('Choose instance folder')} onclick={()=>perform(async()=>{const path=await api.chooseLocation();if(path)$defaultInstanceLocation=path;})}>{$t('Browse')}</Button><Button disabled={!$defaultInstanceLocation} onclick={()=>$defaultInstanceLocation=''}>{$t('Reset')}</Button></div>
    {#if launcherInfo?.data_path}
      <div class="settings-field-row"><label>{$t('Chest data folder')}<input readonly value={launcherInfo.data_path}/></label><Button onclick={()=>perform(()=>api.dataFolder())}>{$t('Open folder')}</Button></div>
      <p class="hint">Chest {launcherInfo.version} · {launcherInfo.platform} · {launcherInfo.architecture}</p>
    {:else if infoError}<p class="inline-error" role="alert">{infoError}</p><Button onclick={loadInfo}>{$t('Retry')}</Button>{/if}
  </section>
  {/if}
  <AppUpdater/>
  {/if}
</div>

{#if signOutAccount}
  <dialog class="modal" aria-labelledby="signout-title" use:showDialog oncancel={event=>{event.preventDefault();if(!accountPending)signOutAccount=null;}}>
    <h2 id="signout-title">{$t('Sign out {name}?',{name:signOutAccount.name})}</h2>
    <div class="form-actions"><Button disabled={accountPending} onclick={()=>signOutAccount=null}>{$t('Cancel')}</Button><Button tone="danger" disabled={accountPending} onclick={signOut}>{$t('Sign out')}</Button></div>
  </dialog>
{/if}
