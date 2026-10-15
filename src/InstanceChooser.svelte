<script lang="ts">
  import Icon from './Icon.svelte';
  import CardGrid from './CardGrid.svelte';
  import {showDialog} from './dialog';
  import {t} from './i18n';
  import {loaderLabel,type Instance} from './types';
  import Card from './Card.svelte';
  import Button from './Button.svelte';
  let {instances,icons={},onchoose,onclose}:{instances:Instance[];icons?:Record<string,string>;onchoose:(id:string)=>void;onclose:()=>void}=$props();
</script>
<dialog class="modal instance-chooser" use:showDialog aria-label={$t('Choose instance')} oncancel={event=>{event.preventDefault();onclose();}}>
  <div class="section-heading"><h2>{$t('Choose instance')}</h2><Button class="dialog-close" aria-label={$t('Close')} onclick={onclose}><Icon name="close" size={18}/></Button></div>
  <CardGrid class="instance-choices">{#each instances as instance (instance.id)}<Card title={instance.name} icon={icons[instance.id]} instanceId={instance.id} onclick={()=>onchoose(instance.id)}><span class="catalog-author">{instance.version} · {loaderLabel(instance.loader)}</span></Card>{/each}</CardGrid>
</dialog>
<style>
  .instance-chooser{max-width:min(90vw,80rem);max-height:calc(100dvh - 2.85714286rem)}
  @media(max-width:37.5em){.instance-chooser{padding:1.42857143rem}}
</style>
