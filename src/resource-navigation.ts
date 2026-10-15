export type ResourceLink={id:string;tab:'Worlds'|'Servers';item:string;key:number};
export function resourceKey(kind:'world'|'server',item:string){return `${kind}:${item}`;}
