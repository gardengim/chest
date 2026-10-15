// Bundled, trusted originals. Each SVG owns its geometry and outline thickness;
// the renderer only samples it and never substitutes a stroke width.
const originals=import.meta.glob<string>('./icons/*.svg',{eager:true,query:'?raw',import:'default'});
export const symbols:Record<string,string>=Object.fromEntries(Object.entries(originals).map(([file,svg])=>[file.slice(file.lastIndexOf('/')+1,-4),svg]));
export function symbolSource(name:string){return symbols[Object.hasOwn(symbols,name)?name:'cube'];}
export function symbolBody(name:string){return symbolSource(name).replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');}
// Optional solid accent artwork shares the same pixel grid as the outline.
export function symbolAccent(name:string){
  const body=symbolSource(name).match(/<path\b[^>]*data-accent="true"[^>]*\/>/)?.[0];
  const color=body?.match(/\bfill="([^"]+)"/)?.[1];
  return body&&color?{body,color}:null;
}
