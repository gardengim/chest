<script lang="ts">
  import InstanceName from './InstanceName.svelte';
  import type {Instance} from './types';
  let {instances}:{instances:Instance[]}=$props();
  let count=$state(Infinity);
  function fit(node:HTMLElement,_signature:string){
    let frame=0;
    function measure(){
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const labels=Array.from(node.querySelectorAll<HTMLElement>('[data-reference]'));
        const available=node.clientWidth;
        const widths=labels.map(label=>(label.querySelector<HTMLElement>('.instance-name>span:last-child')?.scrollWidth || 0)+(label.querySelector<HTMLElement>('.instance-icon-ref')?.getBoundingClientRect().width || 0)+parseFloat(getComputedStyle(label.querySelector('.instance-name')!).gap));
        const gap=parseFloat(getComputedStyle(node).gap);
        const total=widths.reduce((sum,width)=>sum+width,0)+Math.max(0,widths.length-1)*gap;
        if(total<=available){count=instances.length;return;}
        const badge=node.querySelector<HTMLElement>('[data-counter]')!;
        let used=0,next=0;
        for(const width of widths){
          if(used+width+gap+badge.offsetWidth>available)break;
          used+=width+gap;next++;
        }
        // Keep one recognizable name, truncating it if necessary.
        count=Math.max(1,next);
      });
    }
    const observer=new ResizeObserver(measure);
    observer.observe(node);
    node.querySelectorAll('[data-reference]').forEach(label=>observer.observe(label));
    measure();
    return {update(){measure();},destroy(){cancelAnimationFrame(frame);observer.disconnect();}};
  }
  const shown=$derived(Math.min(count,instances.length));
</script>
<span class="instance-references" use:fit={instances.map(instance=>`${instance.id}:${instance.name}`).join('|')}>
  {#each instances as instance,index (instance.id)}
    <span data-reference class:overflowed={index>=shown} aria-hidden={index>=shown || undefined}><InstanceName {instance}/></span>
  {/each}
  <span data-counter class:measuring={shown===instances.length} title={instances.slice(shown).map(instance=>instance.name).join(', ')}>+{Math.max(1,instances.length-shown)}</span>
</span>
<style>
  .instance-references{position:relative;display:flex;align-items:center;gap:0.57142857rem;width:100%;min-width:0;overflow:hidden}
  [data-reference]{flex:none;max-width:100%;white-space:nowrap}
  [data-reference]:first-child{flex-shrink:1;min-width:0}
  [data-reference] :global(.instance-name){max-width:100%}
  [data-reference] :global(.instance-name>span:last-child){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  [data-reference].overflowed{position:absolute;visibility:hidden;max-width:none;pointer-events:none}
  [data-counter]{flex:none;font-size:0.85714286rem;color:var(--muted);white-space:nowrap}
  .measuring{position:absolute;visibility:hidden;pointer-events:none}
</style>
