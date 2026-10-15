import {moveToIndex} from './reorder';
export const homeSections=['instances','news','explore','worlds','servers','screenshots'] as const;
export type HomeSection=typeof homeSections[number];
export const sectionInfo:Record<HomeSection,{label:string}>={
  instances:{label:'Instances'},news:{label:'News'},explore:{label:'Explore'},
  worlds:{label:'Worlds'},servers:{label:'Servers'},screenshots:{label:'Screenshots'},
};
export const defaultShelves:HomeSection[]=['instances','news','explore'];
export const isHomeSection=(value:unknown):value is HomeSection=>typeof value==='string' && (homeSections as readonly string[]).includes(value);
export function normalizeShelves(value:unknown):HomeSection[]{
  return Array.isArray(value)?[...new Set(value.filter(isHomeSection))]:[...defaultShelves];
}
export function moveShelf(order:HomeSection[],section:HomeSection,index:number):HomeSection[]{
  return moveToIndex(order,section,index);
}

export const dockPositions=['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'] as const;
export type DockPosition=typeof dockPositions[number];
export type DockOrientation='auto'|'horizontal'|'vertical';
export const defaultDockPosition:DockPosition='bottom-center';
export function normalizeDockPosition(value:unknown):DockPosition{return dockPositions.includes(value as DockPosition)?value as DockPosition:defaultDockPosition;}
export function dockIsVertical(position:DockPosition,orientation:DockOrientation){return orientation==='auto'?position.startsWith('middle-'):orientation==='vertical';}
