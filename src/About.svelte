<script lang="ts">
  import Button from './Button.svelte';
  import Toolbar from './Toolbar.svelte';
  import licenseTexts from './license-texts.json';
  import {onMount} from 'svelte';
  import {t} from './i18n';
  import {api,native} from './api';
  let {info}:{info:{version:string;platform:string;architecture:string}|null}=$props();
  let licenses=$state<{chest:string;texts:string[];notices:{name:string;version:string;ecosystem:string;license:string;texts:number[]}[]}|null>(null);
  let error=$state(''),query=$state('');
  let linkError=$state('');
  let opened=$state<Record<string,boolean>>({});
  onMount(()=>{const controller=new AbortController();void fetch('/licenses.json',{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('Could not load licenses');return response.json();}).then(data=>licenses=data).catch(e=>{if(!controller.signal.aborted)error=String(e);});return()=>controller.abort();});
  async function link(key:string){if(!native){window.open(`https://github.com/gardengim/chest${key==='github'?'':'/'+key}`,'_blank','noopener,noreferrer');return;}linkError='';try{await api.projectLink(key);}catch(e){linkError=String(e);}}
  const standardTexts=(license:string)=>Object.entries(licenseTexts).filter(([id])=>license.split(/[^A-Za-z0-9.-]+/).includes(id));
  const visible=$derived(licenses?.notices.filter(n=>`${n.name} ${n.license}`.toLowerCase().includes(query.toLowerCase())) || []);
</script>
<section class="panel">
  <h2>Chest {info?.version || '0.1.0'}</h2>
  {#if info}<p class="muted">{info.platform} · {info.architecture}</p>{/if}
  <nav class="form-actions" aria-label={$t('Project links')}>
    {#each [{key:'github',name:'GitHub',path:''},{key:'issues',name:'Issues',path:'/issues'},{key:'releases',name:'Releases',path:'/releases'}] as item}<Button onclick={()=>link(item.key)}>{$t(item.name)}</Button>{/each}
  </nav>
  {#if linkError}<p class="inline-error" role="alert">{linkError}</p>{/if}
  <p class="hint">{$t('Minecraft artwork © Mojang AB / Microsoft. Chest is an independent launcher.')}</p>
  <h2>{$t('License')}</h2>
  {#if licenses}<pre class="license-text">{licenses.chest}</pre>{:else if error}<p class="inline-error" role="alert">{error}</p>{/if}
</section>
<section class="panel">
  <h2>{$t('Third-party licenses')}</h2>
  <Toolbar searchLabel={$t('Search')} bind:value={query}/>
  {#each visible as notice (`${notice.ecosystem}:${notice.name}:${notice.version}`)}
    <details ontoggle={event=>opened[`${notice.ecosystem}:${notice.name}:${notice.version}`]=event.currentTarget.open}><summary>{notice.name} {notice.version} · {notice.license} <small>({notice.ecosystem})</small></summary>
      {#if opened[`${notice.ecosystem}:${notice.name}:${notice.version}`]}
      {#each notice.texts as index}<pre class="license-text">{licenses?.texts[index]}</pre>{/each}
      {#if !notice.texts.length}<p class="hint">{$t('Standard license text. Package-specific notices were not included in this distribution.')}</p>{#each standardTexts(notice.license) as [id,license]}<h3>{id}</h3><pre class="license-text">{license.text}</pre>{/each}{/if}
      {/if}
    </details>
  {/each}
</section>
<style>.license-text{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:.85rem;user-select:text}details{padding:.6rem 0;border-bottom:var(--divider) solid var(--frame)}summary{cursor:pointer}</style>
