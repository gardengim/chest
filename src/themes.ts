import {derived,writable,get} from 'svelte/store';

// Public palette roles only. Pixel geometry, neutral lighting, outlines and
// artwork are deliberately absent from this contract.
export const defaultColors={
  page:'#1c1d1f','page-text':'#ececed','page-muted':'#a9adb1',
  panel:'#c6c7c9','panel-text':'#252525','panel-muted':'#4e5155',
  surface:'#36383b','surface-text':'#ececed','surface-muted':'#b0b4b8',
  control:'#55585c','control-text':'#f0f0f1',
  input:'#222427','input-text':'#e2e4e7','input-muted':'#a8b0b8',
  card:'#343a36','card-text':'#ececed','card-muted':'#c9cdd0',
  accent:'#416c29','accent-text':'#ffffff',link:'#b7df8f','panel-link':'#3c512b',
  'overlay-text':'#ececed','overlay-muted':'#c9cdd0',
  selected:'#626c5b','selected-text':'#eff5e6',focus:'#b5e681',
  success:'#365f3d','success-text':'#b8e5b0',
  warning:'#736c5b','warning-text':'#f1dbab',
  danger:'#773f35','danger-text':'#ffe0d8',
  console:'#10170c','console-text':'#c0d4b7',
  'scroll-track':'transparent','scroll-thumb':'#626b76',
} as const;
export type ColorRole=keyof typeof defaultColors;
export type SchemeMode='light'|'dark';
export type ModePreference=SchemeMode|'system';
export type Palette=Record<ColorRole,string>;
export type SingleScheme={version:1;name:string;mode:SchemeMode;colors:Palette};
export type ColorScheme={version:2;name:string;palettes:Record<SchemeMode,Palette>};
// The same gray/green palette on light surfaces. Artwork foregrounds and
// status fills retain their dark-surface pairings independently of page mode.
export const lightScheme:SingleScheme={version:1,name:'Chest Light',mode:'light',colors:{
  ...defaultColors,
  page:'#eceeed','page-text':'#252825','page-muted':'#535b53',
  panel:'#d9dcda','panel-text':'#252825','panel-muted':'#4e564e',
  surface:'#e3e6e3','surface-text':'#252825','surface-muted':'#535b53',
  control:'#c9ceca','control-text':'#252825',
  input:'#f7f8f5','input-text':'#252825','input-muted':'#596159',
  card:'#e0e5dc','card-text':'#252825','card-muted':'#4e574c',
  link:'#355c24','panel-link':'#355c24',
  selected:'#c2d1b6','selected-text':'#263521',focus:'#416c29',
  console:'#f1f4ed','console-text':'#30432a',
  'scroll-thumb':'#697568',
}};
export const defaultScheme:ColorScheme={version:2,name:'Chest',palettes:{light:{...lightScheme.colors},dark:{...defaultColors}}};
export const builtInSchemes:ColorScheme[]=[defaultScheme];
export const schemeStorageKey='chest-color-scheme-v1';
export const modeStorageKey='chest-appearance-mode-v1';
const libraryStorageKey='chest-color-schemes-v1';
export const schemeSizeLimit=64*1024;
const roles=new Set(Object.keys(defaultColors));
const error=(message:string):never=>{throw new Error(message);};
function record(value:unknown):value is Record<string,unknown>{return !!value && typeof value==='object' && !Array.isArray(value);}
function color(value:unknown):value is string{
  if(typeof value!=='string' || value.length>160)return false;
  // Never accept references, selectors, declarations, URLs or cascade keywords.
  if(!/^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([\da-z\s.,%+\-/()]+\))$/i.test(value.trim()))return false;
  if(/\b(?:var|env|url|currentcolor|inherit|initial|unset|revert|canvas|canvastext|buttontext|buttonface|highlight|highlighttext|linktext|visitedtext|activetext|field|fieldtext|graytext)\b/i.test(value))return false;
  return CSS.supports('color',value);
}
function validatePalette(value:unknown,defaults:Palette):Palette{
  if(!record(value))return error('Invalid color scheme structure.');
  const colors:Palette={...defaults};
  for(const [role,entry] of Object.entries(value)){
    if(!roles.has(role))return error('The scheme contains an unknown or protected setting.');
    if(!color(entry))return error('The scheme contains an invalid color.');
    colors[role as ColorRole]=entry.trim();
  }
  return colors;
}
export function validateScheme(value:unknown):ColorScheme{
  if(!record(value))return error('Invalid color scheme structure.');
  if(value.version!==1 && value.version!==2)return error('Unsupported color scheme version.');
  const fields=value.version===1?['version','name','mode','colors']:['version','name','mode','palettes'];
  if(Object.keys(value).some(key=>!fields.includes(key)))return error('Invalid color scheme structure.');
  if(typeof value.name!=='string' || !value.name.trim() || value.name.length>120)return error('Enter a color scheme name of up to 120 characters.');
  const name=value.name.trim();
  if(value.version===1){
    if(value.mode!=='light' && value.mode!=='dark')return error('Color scheme mode must be light or dark.');
    const colors=validatePalette(value.colors,defaultColors);
    // Earlier built-in names represent the same paired Chest palette.
    if((name==='Chest' && JSON.stringify(colors)===JSON.stringify(defaultColors)) || (name==='Chest Light' && JSON.stringify(colors)===JSON.stringify(lightScheme.colors)))return defaultScheme;
    return {version:2,name,palettes:{...defaultScheme.palettes,[value.mode]:colors}};
  }
  // Accept the earlier v2 mode field for compatibility, but never import a preference.
  if(value.mode!==undefined && value.mode!=='light' && value.mode!=='dark' && value.mode!=='system')return error('Color scheme mode must be light, dark or system.');
  if(!record(value.palettes) || Object.keys(value.palettes).some(key=>key!=='light' && key!=='dark'))return error('Invalid color scheme structure.');
  return {version:2,name:name==='Chest Adaptive'?'Chest':name,palettes:{
    light:validatePalette(value.palettes.light,lightScheme.colors),
    dark:validatePalette(value.palettes.dark,defaultColors),
  }};
}
export function parseScheme(source:string,name='Imported scheme'):ColorScheme{
  if(new TextEncoder().encode(source).length>schemeSizeLimit)return error('Color schemes must not exceed 64 KB.');
  const trimmed=source.trim();
  if(trimmed.startsWith('{')){
    let value:unknown;
    try{value=JSON.parse(trimmed);}catch{return error('Could not read the color scheme.');}
    return validateScheme(value);
  }
  // CSS is a data format here, never an injected stylesheet. One :root block
  // (or declarations alone) may contain only the documented palette properties.
  let declarations=trimmed.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  if(declarations.startsWith(':root')){
    const match=declarations.match(/^:root\s*\{([^{}]*)\}\s*$/);
    if(!match)return error('CSS schemes must contain only palette declarations.');
    declarations=match[1];
  }
  const colors:Record<string,string>={},declared=new Set<string>();let mode:'light'|'dark'='dark';let found=false;
  for(const declaration of declarations.split(';').map(item=>item.trim()).filter(Boolean)){
    const match=declaration.match(/^(--theme-[a-z-]+)\s*:\s*(.+)$/);
    if(!match)return error('CSS schemes must contain only palette declarations.');
    const role=match[1].slice('--theme-'.length);
    if(declared.has(role))return error('CSS schemes must contain only palette declarations.');
    declared.add(role);
    if(role==='mode'){
      if(match[2]!=='light' && match[2]!=='dark')return error('Color scheme mode must be light or dark.');
      mode=match[2];continue;
    }
    colors[role]=match[2];found=true;
  }
  if(!found)return error('Could not read the color scheme.');
  return validateScheme({version:1,name,mode,colors});
}
function savedAppearance(){
  let scheme=defaultScheme,legacyMode:ModePreference|undefined;
  try{
    const saved=localStorage.getItem(schemeStorageKey);
    if(saved){const raw=JSON.parse(saved);scheme=validateScheme(raw);if(['light','dark','system'].includes(raw.mode))legacyMode=raw.mode;}
  }catch{/* Invalid saved schemes fall back to Chest. */}
  let mode:ModePreference=legacyMode || 'dark';
  try{const saved=localStorage.getItem(modeStorageKey);if(saved==='light' || saved==='dark' || saved==='system')mode=saved;}catch{/* Storage is optional. */}
  return {scheme,mode,migrated:!!legacyMode};
}
const saved=savedAppearance();
export const activeScheme=writable<ColorScheme>(saved.scheme);
export const previewScheme=writable<ColorScheme|null>(null);
export const currentScheme=derived([activeScheme,previewScheme],([active,preview])=>preview || active);
export const appearanceMode=writable<ModePreference>(saved.mode);
let modeInitialized=false;
let editingAppearance=false;
export function beginAppearanceEdit(){editingAppearance=true;}
export function finishAppearanceEdit(commit:boolean){
  editingAppearance=false;
  if(commit){persistMode(get(appearanceMode));persistScheme(get(activeScheme));persistLibrary(get(importedSchemes));}
}
function persistMode(mode:ModePreference){try{localStorage.setItem(modeStorageKey,mode);}catch{/* Storage is optional. */}}
appearanceMode.subscribe(mode=>{
  if(!editingAppearance && (modeInitialized || saved.migrated))persistMode(mode);
  modeInitialized=true;
});
function savedLibrary():ColorScheme[]{
  try{
    const raw=JSON.parse(localStorage.getItem(libraryStorageKey) || '[]');
    if(!Array.isArray(raw))return [];
    return raw.slice(-32).flatMap(value=>{try{return [validateScheme(value)];}catch{return [];}});
  }catch{return [];}
}
const importedSchemes=writable<ColorScheme[]>(savedLibrary());
// Keep applied imports available when the user switches back to the built-in scheme.
function rememberScheme(scheme:ColorScheme){
  if(JSON.stringify(scheme)===JSON.stringify(defaultScheme))return;
  importedSchemes.update(schemes=>[...schemes.filter(item=>item.name!==scheme.name),scheme].slice(-32));
}
rememberScheme(saved.scheme);
function persistLibrary(schemes:ColorScheme[]){try{if(schemes.length)localStorage.setItem(libraryStorageKey,JSON.stringify(schemes));}catch{/* Storage is optional. */}}
importedSchemes.subscribe(schemes=>{if(!editingAppearance)persistLibrary(schemes);});
export const availableSchemes=derived([importedSchemes,activeScheme,previewScheme],([imports,active,preview])=>{
  const schemes=[...builtInSchemes,...imports];
  for(const scheme of [active,preview])if(scheme && !schemes.some(item=>JSON.stringify(item)===JSON.stringify(scheme)))schemes.push(scheme);
  return schemes;
});
const systemQuery=window.matchMedia('(prefers-color-scheme: dark)');
const systemMode=writable<SchemeMode>(systemQuery.matches?'dark':'light',set=>{
  const changed=(event:MediaQueryListEvent)=>set(event.matches?'dark':'light');
  systemQuery.addEventListener('change',changed);
  return ()=>systemQuery.removeEventListener('change',changed);
});
export const resolvedScheme=derived([currentScheme,appearanceMode,systemMode],([scheme,preference,system]):SingleScheme=>{
  const mode=preference==='system'?system:preference;
  return {version:1,name:scheme.name,mode,colors:scheme.palettes[mode]};
});

