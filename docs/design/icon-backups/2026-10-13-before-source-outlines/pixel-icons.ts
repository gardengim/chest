import {symbols} from './symbols';

export const iconResolution=24;
export const iconStrokeWidth=1.5;
const samples=4;
const cache=new Map<string,Promise<string>>();

// One offscreen conversion per symbol for the lifetime of the app. Returning
// geometry lets every icon inherit CSS color without canvases or style observers.
export function pixelIcon(name:string):Promise<string>{
  const key=Object.hasOwn(symbols,name)?name:'cube';
  let result=cache.get(key);
  if(result)return result;
  result=new Promise<string>((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      try{
        const width=iconResolution*samples;
        const canvas=document.createElement('canvas');canvas.width=canvas.height=width;
        const context=canvas.getContext('2d');
        if(!context)throw new Error('Icon rendering unavailable');
        context.drawImage(image,0,0,width,width);
        const data=context.getImageData(0,0,width,width).data;
        const cells=new Uint8Array(iconResolution*iconResolution);
        for(let y=0;y<iconResolution;y++)for(let x=0;x<iconResolution;x++){
          let coverage=0;
          for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++)coverage+=data[((y*samples+sy)*width+x*samples+sx)*4+3];
          cells[y*iconResolution+x]=coverage>=128*samples*samples?1:0;
        }
        const runs:string[]=[];
        for(let y=0;y<iconResolution;y++)for(let x=0;x<iconResolution;){
          if(!cells[y*iconResolution+x]){x++;continue;}
          const start=x;while(x<iconResolution && cells[y*iconResolution+x])x++;
          runs.push(`M${start} ${y}h${x-start}v1h${start-x}z`);
        }
        resolve(runs.join(''));
      }catch(error){cache.delete(key);reject(error);}
    };
    image.onerror=()=>{cache.delete(key);reject(new Error('Icon rendering unavailable'));};
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="${iconStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${symbols[key]}"/></svg>`;
    image.src=`data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
  cache.set(key,result);
  return result;
}
