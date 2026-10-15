import {validateLicenses} from './license-bundle.mjs';
import {readFileSync} from 'node:fs';
const notices=JSON.parse(readFileSync('public/licenses.json','utf8'));
validateLicenses(notices);
const keys=new Set(notices.notices.map(n=>`${n.ecosystem}:${n.name}:${n.version}`));
if(notices.chest!==readFileSync('LICENSE','utf8'))throw new Error('Regenerate license notices: npm run licenses');
for(const file of ['core/Cargo.lock','src-tauri/Cargo.lock']){
 for(const pkg of readFileSync(file,'utf8').split('[[package]]')){
  if(!/^source = "registry/m.test(pkg))continue;
  const name=pkg.match(/^name = "([^"]+)"/m)?.[1],version=pkg.match(/^version = "([^"]+)"/m)?.[1];
  if(!keys.has(`Cargo:${name}:${version}`))throw new Error(`Missing Cargo license notice for ${name} ${version}; run npm run licenses`);
 }
}
const npm=JSON.parse(readFileSync('package-lock.json','utf8'));
for(const [path,pkg] of Object.entries(npm.packages)){
 if(!path || pkg.optional)continue;
 if(!keys.has(`npm:${path.split('node_modules/').at(-1)}:${pkg.version}`))throw new Error(`Missing npm license notice for ${path}; run npm run licenses`);
}
console.log('License notices match the dependency lockfiles.');
