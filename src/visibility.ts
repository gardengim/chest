import {readable,get} from 'svelte/store';
import {reduceMotion} from './preferences';

// One lifecycle subscription and one intersection observer for all backdrops.
export const presentation=readable({visible:true,motion:true},set=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>set({visible:!document.hidden,motion:!media.matches && !get(reduceMotion)});
  const unsubscribe=reduceMotion.subscribe(update);
  document.addEventListener('visibilitychange',update);media.addEventListener('change',update);
  update();
  return()=>{unsubscribe();document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};
});
const callbacks=new Map<Element,(visible:boolean)=>void>();
let observer:IntersectionObserver|undefined;
export function observeVisibility(element:Element,callback:(visible:boolean)=>void){
  observer ??= new IntersectionObserver(entries=>{
    for(const entry of entries)callbacks.get(entry.target)?.(entry.isIntersecting);
  },{rootMargin:'100px'});
  callbacks.set(element,callback);observer.observe(element);
  return()=>{callbacks.delete(element);observer?.unobserve(element);if(!callbacks.size){observer?.disconnect();observer=undefined;}};
}
