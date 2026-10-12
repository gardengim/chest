import {readFileSync,writeFileSync,mkdtempSync,copyFileSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const mark=readFileSync(join(root,'public/chest.svg'),'utf8');
const body=mark.replace(/<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/g,'');
const mac=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>Chest macOS app icon</title>
  <defs>
    <linearGradient id="tile" x1="0" y1="80" x2="0" y2="944" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset=".45" stop-color="#F7F7F5"/><stop offset="1" stop-color="#E4E6E3"/></linearGradient>
    <linearGradient id="rim" x1="0" y1="80" x2="0" y2="944" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
    <filter id="chest-shadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="32" stdDeviation="22" flood-color="#000" flood-opacity=".4"/><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".24"/></filter>
  </defs>
  <path fill="url(#tile)" stroke="url(#rim)" stroke-width="4" d="M320 80H704C856 80 944 168 944 320V704C944 856 856 944 704 944H320C168 944 80 856 80 704V320C80 168 168 80 320 80Z"/>
  <g filter="url(#chest-shadow)"><g transform="translate(115.2 115.2) scale(6.2)">${body}</g></g>
</svg>
`;
writeFileSync(join(root,'docs/design/chest-macos.svg'),mac);
const temp=mkdtempSync(join(tmpdir(),'chest-icons-'));
function generate(input,output){execFileSync('npm',['run','tauri','--','icon',input,'--output',output],{cwd:root,stdio:'pipe'});}
try{
  const base=join(temp,'base'),apple=join(temp,'macos');
  generate('public/chest.svg',base);
  generate('docs/design/chest-macos.svg',apple);
  const destination=join(root,'src-tauri/icons');
  for(const name of readdirSync(destination)){
    if(/\.(png|ico)$/.test(name))copyFileSync(join(base,name),join(destination,name));
  }
  copyFileSync(join(apple,'icon.icns'),join(destination,'icon.icns'));
  mkdirSync(join(destination,'macos'),{recursive:true});
  for(const name of ['32x32.png','128x128.png','128x128@2x.png','icon.png'])copyFileSync(join(apple,name),join(destination,'macos',name));
  console.log('Updated desktop icons and macOS squircle.');
}finally{rmSync(temp,{recursive:true,force:true});}
