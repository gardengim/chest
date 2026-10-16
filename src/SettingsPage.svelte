<script lang="ts">
  const about=()=>import('./About.svelte');
  import {onMount} from 'svelte';
  import {showDialog} from './dialog';
  import ColorSchemeSettings from './ColorSchemeSettings.svelte';
  import AppUpdater from './AppUpdater.svelte';
  import StorageUsage from './StorageUsage.svelte';
  import { t } from './i18n';
  import Select from './Select.svelte';
  import { developSettings,languages,locale,autoUpdateChecks,doubleClickLaunch,reduceMotion,defaultInstanceLocation } from './preferences';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import RuntimeFields from './RuntimeFields.svelte';
  import SkinFace from './SkinFace.svelte';
  import Icon from './Icon.svelte';
  import { api, native } from './api';
  import type { Config, DebugLaunch } from './types';
  import type { SettingsFormState, SettingsTab, Perform } from './ui-state';

  let { config, debugLaunch, ontoggleOffline, draft=$bindable(), tab='Accounts', onselectTab, dirty, onsave, ondiscard, onrestore, signingIn, onsignin, onconfig, onnotice, perform }: {
    config: Config; debugLaunch: DebugLaunch; ontoggleOffline: ()=>Promise<void>; draft: SettingsFormState; signingIn: boolean; onsignin: ()=>void;
    onconfig: (config:Config)=>void; onnotice: (message:string)=>void; perform: Perform; tab?:SettingsTab; onselectTab:(tab:SettingsTab)=>void; dirty:boolean; onsave:()=>Promise<boolean>; ondiscard:()=>void; onrestore:()=>void;
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
  const development=$derived(native && $developSettings);
  const tabs=$derived<readonly SettingsTab[]>(development?['Accounts','Settings','Develop','About']:['Accounts','Settings','About']);
  $effect(()=>{if(tab==='Develop' && !development)onselectTab('Settings');});
  let applicationPending=$state(false);
  async function saveApplicationId(){
    applicationPending=true;
    try{await perform(async()=>{onconfig(await api.settings(draft.clientId,config.java_path,config.memory_mb));onnotice('Settings saved.');});}
    finally{applicationPending=false;}
  }

</script>

<div class="page-title">

  <h1>{$t("Settings")}</h1>

</div>
<Tabs options={tabs} value={tab} prefix="profile" label={$t("Accounts and settings pages")} onchange={onselectTab}/>
<div class="instance-content" id={`profile-panel-${tab}`} role="tabpanel" aria-labelledby={`profile-tab-${tab}`}>
  {#if tab==='Accounts'}
  <section class="panel">
    <h2>{$t("Microsoft accounts")}</h2>

    {#each config.accounts as a}
      <div class="account-row">
        <SkinFace account={a} size={32}/>
        <span>
          <strong>{a.name}</strong>
          <small>{$t(a.id===config.active_account?'Active account':'Microsoft account')}</small>
        </span>
        {#if a.id!==config.active_account}
          <Button disabled={accountPending} onclick={()=>useAccount(a.id)}>{$t("Use")}</Button>
        {/if}
        <Button tone="danger" disabled={accountPending} onclick={()=>signOutAccount=a}>{$t("Sign out")}</Button>
      </div>
    {/each}
    <Button tone="accent" disabled={signingIn || !native || !config.client_id} onclick={onsignin}>
      <Icon name="user" size={17}/>{$t("Sign in")}</Button>
    {#if !config.client_id}
      <p class="hint">{$t('Microsoft sign-in is not configured.')}{#if development} <Button shape="plain" onclick={()=>onselectTab('Develop')}>{$t('Microsoft application setup')}</Button>{/if}</p>
    {/if}
  </section>
  {:else if tab==='Develop' && development}
  {#if debugLaunch.available}
  <section class="panel">
    <h2>{$t('Debugging')}</h2>
    <h3>{$t('Offline debugging')}</h3>
    <p class="muted">{$t('Single-player testing as ChestDebug. No multiplayer or Realms.')}</p>
    <Button disabled={debugPending} selected={debugLaunch.enabled} onclick={toggleOffline}>{$t(debugLaunch.enabled?'Disable':'Enable')}</Button>
    {#if debugLaunch.enabled}<p class="hint">{$t('Enabled for this session.')}</p>{/if}
  </section>
  {/if}
  <form class="panel" onsubmit={event=>{event.preventDefault();void saveApplicationId();}}>
    <h2>{$t('Microsoft application setup')}</h2>
    <label>{$t('Chest application (client) ID')}<input bind:value={draft.clientId} disabled={applicationPending} placeholder="00000000-0000-0000-0000-000000000000"/></label>
    <Button type="submit" tone="accent" disabled={applicationPending || draft.clientId===config.client_id}>{$t(applicationPending?'Saving…':'Save')}</Button>
  </form>
  {:else if tab==='About'}
  {#await about()}<p role="status">{$t('Loading…')}</p>{:then module}<module.default info={launcherInfo}/>{:catch error}<p class="inline-error" role="alert">{String(error)}</p>{/await}
  {:else}
  <form class="settings-form" onsubmit={event=>{event.preventDefault();void onsave();}}>
    <fieldset disabled={draft.pending}>
      <section class="panel launcher-settings" aria-labelledby="general-settings-title">
        <h2 id="general-settings-title">{$t('General')}</h2>
        <label>{$t('Language')}<Select aria-label={$t('Language')} bind:value={$locale}>{#each Object.entries(languages) as [code,name]}<option value={code} lang={code}>{name}</option>{/each}</Select></label>
        <ColorSchemeSettings/>
        <label class="setting-toggle"><input type="checkbox" bind:checked={$doubleClickLaunch}/>{$t('Double-click to launch')}</label>
        <label class="setting-toggle"><input type="checkbox" role="switch" bind:checked={$developSettings}/>{$t('Develop settings')}</label>
        <label class="setting-toggle"><input type="checkbox" bind:checked={$reduceMotion}/>{$t('Reduce motion')}</label>
      </section>
      <section class="panel default-settings" aria-labelledby="default-settings-title">
        <h2 id="default-settings-title">{$t('Default instance settings')}</h2>
        <RuntimeFields disabled={draft.pending} bind:memory={draft.memory} bind:javaPath={draft.javaPath}/>
      </section>
      <section class="panel storage-settings" aria-labelledby="storage-settings-title">
        <h2 id="storage-settings-title">{$t('Storage')}</h2>
        <div class="settings-field-row"><label>{$t('Shared data packs')}<input readonly value={launcherInfo?.data_path ? `${launcherInfo.data_path}/datapacks` : ''}/></label><Button disabled={!native} onclick={()=>perform(()=>api.sharedDatapacks())}>{$t('Open folder')}</Button></div>
        <div class="settings-field-row"><label>{$t('Default instance folder')}<input bind:value={$defaultInstanceLocation} placeholder={$t('Automatic')}/></label><Button disabled={!native} aria-label={$t('Choose instance folder')} onclick={()=>perform(async()=>{const path=await api.chooseLocation();if(path)$defaultInstanceLocation=path;})}>{$t('Browse')}</Button><Button disabled={!$defaultInstanceLocation} onclick={()=>$defaultInstanceLocation=''}>{$t('Reset')}</Button></div>
        <div class="settings-field-row"><label>{$t('Chest data folder')}<input readonly value={launcherInfo?.data_path || ''}/></label><Button disabled={!native} onclick={()=>perform(()=>api.dataFolder())}>{$t('Open folder')}</Button></div>
        <StorageUsage/>
        {#if infoError}<p class="inline-error" role="alert">{infoError}</p><Button onclick={loadInfo}>{$t('Retry')}</Button>{/if}
      </section>
      <AppUpdater headingLabel="Updates">
        {#snippet startupChecks()}<label class="setting-toggle"><input type="checkbox" bind:checked={$autoUpdateChecks}/>{$t('Check for updates on startup')}</label>{/snippet}
      </AppUpdater>
      <div class="form-actions settings-actions">
        <Button type="submit" tone="accent" disabled={!dirty}>{$t(draft.pending?'Saving…':'Save')}</Button>
        <Button tone="danger" disabled={!dirty} onclick={ondiscard}>{$t('Discard')}</Button>
        <Button onclick={onrestore}>{$t('Restore defaults')}</Button>
      </div>
    </fieldset>
  </form>
  {/if}
</div>

{#if signOutAccount}
  <dialog class="modal" aria-labelledby="signout-title" use:showDialog oncancel={event=>{event.preventDefault();if(!accountPending)signOutAccount=null;}}>
    <h2 id="signout-title"><SkinFace account={signOutAccount} size={24}/> {$t('Sign out {name}?',{name:signOutAccount.name})}</h2>
    <div class="form-actions"><Button disabled={accountPending} onclick={()=>signOutAccount=null}>{$t('Cancel')}</Button><Button tone="danger" disabled={accountPending} onclick={signOut}>{$t('Sign out')}</Button></div>
  </dialog>
{/if}

<style>
.settings-form>fieldset{border:0;padding:0;margin:0;min-width:0}
.settings-form :global(.setting-toggle){display:flex;align-items:center;gap:.57142857rem;margin:0}
.settings-form :global(.launcher-settings>.setting-toggle){margin-top:1rem}
.settings-form :global(.app-updater .form-actions){justify-content:flex-start;align-items:center;flex-wrap:wrap}
.settings-actions{justify-content:flex-start;flex-wrap:wrap;margin-top:1.71428571rem}
</style>