// Fixed neutral icon ink chosen for contrast, never tinted to a theme hue.
// Canvas resolves supported CSS color spaces once per scheme, not per icon.
const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
const context=canvas.getContext('2d',{willReadFrequently:true});
function iconInk(color:string,page:string){
  if(!context)return '#ececec';
  context.fillStyle='#ffffff';context.fillRect(0,0,1,1);
  context.fillStyle=page;context.fillRect(0,0,1,1);
  context.fillStyle=color;context.fillRect(0,0,1,1);
  const [r,g,b]=context.getImageData(0,0,1,1).data;
  const values=[r,g,b].map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  const luminance=values[0]*.2126+values[1]*.7152+values[2]*.0722;
  return luminance>.179?'#171717':'#ececec';
}
resolvedScheme.subscribe(scheme=>{
  const root=document.documentElement;
  for(const [role,value] of Object.entries(scheme.colors))root.style.setProperty(`--theme-${role}`,value);
  for(const role of ['page','panel','surface','control','input','card','accent','selected','danger'] as ColorRole[])root.style.setProperty(`--icon-on-${role}`,iconInk(scheme.colors[role],scheme.colors.page));
  root.style.colorScheme=scheme.mode;
  root.dataset.colorScheme=scheme.name;
});
function persistScheme(scheme:ColorScheme){
  try{if(JSON.stringify(scheme)===JSON.stringify(defaultScheme))localStorage.removeItem(schemeStorageKey);else localStorage.setItem(schemeStorageKey,JSON.stringify(scheme));}catch{/* The scheme remains usable when browser storage is unavailable. */}
}
activeScheme.subscribe(scheme=>{if(!editingAppearance)persistScheme(scheme);});
export function preview(source:string,name?:string){const scheme=parseScheme(source,name);previewScheme.set(scheme);return scheme;}
export function applyPreview(){const scheme=get(previewScheme);if(scheme){const validated=validateScheme(scheme);rememberScheme(validated);activeScheme.set(validated);}previewScheme.set(null);}
export function resetScheme(){previewScheme.set(null);activeScheme.set(defaultScheme);}
export function exportScheme(){return JSON.stringify(get(currentScheme),null,2)+'\n';}
