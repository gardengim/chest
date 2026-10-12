import './preferences';
import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
// Keep native editing menus in text fields; app menus handle other surfaces.
document.addEventListener('contextmenu',event=>{
  const target=event.target;
  if(target instanceof Element){
    const field=target.closest('input,textarea');
    if(field instanceof HTMLTextAreaElement ||
      (field instanceof HTMLInputElement && ['text','search','email','url','tel','password','number'].includes(field.type)) ||
      (target instanceof HTMLElement && target.isContentEditable))return;
  }
  event.preventDefault();
});
mount(App, { target: document.getElementById('app')! });
