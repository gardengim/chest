<script lang="ts">
  import { locale } from './preferences';
  import { newsDate } from './format';
  import { t } from './i18n';
  import { tick } from 'svelte';
  import { showDialog } from './dialog';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import { loadNews, loadInstanceUpdates } from './news';
  import { api, native } from './api';
  import type { NewsArticle, Instance } from './types';
  let {limit=3,paginated=false,instances=[]}:{limit?:number;paginated?:boolean;instances?:Instance[]}=$props();
  let official=$state<NewsArticle[]>([]), updates=$state<NewsArticle[]>([]), loading=$state(true), error=$state(''), feedError=$state(false), updatesLoading=$state(false), unavailable=$state<string[]>([]);
  const articles=$derived([...updates,...official].sort((a,b)=>Number(!!b.instance_id)-Number(!!a.instance_id) || b.date.localeCompare(a.date)));
  const instanceKey=$derived(JSON.stringify(instances.filter(i=>i.installed).map(({id,name,version,loader,loader_version,installed})=>({id,name,version,loader,loader_version,installed}))));
  let retry=$state(0), expanded=$state(false), page=$state(0);
  const pages=$derived(Math.max(1,Math.ceil(articles.length/limit)));
  function source(article:NewsArticle){if(article.source)return article.source;try{return new URL(article.url).hostname.replace(/^www\./,'');}catch{return '';}}
  let trigger:HTMLButtonElement|undefined;
  async function closeNews(){expanded=false;await tick();trigger?.focus();}
  function openArticle(article:NewsArticle){error='';void api.openNews(article.url).catch(()=>error='Could not open article');}
  $effect(()=>{
    let alive=true;loading=true;feedError=false;
    void loadNews(retry>0).then(items=>{if(alive){official=items;page=0;}}).catch(()=>{if(alive)feedError=true;}).finally(()=>{if(alive)loading=false;});
    return()=>{alive=false;};
  });
  $effect(()=>{
    const selected=JSON.parse(instanceKey) as Instance[], force=retry>0;
    let alive=true;updates=[];unavailable=[];updatesLoading=selected.length>0;
    void loadInstanceUpdates(selected,force).then(result=>{if(alive){updates=result.articles;unavailable=result.unavailable;}}).finally(()=>{if(alive)updatesLoading=false;});
    return()=>{alive=false;};
  });
  $effect(()=>{if(page>=pages)page=pages-1;});
</script>
<section class="news-section" aria-label={$t("News")}>
  <h2>{$t("News")}</h2>
  <div class="panel news-panel">
  {#if error}<p role="alert">{$t(error)}</p>{/if}
  {#if feedError}<p role="status">{$t('News unavailable')}</p><Button onclick={()=>retry++}>{$t('Retry')}</Button>{/if}
  {#if unavailable.length}<p role="status">{$t('Updates unavailable for {names}',{names:unavailable.join(', ')})}</p><Button onclick={()=>retry++}>{$t('Retry')}</Button>{/if}
  {#if (loading || updatesLoading) && !articles.length}<p role="status">{$t('Loading…')}</p>
  {:else if !articles.length && !feedError && !unavailable.length}<p class="muted">{$t(native?'No news':'News available in the desktop app')}</p>
  {/if}
  {#if articles.length}
    {@render articleList(articles.slice(paginated?page*limit:0,paginated?(page+1)*limit:limit))}
  {/if}
  </div>
  {#if paginated}
    <nav class="news-footer news-pagination" aria-label={$t('News pages')}>
      <Button disabled={page===0} onclick={()=>page--}>{$t('Previous')}</Button>
      <span role="status" aria-live="polite" aria-label={$t('Page {page} of {pages}',{page:page+1,pages})}>{page+1} / {pages}</span>
      <Button disabled={page>=pages-1} onclick={()=>page++}>{$t('Next')}</Button>
    </nav>
  {:else}
  <div class="news-footer"><Button disabled={!articles.length} onclick={event=>{trigger=event.currentTarget;expanded=true;}}>{$t("More")}</Button></div>
  {/if}
</section>

{#snippet articleList(items:NewsArticle[])}
  {#each items as article}
    <Button shape="plain" class="news-item" onclick={()=>openArticle(article)}><span>{article.instance_id?`${instances.find(i=>i.id===article.instance_id)?.name || ''} · ${article.title}`:article.title}<small><span class="news-source">{source(article)}</span>{article.instance_id?' · '+$t('Update available'):''}{article.date?' · '+newsDate(article.date,$locale):''}</small></span><Icon name="arrow" size={16}/></Button>
  {/each}
{/snippet}
{#if expanded}
  <dialog class="modal news-dialog" aria-label={$t("News")} use:showDialog oncancel={event=>{event.preventDefault();void closeNews();}}>
    <div class="section-heading"><h2>{$t("News")}</h2><Button class="dialog-close" aria-label={$t("Close news")} onclick={closeNews}><Icon name="close" size={18}/></Button></div>
    {#if error}<p role="alert">{$t(error)}</p>{/if}
    {@render articleList(articles)}
  </dialog>
{/if}
