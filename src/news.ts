import { api } from './api';
import type { NewsArticle } from './types';
let request:Promise<NewsArticle[]>|undefined;
export function loadNews(retry=false){
  if(retry)request=undefined;
  return request ??= api.news().then(items=>items || []).catch(error=>{request=undefined;throw error;});
}

const updates=new Map<string,{expires:number;request:Promise<import('./types').InstanceNews>}>();
function loadInstanceNews(instance:import('./types').Instance,retry:boolean){
  const key=JSON.stringify([instance.id,instance.version,instance.loader,instance.loader_version,instance.installed]);
  const cached=updates.get(key);
  if(!retry && cached && cached.expires>Date.now())return cached.request;
  const request=api.instanceNews(instance.id).then(result=>{
    const news=result || {articles:[],unavailable:[]};
    if(news.unavailable.length)updates.delete(key);
    return news;
  }).catch(error=>{updates.delete(key);throw error;});
  updates.set(key,{expires:Date.now()+5*60*1000,request});
  return request;
}
export async function loadInstanceUpdates(instances:import('./types').Instance[],retry=false){
  const articles:NewsArticle[]=[], unavailable:string[]=[];
  let index=0;
  async function worker(){
    while(index<instances.length){
      const instance=instances[index++];
      try{
        const news=await loadInstanceNews(instance,retry);
        articles.push(...news.articles);
        if(news.unavailable.length)unavailable.push(instance.name);
      }catch{unavailable.push(instance.name);}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,instances.length)},worker));
  return {articles,unavailable};
}
