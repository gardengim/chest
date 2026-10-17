<script lang="ts">
  import Message from './Message.svelte';
  import {onDestroy} from 'svelte';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import SegmentedControl from './SegmentedControl.svelte';
  import {api,native} from './api';
  import {t} from './i18n';
  import {availableSchemes,appearanceMode,currentScheme,previewScheme,preview,exportScheme,schemeSizeLimit} from './themes';
  let picker:HTMLInputElement;
  const schemeSelection=$derived(String($availableSchemes.findIndex(scheme=>JSON.stringify(scheme)===JSON.stringify($currentScheme))));
  const modeOptions=$derived([
    {value:'light' as const,label:$t('Light')},
    {value:'dark' as const,label:$t('Dark')},
    {value:'system' as const,label:$t('System')},
  ]);
  let source=$state(''),error=$state(''),reading=$state(false),saving=$state(false);
  let alive=true;
  onDestroy(()=>{alive=false;});
  function inspect(text:string,name?:string){
    error='';try{preview(text,name || $t('Imported theme'));}catch(reason){error=reason instanceof Error?reason.message:String(reason);}
  }
  async function chooseFile(){
    if(!native){picker.click();return;}
    reading=true;error='';
    try{const file=await api.importColorScheme();if(alive && file)inspect(file.source,file.name);}catch(reason){if(alive)error=reason instanceof Error?reason.message:String(reason);}finally{if(alive)reading=false;}
  }
  async function importFile(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';
    if(!file)return;
    if(file.size>schemeSizeLimit){error='Themes must not exceed 64 KB.';return;}
    reading=true;error='';
    try{const text=await file.text();if(alive)inspect(text,file.name.replace(/\.(json|css)$/i,'').slice(0,120) || undefined);}catch{if(alive)error='Could not read the theme.';}finally{if(alive)reading=false;}
  }
  async function exportFile(){
    error='';
    if(native){saving=true;try{await api.exportColorScheme(exportScheme());}catch(reason){if(alive)error=reason instanceof Error?reason.message:String(reason);}finally{if(alive)saving=false;}return;}
    const url=URL.createObjectURL(new Blob([exportScheme()],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='chest-theme.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
</script>
<div class="color-scheme-settings" aria-labelledby="color-scheme-title">
  <h3 id="color-scheme-title">{$t('Appearance')}</h3>
  <div class="appearance-controls">
  <label class="scheme-picker">{$t('Theme')}
    <Select value={schemeSelection} disabled={reading || saving} onchange={event=>{const scheme=$availableSchemes[Number(event.currentTarget.value)];if(scheme)inspect(JSON.stringify(scheme));}}>
      {#each $availableSchemes as scheme,index}<option value={String(index)}>{scheme=== $availableSchemes[0] ? $t(scheme.name) : scheme.name}</option>{/each}
    </Select>
  </label>
  <SegmentedControl options={modeOptions} bind:value={$appearanceMode} label={$t('Appearance mode')}/>
  </div>
  <input class="scheme-file" bind:this={picker} type="file" accept=".json,.css,application/json,text/css" aria-label={$t('Import theme file')} onchange={importFile}/>
  <div class="form-actions">
    <Button disabled={reading || saving} onclick={chooseFile}>{$t(reading?'Loading…':'Import theme')}</Button>
    <Button disabled={reading || saving} onclick={exportFile}>{$t(saving?'Saving…':'Export theme')}</Button>
  </div>
  <details>
    <summary>{$t('Paste a theme')}</summary>
    <label>{$t('Theme contents')}<textarea rows={6} maxlength={schemeSizeLimit} bind:value={source} spellcheck="false"></textarea></label>
    <Button disabled={!source.trim() || reading || saving} onclick={()=>inspect(source)}>{$t('Preview theme')}</Button>
  </details>
  {#if error}<Message tone="error" text={$t(error)}/>{/if}
  {#if $previewScheme}
    <div class="scheme-preview">
      <p role="status">{$t('Previewing {name}.',{name:$previewScheme.name})}</p>
    </div>
  {/if}
</div>
<style>
.color-scheme-settings{margin-bottom:1.71428571rem;min-width:0}
.scheme-file{display:none}
.appearance-controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:1rem;min-width:0}
.scheme-picker{flex:1 1 18rem;min-width:0;margin:0}
.form-actions{justify-content:flex-start;flex-wrap:wrap;margin:1rem 0}
textarea{display:block;width:100%;min-width:0;padding:.85714286rem;margin-top:.57142857rem;font-family:ui-monospace,monospace}
details{margin-top:1rem}summary{cursor:pointer;margin-bottom:1rem}
.scheme-preview{margin-top:1rem;padding-top:1rem;border-top:var(--divider) solid var(--frame)}
.scheme-preview p{overflow-wrap:anywhere}
</style>
