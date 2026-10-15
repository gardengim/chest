// Give the usable library its first frame before optional network/artwork work.
// Safari versions without idle callbacks use a short, cancellable fallback.
export function afterFirstPaint(task:()=>void){
  let idle:number|undefined;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const frame=requestAnimationFrame(()=>{
    if(typeof window.requestIdleCallback==='function')idle=window.requestIdleCallback(task,{timeout:1000});
    else timer=setTimeout(task,100);
  });
  return()=>{
    cancelAnimationFrame(frame);
    if(idle!==undefined)window.cancelIdleCallback(idle);
    clearTimeout(timer);
  };
}
