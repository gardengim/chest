<script lang="ts">
  import {untrack} from 'svelte';
  import { t } from './i18n';
  import {api} from './api';
  import AccountName from './AccountName.svelte';
  import SkinFace from './SkinFace.svelte';
  import {supportsGraphicsApi,type Account} from './types';
  import {createLaunchDraft,type LaunchDraft} from './ui-state';
  import Button from './Button.svelte';
  import {setLaunchDraft,launchDraftValue} from './launch-draft';
  import SettingsGroup from './SettingsGroup.svelte';
  import Select from './Select.svelte';
  let {id,version='',accounts,busy=false,draft=$bindable(createLaunchDraft())}:{id:string;version?:string;accounts:Account[];busy?:boolean;draft?:LaunchDraft}=$props();
  async function load(instance:string,state:LaunchDraft){
    if(state.loaded || state.loading)return;state.loading=true;state.error='';
    try{setLaunchDraft(state,await api.launchSettings(instance));state.loaded=true;state.baseline=launchDraftValue(state);}
    catch(e){state.error=String(e);}finally{state.loading=false;}
  }
  $effect(()=>{const instance=id;const state=untrack(()=>draft);void load(instance,state);});
</script>
<section class="panel launch-settings settings-form" aria-label={$t('Launch settings')}>
  <h2>{$t('Launch settings')}</h2>
  <fieldset disabled={!draft.loaded || draft.pending || busy}>
    <SettingsGroup title={$t('Launch behavior')}>
      <label>{$t('Account')}<div class="account-select">{#if accounts.find(a=>a.id===draft.account)}<SkinFace account={accounts.find(a=>a.id===draft.account)} size={24}/>{/if}<Select bind:value={draft.account}><option value="">{$t('Active account')}</option>{#if draft.account && !accounts.some(a=>a.id===draft.account)}<option value={draft.account}>{$t('Not signed in')}</option>{/if}{#each accounts as a}<option value={a.id}>{a.name}</option>{/each}
      {#snippet optionContent(value:string,label:string)}{#if accounts.find(a=>a.id===value)}<AccountName account={accounts.find(a=>a.id===value)!}/>{:else}{label}{/if}{/snippet}
      </Select></div></label>
      <label class="setting-toggle"><input type="checkbox" bind:checked={draft.settings.open_log}/>{$t('Open log on launch')}</label>
    </SettingsGroup>
    <SettingsGroup title={$t('Display')}>
      <label>{$t('Graphics API')}<Select bind:value={draft.settings.graphics_api} aria-describedby={!supportsGraphicsApi(version)?`graphics-hint-${id}`:undefined}>
        <option value="default">{$t('Use in-game setting')}</option>
        <option value="open_gl" disabled={!supportsGraphicsApi(version)}>{$t('Prefer OpenGL')}</option>
        <option value="vulkan" disabled={!supportsGraphicsApi(version)}>{$t('Prefer Vulkan (experimental)')}</option>
      </Select>{#if !supportsGraphicsApi(version)}<span class="hint" id={`graphics-hint-${id}`}>{$t('Graphics API selection requires Minecraft 26.2 or later.')}</span>{/if}</label>
      {#if draft.settings.graphics_api==='vulkan'}<p class="hint">{$t('Vulkan is experimental and may fall back to OpenGL. Iris shader packs require OpenGL; some rendering mods and resource packs may be incompatible.')}</p>{/if}
      <div class="settings-grid"><label>{$t('Window width')}<input type="number" min="320" max="16384" required bind:value={draft.settings.width}/></label><label>{$t('Window height')}<input type="number" min="240" max="16384" required bind:value={draft.settings.height}/></label></div>
      <label class="setting-toggle"><input type="checkbox" bind:checked={draft.settings.fullscreen}/>{$t('Fullscreen')}</label>
    </SettingsGroup>
    <details class="settings-advanced"><summary>{$t('Advanced')}</summary>
      <SettingsGroup title={$t('Arguments')}>
        <div class="settings-grid"><label>{$t('Java arguments')}<textarea rows="3" placeholder={$t('One argument per line.')} bind:value={draft.javaArgs}></textarea></label><label>{$t('Game arguments')}<textarea rows="3" placeholder={$t('One argument per line.')} bind:value={draft.gameArgs}></textarea></label></div>
      </SettingsGroup>
      <SettingsGroup title={$t('Environment variables')}>
        <textarea aria-label={$t('Environment variables')} rows="3" bind:value={draft.environment} placeholder="NAME=value"></textarea>
      </SettingsGroup>
      <SettingsGroup title={$t('Launch commands')}>
        <p class="hint">{$t('Commands run in the instance folder without a shell; first line is the executable.')}</p>
        <div class="settings-grid"><label>{$t('Before launch')}<textarea rows="3" bind:value={draft.before}></textarea></label><label>{$t('After exit')}<textarea rows="3" bind:value={draft.after}></textarea></label></div>
      </SettingsGroup>
    </details>
  </fieldset>
  {#if draft.loading}<p role="status">{$t('Loading…')}</p>{/if}
  {#if draft.error}<p role="alert" class="inline-error">{draft.error}</p>{#if !draft.loaded}<Button onclick={()=>load(id,draft)}>{$t('Retry')}</Button>{/if}{/if}
</section>
<style>
.account-select{display:flex;align-items:center;gap:.57142857rem}.account-select :global(select){flex:1;min-width:0}
fieldset{border:0;padding:0;margin:0;min-width:0}
textarea{resize:vertical;min-height:5rem;width:100%}
.settings-advanced{margin:0 0 1.28571429rem;border-top:var(--divider) solid var(--frame)}
summary{cursor:pointer;padding-block:1rem;font-weight:600}
.settings-advanced :global(.settings-group:first-of-type){border-top:0}
</style>
