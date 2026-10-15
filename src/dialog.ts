export function showDialog(node: HTMLDialogElement,options:{initialFocus?:string}={}) {
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
  } };
}
