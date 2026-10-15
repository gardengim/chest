import {symbols,symbolSource,symbolAccent} from './symbols';

export const iconResolution=24;
const samples=8;
const cache=new Map<string,Promise<string>>();

// One offscreen conversion per symbol for the lifetime of the app. Returning
// geometry lets every icon inherit CSS color without canvases or style observers.
export function pixelIcon(name:string,accent=false):Promise<string>{
  const symbol=Object.hasOwn(symbols,name)?name:'cube';
  const key=accent?`${symbol}:accent`:symbol;
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
          // Sample around the pixel center rather than averaging its whole
          // area: thin curves should follow their centerline, not lose pixels
          // because they cover less than half of a cell near a diagonal.
          let coverage=0;
          const middle=samples/2;
          for(let sy=middle-1;sy<=middle;sy++)for(let sx=middle-1;sx<=middle;sx++)coverage+=data[((y*samples+sy)*width+x*samples+sx)*4+3];
          cells[y*iconResolution+x]=coverage>=128*4?1:0;
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
    const source=symbolSource(symbol);
    const svg=(accent?source.replace(/(<svg\b[^>]*>)[\s\S]*<\/svg>\s*$/,`$1${symbolAccent(symbol)?.body??''}</svg>`):source).replaceAll('currentColor','white');
    image.src=`data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
  cache.set(key,result);
  return result;
}
