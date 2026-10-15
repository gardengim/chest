export function showDialog(node: HTMLDialogElement,options:{initialFocus?:string}={}) {
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  // Keep dialogs outside light inventory panels, retaining their Svelte owner.
  const anchor=document.createComment('dialog');
  node.before(anchor);
  const overlays=document.getElementById('overlays');
  if(!overlays)throw new Error('Missing Chest overlay container.');
  overlays.append(node);
  node.showModal();
  if(options.initialFocus)node.querySelector<HTMLElement>(options.initialFocus)?.focus({preventScroll:true});
  return { destroy() {
    node.close();
    node.remove();
    anchor.remove();
    // Production teardown may detach the dialog before native close restores
    // focus. Restore after the owner's DOM update, only if its trigger survives.
    queueMicrotask(()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});});
  } };
}
