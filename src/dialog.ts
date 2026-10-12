export function showDialog(node: HTMLDialogElement) {
  // Keep dialogs outside light inventory panels, retaining their Svelte owner.
  const anchor=document.createComment('dialog');
  node.before(anchor);
  const overlays=document.getElementById('overlays');
  if(!overlays)throw new Error('Missing Chest overlay container.');
  overlays.append(node);
  node.showModal();
  return { destroy() {
    node.close();
    node.remove();
    anchor.remove();
  } };
}
