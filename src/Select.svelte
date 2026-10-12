<script lang="ts">
  import { t } from './i18n';
  import { onMount, tick, type Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import Button from './Button.svelte';

  let { children, value=$bindable(''), disabled=false, onchange, ...attributes }:
    Omit<HTMLSelectAttributes,'value'|'children'|'onchange'> & {
      children?:Snippet; value?:string; onchange?:(event:Event & {currentTarget:HTMLSelectElement})=>void;
    }=$props();
  const uid=$props.id();
  let control:HTMLSelectElement;
  let menu:HTMLDivElement;
  let open=$state(false),active=$state(0),label=$state('');
  let options=$state<{value:string;label:string;disabled:boolean}[]>([]);
  let search='',searchedAt=0;

  onMount(()=>{
    const nativeLabel=control.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    nativeLabel?.querySelectorAll('select,[popover],.hint').forEach(node=>node.remove());
    label=attributes['aria-label'] || nativeLabel?.textContent?.trim() || 'Choose an option';
  });
  function close(){menu?.hidePopover();open=false;}
  function position(){
    const box=control.getBoundingClientRect();
    const width=Math.min(box.width,innerWidth-16);
    menu.style.width=width+'px';
    const below=window.innerHeight-box.bottom-8,above=box.top-8;
    const upwards=below<Math.min(280,menu.scrollHeight) && above>below;
    const height=Math.max(0,Math.min(280,upwards?above:below));
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
    const scroll=(event:Event)=>{if(!(event.target instanceof Node) || !menu.contains(event.target))close();};
    window.addEventListener('resize',resize);
    window.addEventListener('scroll',scroll,true);
    return()=>{window.removeEventListener('resize',resize);window.removeEventListener('scroll',scroll,true);};
  });
</script>

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
      <span>{option.label}</span><span aria-hidden="true">{value===option.value?'✓':''}</span>
    </Button>
  {/each}
</div>
