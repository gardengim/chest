<script lang="ts">
  import Message from './Message.svelte';
  import {showDialog} from './dialog';
  import {t} from './i18n';
  import Button from './Button.svelte';
  let {name,onrename,onclose}:{name:string;onrename:(name:string)=>Promise<unknown>;onclose:()=>void}=$props();
  let value=$state(''),pending=$state(false),error=$state('');
  $effect(()=>{value=name;});
  async function save(){pending=true;error='';try{await onrename(value);onclose();}catch(reason){error=String(reason);}finally{pending=false;}}
</script>
<dialog class="modal" use:showDialog aria-label={$t('Rename')} oncancel={event=>{event.preventDefault();if(!pending)onclose();}}>
  <h2>{$t('Rename')}</h2><form onsubmit={event=>{event.preventDefault();void save();}}><label>{$t('Name')}<input bind:value={value} required maxlength={120} disabled={pending}/></label>
  {#if error}<Message tone="error" text={error}/>{/if}
  <div class="form-actions"><Button disabled={pending} onclick={onclose}>{$t('Cancel')}</Button><Button type="submit" tone="accent" disabled={pending || !value.trim()}>{$t('Save')}</Button></div></form>
</dialog>
