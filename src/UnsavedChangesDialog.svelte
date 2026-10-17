<script lang="ts">
  import Message from './Message.svelte';
  import Button from './Button.svelte';
  import {showDialog} from './dialog';
  import {t} from './i18n';
  let {title,description,error='',pending=false,lockCancel=false,oncancel=()=>{},ondiscard,onsave}: {
    title:string;description?:string;error?:string;pending?:boolean;lockCancel?:boolean;
    oncancel:()=>void;ondiscard:()=>void;onsave?:()=>void;
  }=$props();
  const id=$props.id();
</script>
<dialog class="modal" aria-labelledby={id} use:showDialog oncancel={event=>{event.preventDefault();if(!lockCancel || !pending)oncancel();}}>
  <h2 {id}>{$t(title)}</h2>
  {#if description}<p>{$t(description)}</p>{/if}
  {#if error}<Message tone="error" text={$t(error)}/>{/if}
  <div class="form-actions">
    <Button disabled={lockCancel && pending} onclick={oncancel}>{$t('Cancel')}</Button>
    <Button tone="danger" disabled={pending} onclick={ondiscard}>{$t('Discard')}</Button>
    {#if onsave}<Button tone="accent" disabled={pending} onclick={onsave}>{$t(pending?'Saving…':'Save')}</Button>{/if}
  </div>
</dialog>
