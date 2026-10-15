import {marked} from 'marked';
import DOMPurify from 'dompurify';
import type {ProjectDescription} from './types';
export function descriptionURL(raw:string,base:string){
  if(!raw.trim())return null;
  try{const url=new URL(raw,base);return ['https:','http:'].includes(url.protocol) && !url.username && !url.password?url.href:null;}catch{return null;}
}
export function renderDescription(description:ProjectDescription,base:string,embedLabel:string){
  if(description.body.length>512*1024)throw new Error('Description exceeds size limit');
  const html=description.format==='markdown'?marked.parse(description.body,{async:false,gfm:true}):description.body;
  // Templates are inert: provider markup is sanitized before joining the live DOM.
  const template=document.createElement('template');template.innerHTML=html;
  for(const embed of Array.from(template.content.querySelectorAll('iframe,video,audio,object,embed'))){
    const href=descriptionURL(embed.getAttribute('src') || embed.getAttribute('data') || embed.querySelector('source')?.getAttribute('src') || '',base);
    if(!href){embed.remove();continue;}
    const link=document.createElement('a');link.href=href;link.textContent=embedLabel;embed.replaceWith(link);
  }
  const clean=DOMPurify.sanitize(template.innerHTML,{
    ALLOWED_TAGS:['p','br','hr','h1','h2','h3','h4','h5','h6','strong','b','em','i','s','del','u','ul','ol','li','a','img','blockquote','pre','code','table','thead','tbody','tfoot','tr','th','td','div','span','details','summary','sup','sub'],
    ALLOWED_ATTR:['href','src','alt','title','colspan','rowspan','start'],
    ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false,RETURN_DOM_FRAGMENT:true,
  });
  for(const link of Array.from(clean.querySelectorAll('a'))){
    const href=descriptionURL(link.getAttribute('href') || '',base);
    if(!href){link.removeAttribute('href');continue;}
    link.href=href;link.target='_blank';link.rel='noopener noreferrer';
  }
  let imageCount=0;
  for(const image of Array.from(clean.querySelectorAll('img'))){
    const src=descriptionURL(image.getAttribute('src') || '',base);
    if(!src || !src.startsWith('https:') || ++imageCount>100){image.replaceWith(document.createTextNode(image.alt));continue;}
    image.src=src;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
  }
  for(const table of Array.from(clean.querySelectorAll('table'))){
    const wrap=document.createElement('div');wrap.className='rich-table-scroll';table.replaceWith(wrap);wrap.append(table);
  }
  const result=document.createElement('div');result.append(clean);return result.innerHTML;
}
