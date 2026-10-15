<script lang="ts">
  import Icon from './Icon.svelte';
  import { t } from './i18n';
  import { tick, type Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import Button from './Button.svelte';

  let { children, optionContent, leading, value=$bindable(''), disabled=false, onchange, ...attributes }:
    Omit<HTMLSelectAttributes,'value'|'children'|'onchange'> & {
      children?:Snippet; optionContent?:Snippet<[string,string]>; leading?:Snippet<[string]>; value?:string; onchange?:(event:Event & {currentTarget:HTMLSelectElement})=>void;
    }=$props();
  const uid=$props.id();
  let control:HTMLSelectElement;
  let menu:HTMLDivElement;
  let anchorBox:DOMRect|undefined;
  let open=$state(false),active=$state(0),label=$state('');
  let options=$state<{value:string;label:string;disabled:boolean}[]>([]);
  let search='',searchedAt=0;

  $effect(()=>{
    const translate=$t;
    // Read the rendered label after language changes, excluding options and hints.
    void tick().then(()=>{
      if(!control)return;
      const nativeLabel=control.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
      nativeLabel?.querySelectorAll('select,[popover],.hint').forEach(node=>node.remove());
      label=nativeLabel?.textContent?.trim() || translate('Choose an option');
    });
  });
  function close(){menu?.hidePopover();open=false;}
  function position(){
    const box=control.getBoundingClientRect();anchorBox=box;
    const width=Math.min(box.width,innerWidth-16);
    menu.style.width=width+'px';
    const below=window.innerHeight-box.bottom-8,above=box.top-8;
    const limit=20*parseFloat(getComputedStyle(document.documentElement).fontSize);
    const upwards=below<Math.min(limit,menu.scrollHeight) && above>below;
    const height=Math.max(0,Math.min(limit,upwards?above:below));
    const top=upwards?Math.max(8,box.top-Math.min(height,menu.scrollHeight)-4):box.bottom+4;
    menu.style.cssText='left:'+Math.max(8,Math.min(box.left,innerWidth-width-8))+'px;top:'+top+'px;width:'+width+'px;max-height:'+height+'px;';
  }
  async function show(){
    if(disabled)return;
    options=Array.from(control.options,option=>({value:option.value,label:option.label,disabled:option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)}));
    active=Math.max(0,control.selectedIndex);
    control.focus();open=true;
    await tick();
    if(!open)return;
    menu.showPopover();position();reveal();
  }
  function reveal(){void tick().then(()=>menu?.children[active]?.scrollIntoView({block:'nearest'}));}
  function choose(index:number){
    if(!options[index] || options[index].disabled)return;
    control.value=options[index].value;
    // Preserve native binding, form validation, and callers' change handlers.
    control.dispatchEvent(new Event('change',{bubbles:true}));
    close();control.focus();
  }
  function change(event:Event & {currentTarget:HTMLSelectElement}){
    value=control.value;onchange?.(event);
  }
  function move(direction:number){
    for(let i=1;i<=options.length;i++){
      const next=(active+direction*i+options.length)%options.length;
      if(!options[next].disabled){active=next;reveal();break;}
    }
  }
  async function keys(event:KeyboardEvent){
    if(event.key==='Tab'){close();return;}
    if(event.key==='Escape'){if(open){event.preventDefault();event.stopPropagation();close();}return;}
    if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){
      event.preventDefault();
      if(!open){await show();return;}
      if(event.key==='Enter' || event.key===' '){choose(active);return;}
      if(event.key==='Home'){active=options.length-1;move(1);}
      else if(event.key==='End'){active=0;move(-1);}
      else move(event.key==='ArrowDown'?1:-1);
    }else if(event.key.length===1 && !event.ctrlKey && !event.metaKey && !event.altKey){
      event.preventDefault();
      if(!open)await show();
      const now=Date.now();search=now-searchedAt>700?event.key:search+event.key;searchedAt=now;
      const found=options.findIndex(option=>!option.disabled && option.label.toLowerCase().startsWith(search.toLowerCase()));
      if(found>=0){active=found;reveal();}
    }
  }
  $effect(()=>{
    if(disabled)close();
  });
  $effect(()=>{
    if(!open)return;
    const resize=()=>close();
    const scroll=(event:Event)=>{
      if(event.target instanceof Node && menu.contains(event.target))return;
      const box=control.getBoundingClientRect();
      if(anchorBox && (Math.abs(box.top-anchorBox.top)>1 || Math.abs(box.left-anchorBox.left)>1))close();
    };
    window.addEventListener('resize',resize);
    window.addEventListener('scroll',scroll,true);
    return()=>{window.removeEventListener('resize',resize);window.removeEventListener('scroll',scroll,true);};
  });
</script>

<div class="select-shell" class:with-leading={!!leading}>
{#if leading}<span class="select-leading" aria-hidden="true">{@render leading(value)}</span>{/if}
<select {...attributes} bind:this={control} bind:value {disabled} class={['inventory-select',attributes.class]}
  aria-label={attributes['aria-label'] || label || undefined} aria-expanded={open} aria-controls={uid}
  aria-activedescendant={open?uid+'-option-'+active:undefined}
  onpointerdown={event=>{if(event.button===0){event.preventDefault();control.focus();}}}
  onclick={event=>{event.preventDefault();if(open)close();else void show();}}
  onmousedown={event=>event.preventDefault()} onkeydown={keys} onchange={change}>
  {@render children?.()}
</select>
<div bind:this={menu} id={uid} class="inventory-dropdown" popover="auto" role="listbox" tabindex="-1" aria-label={$t("Available choices")}
  ontoggle={event=>{if(event.newState==='closed')open=false;}}>
  {#each options as option,i}
    <Button shape="plain" role="option" id={uid+'-option-'+i} aria-selected={value===option.value}
      class={['dropdown-option',active===i && 'highlighted']} tabindex={-1} disabled={option.disabled}
      onpointermove={()=>active=i} onmousedown={event=>event.preventDefault()} onclick={()=>choose(i)}>
      <span>{#if optionContent}{@render optionContent(option.value,option.label)}{:else}{option.label}{/if}</span><span aria-hidden="true">{#if value===option.value}<Icon name="check" size={16}/>{/if}</span>
    </Button>
  {/each}
</div>

</div>
<style>.select-shell{display:block;position:relative;min-width:0;flex:1;margin:0}.with-leading{container-type:inline-size}.select-shell select{width:100%;margin:0}:global(label)>.select-shell{margin-top:.57142857rem}.with-leading select{padding-left:clamp(1.75rem,25cqi,2.85714286rem)}.select-leading{position:absolute;z-index:1;left:clamp(.25rem,5cqi,.85714286rem);top:50%;translate:0 -50%;display:flex;pointer-events:none}.select-shell::after{color:var(--control-icon);content:'';position:absolute;top:50%;right:clamp(.25rem,5cqi,.85714286rem);translate:0 -50%;width:.85714286rem;height:.85714286rem;background:currentColor;mask:var(--direction-mask) center/contain no-repeat;rotate:180deg;pointer-events:none}.select-shell:has(select:disabled)::after{opacity:.5}</style>
