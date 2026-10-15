<script module lang="ts">
  // Keep the SVG assets smooth. Pixelation happens once, at display time.
  const sources:Record<string,string>={
    Instances:new URL('./icons/instances.svg',import.meta.url).href,
    User:new URL('./icons/user.svg',import.meta.url).href,
    Worlds:new URL('./icons/worlds.svg',import.meta.url).href,
    Explore:new URL('./icons/explore.svg',import.meta.url).href,
    News:new URL('./icons/news.svg',import.meta.url).href,
    Servers:new URL('./icons/servers.svg',import.meta.url).href,
    Collapse:new URL('./icons/collapse.svg',import.meta.url).href,
    More:new URL('./icons/more.svg',import.meta.url).href,
  };
  const pixelResolution=24;
  const rasters=new Map<string,Promise<HTMLCanvasElement>>();
  function rasterize(source:string){
    let raster=rasters.get(source);
    if(!raster){
      raster=new Promise<HTMLCanvasElement>((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>{
          const bitmap=document.createElement('canvas');
          bitmap.width=bitmap.height=pixelResolution;
          const context=bitmap.getContext('2d')!;
          // Measure coverage from an 8x render, rather than thresholding the
          // browser's tiny antialiased image (which inflated corners and strokes).
          const samples=8;
          const resolution=pixelResolution*samples;
          const scratch=document.createElement('canvas');
          scratch.width=scratch.height=resolution;
          const sampleContext=scratch.getContext('2d')!;
          sampleContext.drawImage(image,0,0,resolution,resolution);
          const coverage=sampleContext.getImageData(0,0,resolution,resolution).data;
          const pixels=context.createImageData(pixelResolution,pixelResolution);
          for(let y=0;y<pixelResolution;y++)for(let x=0;x<pixelResolution;x++){
            let alpha=0;
            for(let dy=0;dy<samples;dy++)for(let dx=0;dx<samples;dx++){
              alpha+=coverage[((y*samples+dy)*resolution+x*samples+dx)*4+3];
            }
            const offset=(y*pixelResolution+x)*4;
            pixels.data[offset]=pixels.data[offset+1]=pixels.data[offset+2]=255;
            pixels.data[offset+3]=alpha>=128*samples*samples?255:0;
          }
          context.putImageData(pixels,0,0);
          resolve(bitmap);
        };
        image.onerror=()=>{rasters.delete(source);reject(new Error(`Could not load icon: ${source}`));};
        image.src=source;
      });
      rasters.set(source,raster);
    }
    return raster;
  }
</script>
<script lang="ts">
  let {section,size=32}:{section:string;size?:number}=$props();
  let canvas:HTMLCanvasElement;
  $effect(()=>{
    const source=sources[section] || sources.Instances;
    const context=canvas.getContext('2d');
    if(!context)return;
    let disposed=false;
    let bitmap:HTMLCanvasElement|undefined;
    const draw=()=>{
      if(disposed || !bitmap)return;
      context.clearRect(0,0,pixelResolution,pixelResolution);
      context.imageSmoothingEnabled=false;
      context.drawImage(bitmap,0,0);
      context.globalCompositeOperation='source-in';
      context.fillStyle=getComputedStyle(canvas).color;
      context.fillRect(0,0,pixelResolution,pixelResolution);
      context.globalCompositeOperation='source-over';
    };
    rasterize(source).then(value=>{bitmap=value;draw();}).catch(error=>console.error(error));
    const control=canvas.closest('a,button');
    const observer=new MutationObserver(draw);
    const events=['pointerenter','pointerleave','focusin','focusout'];
    if(control){
      observer.observe(control,{attributes:true,attributeFilter:['class','style','aria-current']});
      for(const event of events)control.addEventListener(event,draw);
    }
    return ()=>{
      disposed=true;
      observer.disconnect();
      for(const event of events)control?.removeEventListener(event,draw);
    };
  });
</script>
<canvas bind:this={canvas} width={pixelResolution} height={pixelResolution} style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true"></canvas>
<style>
  canvas{display:block;image-rendering:pixelated;flex-shrink:0}
</style>
