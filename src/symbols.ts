// Bundled pixel-designed SVGs. Integer geometry renders directly; no conversion is needed.
const originals=import.meta.glob<string>('./icons/*.svg',{eager:true,query:'?raw',import:'default'});
export const symbols:Record<string,string>=Object.fromEntries(Object.entries(originals).map(([file,svg])=>[file.slice(file.lastIndexOf('/')+1,-4),svg]));
export function symbolSource(name:string){return symbols[name] || '';}
export function symbolBody(name:string){return symbolSource(name).replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');}

export function symbolViewBox(name:string){return symbolSource(name).match(/viewBox="([^"]+)"/)?.[1] || '0 0 24 24';}
