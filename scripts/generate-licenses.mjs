import {packLicenses} from './license-bundle.mjs';
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const notices=[];
function texts(directory){
  if(!existsSync(directory))return [];
  const result=[];
  for(const file of readdirSync(directory,{withFileTypes:true})){
    if(file.isFile() && /^(licen[cs]e|copying|notice|copyright)([.-]|$)/i.test(file.name))result.push(readFileSync(join(directory,file.name),'utf8'));
    if(file.isDirectory() && /^(licenses?|legal)$/i.test(file.name))for(const nested of readdirSync(join(directory,file.name),{withFileTypes:true}))if(nested.isFile())result.push(readFileSync(join(directory,file.name,nested.name),'utf8'));
  }
  return result;
}
const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
for(const [path,pkg] of Object.entries(lock.packages)){
  if(!path || pkg.optional && !existsSync(join(root,path)))continue;
  const directory=join(root,path);let meta={};
  if(existsSync(join(directory,'package.json')))meta=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
  const license=meta.license || pkg.license || 'See upstream';
  notices.push({name:meta.name || path.split('node_modules/').at(-1),version:pkg.version,ecosystem:'npm',license:typeof license==='string'?license:JSON.stringify(license),texts:texts(directory)});
}
const cargoPackages=new Map();
for(const manifest of ['src-tauri/Cargo.toml','core/Cargo.toml']){
const cargo=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--format-version','1','--manifest-path',join(root,manifest)],{maxBuffer:32*1024*1024,encoding:'utf8'}));
for(const pkg of cargo.packages)cargoPackages.set(`${pkg.name}:${pkg.version}`,pkg);
}
for(const pkg of cargoPackages.values()){
  if(!pkg.source)continue;
  const directory=dirname(pkg.manifest_path);
  const licenseTexts=texts(directory);
  if(pkg.license_file && existsSync(join(directory,pkg.license_file))){const text=readFileSync(join(directory,pkg.license_file),'utf8');if(!licenseTexts.includes(text))licenseTexts.push(text);}
  notices.push({name:pkg.name,version:pkg.version,ecosystem:'Cargo',license:pkg.license || 'See upstream',texts:licenseTexts});
}
notices.sort((a,b)=>a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
writeFileSync(join(root,'public/licenses.json'),JSON.stringify(packLicenses({chest:readFileSync(join(root,'LICENSE'),'utf8'),notices})));
console.log(`Bundled ${notices.length} dependency notices; ${notices.filter(n=>!n.texts.length).length} packages declare a license without a bundled license file.`);
