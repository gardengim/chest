import {onMount} from 'svelte';

// Coalesce focus/visibility events and never overlap filesystem scans.
export function onFocusRefresh(refresh:()=>Promise<unknown>){
  onMount(()=>{
    let alive=true,pending=false,again=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    async function run(){
      timer=undefined;
      if(pending){again=true;return;}
      pending=true;
      try{await refresh();}finally{pending=false;if(alive && again){again=false;schedule();}}
    }
    function schedule(){
      if(!alive || document.visibilityState==='hidden')return;
      clearTimeout(timer);timer=setTimeout(()=>{void run();},100);
    }
    window.addEventListener('focus',schedule);
    document.addEventListener('visibilitychange',schedule);
    return()=>{alive=false;clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule);};
  });
}
