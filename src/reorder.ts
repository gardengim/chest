/** Shared list movement and hit testing for the sidebar and home dock. */
export type ReorderAxis='x'|'y';
export function moveToIndex<T>(items:readonly T[],item:T,index:number):T[]{
  const next=items.filter(value=>value!==item);
  next.splice(Math.max(0,Math.min(index,next.length)),0,item);
  return next;
}
export function movedEnough(dx:number,dy:number,threshold:number,axis?:ReorderAxis){
  return (axis?Math.abs(axis==='x'?dx:dy):Math.hypot(dx,dy))>=threshold;
}
// offset positions exclude FLIP transforms. Animated boxes must not change the
// insertion target while the pointer is stationary.
export function layoutOffset(element:HTMLElement,container:HTMLElement,axis:ReorderAxis):number{
  function offset(node:HTMLElement|null){let result=0;while(node){result+=axis==='x'?node.offsetLeft:node.offsetTop;node=node.offsetParent as HTMLElement|null;}return result;}
  return offset(element)-offset(container);
}
export function insertionIndex(elements:HTMLElement[],container:HTMLElement,coordinate:number,axis:ReorderAxis,direction:number,margin=0){
  return elements.filter(element=>coordinate>layoutOffset(element,container,axis)+(axis==='x'?element.offsetWidth:element.offsetHeight)/2+direction*margin).length;
}
