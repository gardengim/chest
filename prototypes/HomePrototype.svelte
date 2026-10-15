<script lang="ts">
  import {tick} from 'svelte';
  import Button from '../src/Button.svelte';
  import Card from '../src/Card.svelte';
  import Tabs from '../src/Tabs.svelte';
  import LayoutSwitch from '../src/LayoutSwitch.svelte';
  import SectionIcon from './SectionIcon.svelte';
  import HomeDock from './HomeDock.svelte';
  import Icon from '../src/Icon.svelte';
  import Select from '../src/Select.svelte';
  import {showDialog} from '../src/dialog';
  const categories=['Instances','News','Worlds','Servers','Explore'] as const;
  type Shelf=typeof categories[number];
  const defaults:Shelf[]=['Instances','News','Explore'];
  let shelves=$state<Shelf[]>([...defaults]),customizing=$state(false);
  let exploreKind=$state('Mods'),exploreQuery=$state(''),exploreLayout=$state<'gallery'|'list'>('gallery'),newsPage=$state(0);
  const exploreKinds=['Mods','Resource packs','Shaders','Modpacks'];
  const projects:Record<string,string[]>={'Mods':['Sodium','Fresh Animations','Create'],'Resource packs':['Faithful','Fresh Animations','Stay True'],'Shaders':['Complementary Shaders','Bliss','BSL'],'Modpacks':['Create Adventure','Fabulously Optimized','Simply Optimized']};
  const exploreResults=$derived(projects[exploreKind].filter(name=>name.toLowerCase().includes(exploreQuery.toLowerCase())));
  let active=$state<Shelf>('Instances'),home:HTMLElement;
  let message=$state(''),dialog=$state<{title:string;kind:string;name:string}|null>(null),target=$state('Fabric 1.21.4');
  const instances=[{name:'Vanilla 26.3',version:'26.3 · Vanilla',status:'Ready to launch'},{name:'Fabric 1.21.4',version:'1.21.4 · Fabric',status:'Ready to launch'},{name:'Create Adventure',version:'1.20.1 · Forge',status:'Ready to launch'},{name:'Skyblock',version:'1.21.4 · Fabric',status:'Ready to launch'},{name:'Classic survival',version:'1.20.1 · Vanilla',status:'Ready to launch'}];
  const worlds=[{name:'Survival',instance:'Vanilla 26.3',version:'26.3',detail:'Last played today'},{name:'Mountain base',instance:'Fabric 1.21.4',version:'1.21.4',detail:'Last played yesterday'},{name:'Workshop',instance:'Create Adventure',version:'1.20.1',detail:'Last played 3 days ago'},{name:'Sky islands',instance:'Skyblock',version:'1.21.4',detail:'Last played last week'}];
  const servers=[{name:'Friends',address:'friends.example:25565',instance:'Fabric 1.21.4',version:'1.21.4 · Fabric'},{name:'Local server',address:'localhost:25565',instance:'Create Adventure',version:'1.20.1 · Forge'},{name:'Survival server',address:'survival.example',instance:'Vanilla 26.3',version:'26.3 · Vanilla'}];
  const news=[{title:'Minecraft Java Edition — latest release',source:'Minecraft',date:'Today'},{title:'Fabric Loader update available',source:'Fabric',date:'Fabric 1.21.4'},{title:'Create Adventure — modpack update',source:'Modrinth',date:'Yesterday'},{title:'Minecraft Live recap',source:'Minecraft',date:'Last week'},{title:'New on Java Realms',source:'Minecraft',date:'Last week'},{title:'Modrinth community updates',source:'Modrinth',date:'Last week'},{title:'Loader release notes',source:'Fabric',date:'Last month'}];
  const available=$derived(categories.filter(item=>!shelves.includes(item)));
  function move(shelf:Shelf,direction:number){const order=[...shelves],index=order.indexOf(shelf);[order[index],order[index+direction]]=[order[index+direction],order[index]];shelves=order;}
  function remove(shelf:Shelf){shelves=shelves.filter(item=>item!==shelf);}
  function add(shelf:Shelf){shelves=[...shelves,shelf];}
  let jumpTarget:Shelf|null=null;
  function jump(shelf:Shelf){active=shelf;jumpTarget=shelf;home.querySelector<HTMLElement>(`[data-shelf="${shelf}"]`)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  function scrollActivity(node:HTMLElement){let timer:ReturnType<typeof setTimeout>;function show(){node.dataset.scrolling='true';clearTimeout(timer);timer=setTimeout(()=>delete node.dataset.scrolling,850);}node.addEventListener('scroll',show,{passive:true});return {destroy(){clearTimeout(timer);node.removeEventListener('scroll',show);}};}
  function observeHome(node:HTMLElement){
    home=node;
    function update(){const top=node.getBoundingClientRect().top+28;let current=shelves[0];for(const section of node.querySelectorAll<HTMLElement>('[data-shelf]')){if(section.getBoundingClientRect().top<=top)current=section.dataset.shelf as Shelf;}if(node.scrollTop+node.clientHeight>=node.scrollHeight-4)current=shelves.at(-1);if(current && !jumpTarget)active=current;}
    function releaseJump(){jumpTarget=null;update();}
    const observer=new ResizeObserver(update);observer.observe(node);if(node.firstElementChild)observer.observe(node.firstElementChild);node.addEventListener('scroll',update,{passive:true});node.addEventListener('scrollend',releaseJump);for(const event of ['wheel','touchstart','keydown'])node.addEventListener(event,releaseJump,{passive:true});update();
    return {destroy(){observer.disconnect();node.removeEventListener('scroll',update);node.removeEventListener('scrollend',releaseJump);for(const event of ['wheel','touchstart','keydown'])node.removeEventListener(event,releaseJump);}};
  }
  function trackRow(node:HTMLElement){
    function update(){const start=node.scrollLeft<=5,end=node.scrollLeft+node.clientWidth>=node.scrollWidth-5;node.dataset.start=String(start);node.dataset.end=String(end);const previous=node.parentElement?.querySelector<HTMLButtonElement>('.shelf-previous'),next=node.parentElement?.querySelector<HTMLButtonElement>('.shelf-next');if(previous)previous.disabled=start;if(next)next.disabled=end;}
    const observer=new ResizeObserver(update);observer.observe(node);node.addEventListener('scroll',update,{passive:true});void tick().then(update);return {update(){void tick().then(update);},destroy(){observer.disconnect();node.removeEventListener('scroll',update);}};
  }
  function slide(shelf:Shelf,direction:number){const row=home.querySelector<HTMLElement>(`[data-shelf="${shelf}"] .shelf-row`);row?.scrollBy({left:direction*row.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  let customizeTrigger:HTMLButtonElement|undefined;
  function openCustomization(event:MouseEvent){customizeTrigger=event.currentTarget as HTMLButtonElement;customizing=true;}
  async function closeCustomization(){customizing=false;await tick();customizeTrigger?.focus();}
  function preview(kind:string,name:string){dialog={title:kind==='copy'?'Copy world':kind==='add'?'Add to instance':name,kind,name};}
</script>
<a class="skip-link" href="#prototype-main">Skip to content</a>
<div class="app">
  <aside class="rail" aria-label="Main navigation">
    <Button shape="rail" selected class="rail-button chest" aria-label="Chest home" title="Home" onclick={()=>home.scrollTo({top:0,behavior:'smooth'})}><Icon name="chest" size={44}/></Button>
    <div class="instance-rail">
      {#each instances.slice(0,3) as instance}<Button shape="rail" class="instance-icon" aria-label={instance.name} title={instance.name} onclick={()=>preview('instance',instance.name)}><img class="artwork" src="/minecraft.png" alt=""/></Button>{/each}
      <Button shape="rail" class="add" aria-label="Create instance" title="Create instance" onclick={()=>preview('new','New instance')}><Icon name="plus" size={24}/></Button>
    </div>
    <Button shape="rail" class="rail-button profile" aria-label="Settings" title="Settings" onclick={()=>preview('settings','Settings')}><Icon name="user" size={32}/></Button>
  </aside>
  <main id="prototype-main" tabindex="-1" use:observeHome use:scrollActivity><div class="page prototype-page">
    <div class="section-heading home-title"><div class="title-line"><h1>Home</h1><span class="prototype-label">Prototype</span></div></div>
    {#if message}<div class="prototype-notice" role="status">{message}<Button shape="plain" aria-label="Dismiss" onclick={()=>message=''}><Icon name="close" size={15}/></Button></div>{/if}
    {#each shelves as shelf (shelf)}
      <section class="shelf" data-shelf={shelf} id={`shelf-${shelf}`} aria-labelledby={`heading-${shelf}`}>
        <div class="shelf-heading"><h2 id={`heading-${shelf}`}><SectionIcon section={shelf} size={22}/>{shelf}</h2>
          <div class="shelf-controls">
              {#if shelf!=='News' && shelf!=='Explore'}<Button shape="plain" onclick={()=>preview('collection',shelf)}>View all</Button>
              <Button class="shelf-previous" aria-label={`Previous ${shelf.toLowerCase()}`} onclick={()=>slide(shelf,-1)}>‹</Button>
              <Button class="shelf-next" aria-label={`Next ${shelf.toLowerCase()}`} onclick={()=>slide(shelf,1)}>›</Button>{/if}
          </div>
        </div>
        {#if shelf==='News'}
          <div class="panel news-panel">
            {#each news.slice(newsPage*5,(newsPage+1)*5) as article}<Button shape="plain" class="news-item" onclick={()=>preview('news',article.title)}><span>{article.title}<small><span class="news-source">{article.source}</span> · {article.date}</small></span><Icon name="arrow" size={16}/></Button>{/each}
          </div>
          <nav class="news-footer news-pagination" aria-label="News pages"><Button disabled={newsPage===0} onclick={()=>newsPage--}>Previous</Button><span>{newsPage+1} / 2</span><Button disabled={newsPage===1} onclick={()=>newsPage++}>Next</Button></nav>
        {:else if shelf==='Explore'}
          <Tabs options={exploreKinds} value={exploreKind} prefix="prototype-explore" label="Content types" onchange={value=>{exploreKind=value;exploreQuery='';}}/>
          <div class="catalog-tab-panel" id={`prototype-explore-panel-${encodeURIComponent(exploreKind)}`} role="tabpanel" aria-labelledby={`prototype-explore-tab-${encodeURIComponent(exploreKind)}`}>
            <div class="catalog-controls panel"><div class="catalog-search-row"><label class="search"><Icon name="search" size={18}/><input aria-label="Search projects" placeholder={`Search ${exploreKind.toLowerCase()}…`} bind:value={exploreQuery}/></label><span class="source-badge">Modrinth</span></div></div>
            <div class="section-heading catalog-heading"><h3>{exploreKind} <span class="count">{exploreResults.length}</span></h3><LayoutSwitch label="Project layout" bind:value={exploreLayout}/></div>
            <div class="catalog-grid" class:catalog-list={exploreLayout==='list'}>{#each exploreResults as title}<Card {title} layout={exploreLayout} badge={exploreKind} onclick={()=>preview('explore',title)}><span class="catalog-author">Modrinth</span><p>Community content</p></Card>{/each}</div>
            {#if !exploreResults.length}<p>No results</p>{/if}
            <div class="catalog-pagination"><Button disabled>Previous</Button><span>1–{exploreResults.length}</span><Button disabled>Next</Button></div>
          </div>
        {:else}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable shelves need keyboard focus.) -->
        <div class="shelf-row" use:trackRow use:scrollActivity tabindex="0" role="region" aria-label={`${shelf} cards`}>
          {#if shelf==='Instances'}
            {#each instances as instance}<Card title={instance.name} icon="/minecraft.png" onclick={()=>preview('instance',instance.name)}><span class="catalog-author">{instance.version}</span><p>{instance.status}</p></Card>{/each}
          {:else if shelf==='Worlds'}
            {#each worlds as world}<Card title={world.name} interactive={false}><span class="catalog-author">{world.instance} · {world.version}</span><p>{world.detail}</p>{#snippet actions()}<Button onclick={()=>preview('instance',world.instance)}>Open</Button><Button onclick={()=>message=`Backup destination would open for ${world.name}.`}>Back up</Button><Button onclick={()=>preview('copy',world.name)}>Copy</Button>{/snippet}</Card>{/each}
          {:else if shelf==='Servers'}
            {#each servers as server}<Card title={server.name} interactive={false}><span class="catalog-author">{server.address}</span><p>{server.instance}<br/>{server.version}</p>{#snippet actions()}<Button onclick={()=>preview('instance',server.instance)}>Open</Button><Button onclick={()=>preview('add',server.name)}>Add</Button><Button onclick={()=>preview('bookmark',server.name)}>Edit</Button>{/snippet}</Card>{/each}
          {/if}
        </div>
        {/if}
      </section>
    {/each}
    {#if !shelves.length}<p>No shelves</p>{/if}
  </div>
    <HomeDock sections={shelves} {active} onselect={section=>jump(section as Shelf)} oncustomize={openCustomization}/>
  </main>
</div>
{#if customizing}
  <dialog class="modal customization-dialog" use:showDialog aria-label="Customize home" oncancel={event=>{event.preventDefault();void closeCustomization();}}>
    <div class="section-heading"><h2>Customize home</h2><Button class="dialog-close" aria-label="Close" onclick={closeCustomization}><Icon name="close"/></Button></div>
    <ol class="customization-list">
      {#each shelves as shelf,index (shelf)}
        <li><span class="shelf-name"><SectionIcon section={shelf} size={24}/>{shelf}</span><div class="customization-actions"><Button aria-label={`Move ${shelf} up`} disabled={index===0} onclick={()=>move(shelf,-1)}>↑</Button><Button aria-label={`Move ${shelf} down`} disabled={index===shelves.length-1} onclick={()=>move(shelf,1)}>↓</Button><Button tone="danger" aria-label={`Remove ${shelf} shelf`} onclick={()=>remove(shelf)}>Remove</Button></div></li>
      {/each}
    </ol>
    {#if available.length}<h3>Add shelf</h3><div class="shelf-picker" role="group" aria-label="Add shelf">{#each available as shelf}<Button onclick={()=>add(shelf)}><SectionIcon section={shelf} size={20}/>{shelf}</Button>{/each}</div>{/if}
    <div class="form-actions"><Button onclick={()=>shelves=[...defaults]}>Reset layout</Button><Button tone="accent" onclick={closeCustomization}>Done</Button></div>
  </dialog>
{/if}
{#if dialog}<dialog class="modal" use:showDialog aria-label={dialog.title} oncancel={event=>{event.preventDefault();dialog=null;}}>
  <div class="section-heading"><h2>{dialog.title}</h2><Button class="dialog-close" aria-label="Close" onclick={()=>dialog=null}><Icon name="close"/></Button></div>
  {#if dialog.kind==='copy' || dialog.kind==='add'}
    <p>{dialog.name}</p><label>Target instance<Select bind:value={target}>{#each instances as instance}<option value={instance.name}>{instance.name} · {instance.version}</option>{/each}</Select></label>
    {#if dialog.kind==='copy'}<p class="hint">The original world is preserved. Compatibility is checked before copying.</p>{/if}
    <div class="form-actions"><Button onclick={()=>dialog=null}>Cancel</Button><Button tone="accent" onclick={()=>{message=`${dialog!.name} → ${target} selected.`;dialog=null;}}>{dialog.kind==='copy'?'Copy':'Add'}</Button></div>
  {:else if dialog.kind==='bookmark'}
    <label>Name<input value={dialog.name==='Server bookmark'?'':dialog.name}/></label><label>Address<input placeholder="example.com:25565"/></label><div class="form-actions"><Button onclick={()=>dialog=null}>Cancel</Button><Button tone="accent" onclick={()=>{message='Bookmark preview saved.';dialog=null;}}>Save</Button></div>
  {:else}<p class="hint">Navigation preview: {dialog.name}</p><div class="form-actions"><Button onclick={()=>dialog=null}>Close</Button></div>{/if}
</dialog>{/if}
<style>
.home-title{margin-bottom:18px}.home-title h1{margin:0}.title-line{display:flex;align-items:center;gap:16px}.prototype-label{font-size:11px;color:#aaaeb0;border:var(--divider) solid var(--edge);padding:5px 8px}
.prototype-page{padding-bottom:140px}
.shelf{margin-bottom:30px;scroll-margin-top:24px;min-width:0}.shelf-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.shelf-heading h2{margin:0;display:flex;align-items:center;gap:10px}.shelf-controls{display:flex;gap:8px;align-items:center}.shelf-controls :global(.shelf-previous),.shelf-controls :global(.shelf-next){font-size:24px;padding:0 12px;min-width:38px}
.shelf:has(.shelf-row:global([data-start='true'])) :global(.shelf-previous),.shelf:has(.shelf-row:global([data-end='true'])) :global(.shelf-next){opacity:.35;pointer-events:none}
.shelf-row{display:grid;grid-auto-flow:column;grid-auto-columns:268px;gap:16px;overflow-x:auto;scroll-snap-type:x proximity;overscroll-behavior-x:contain;padding:2px 3px 12px;scrollbar-width:thin;scrollbar-color:transparent transparent}.shelf-row :global(.launcher-card){width:100%;min-width:0;min-height:275px;scroll-snap-align:start}.shelf-row:focus-visible{outline:var(--stroke) solid var(--focus-ring);outline-offset:3px}
.customization-dialog{width:min(600px,calc(100vw - 40px))}.customization-list{list-style:none;margin:0;padding:0}.customization-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0}.customization-list li+li{border-top:var(--divider) solid var(--edge)}.shelf-name{display:flex;align-items:center;gap:10px}.customization-actions{display:flex;gap:6px}.shelf-picker{display:flex;flex-wrap:wrap;gap:12px;padding:18px;border:var(--stroke) solid var(--frame);background:var(--surface);box-shadow:var(--bevel-raised)}
.prototype-notice{display:flex;align-items:center;justify-content:space-between;background:#3c4935;border:var(--divider) solid #707b67;padding:8px 12px;margin-bottom:16px}
@media(max-width:600px){.shelf-row{grid-auto-columns:240px}.prototype-label{display:none}.shelf-controls{gap:4px}.shelf-controls :global(.ui-button){padding-inline:8px}}
/* Local prototype scrollbars: square thumb with the same shared bevel as controls. */
main{scrollbar-width:thin;scrollbar-color:transparent transparent}main:hover,main:focus-within,main:global([data-scrolling='true']),.shelf-row:hover,.shelf-row:focus-within,.shelf-row:global([data-scrolling='true']){scrollbar-color:var(--scroll-thumb) transparent}
@supports selector(::-webkit-scrollbar){
main,main:hover,main:focus-within,main:global([data-scrolling='true']),.shelf-row,.shelf-row:hover,.shelf-row:focus-within,.shelf-row:global([data-scrolling='true']){scrollbar-width:auto;scrollbar-color:auto}main::-webkit-scrollbar{display:block;width:12px}.shelf-row::-webkit-scrollbar{height:10px}
main::-webkit-scrollbar-track,.shelf-row::-webkit-scrollbar-track,main::-webkit-scrollbar-corner{background:transparent}
main::-webkit-scrollbar-thumb,.shelf-row::-webkit-scrollbar-thumb{background:transparent;border:var(--stroke) solid transparent;border-radius:0;box-shadow:none}
main:hover::-webkit-scrollbar-thumb,main:focus-within::-webkit-scrollbar-thumb,main:global([data-scrolling='true'])::-webkit-scrollbar-thumb,.shelf-row:hover::-webkit-scrollbar-thumb,.shelf-row:focus-within::-webkit-scrollbar-thumb,.shelf-row:global([data-scrolling='true'])::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-color:var(--frame);box-shadow:var(--bevel-raised)}
}
@media(forced-colors:active){main,.shelf-row{scrollbar-color:auto}}
</style>
