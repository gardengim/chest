<script lang="ts">
  import Button from './Button.svelte';
  import {api,native} from './api';
  import { t } from './i18n';
  let { memory = $bindable(4096), javaPath = $bindable(''), disabled = false }: {
    memory?: number; javaPath?: string; disabled?: boolean;
  } = $props();
  let checking=$state(false), picking=$state(false), report=$state(''), error=$state('');
  $effect(()=>{void javaPath;report='';error='';});
  async function choose(){
    picking=true;error='';
    try{const path=await api.chooseJava();if(path)javaPath=path;}catch(e){error=String(e);}finally{picking=false;}
  }
  async function check(){
    const path=javaPath;checking=true;error='';report='';
    try{const result=await api.inspectJava(path);if(javaPath===path)report=result;}catch(e){if(javaPath===path)error=String(e);}finally{checking=false;}
  }
</script>

<label class="runtime-memory">{$t("Memory (MB)")}<input type="number" min="512" max="65536" step="512" bind:value={memory} required {disabled}/></label>
<div class="runtime-java">
  <label>{$t("Java executable")}<input placeholder={$t("Automatic")} bind:value={javaPath} disabled={disabled || picking}/></label>
  <Button disabled={disabled || !native || picking || checking} onclick={choose}>{$t("Browse")}</Button>
  <Button disabled={disabled || !native || !javaPath.trim() || checking || picking} onclick={check}>{$t(checking?'Checking…':'Check')}</Button>
</div>
{#if report}<pre class="java-report" role="status">{report}</pre>{/if}
{#if error}<p class="inline-error" role="alert">{$t(error)}</p>{/if}
