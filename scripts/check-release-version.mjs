import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function checkRelease(root=process.cwd(),tag){
  const read=path=>readFileSync(resolve(root,path),'utf8');
  const json=path=>JSON.parse(read(path));
  const version=json('package.json').version;
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Use a stable semantic release version.');
  const manifestVersion=path=>read(path).match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const lock=json('package-lock.json'),tauri=json('src-tauri/tauri.conf.json');
  const versions=[tauri.version,manifestVersion('src-tauri/Cargo.toml'),manifestVersion('core/Cargo.toml'),lock.version,lock.packages[''].version];
  for(const [path,names] of [['core/Cargo.lock',['chest-core']],['src-tauri/Cargo.lock',['chest','chest-core']]]){
    const packages=read(path).split('[[package]]');
    for(const name of names){
      const pkg=packages.find(pkg=>pkg.match(/^name\s*=\s*"([^"]+)"/m)?.[1]===name);
      versions.push(pkg?.match(/^version\s*=\s*"([^"]+)"/m)?.[1]);
    }
  }
  if((tag && tag!==`v${version}`) || versions.some(value=>value!==version))throw new Error('Release tag, manifests, and lockfile versions must match.');
  if(tauri.bundle?.createUpdaterArtifacts!==true)throw new Error('Signed updater artifacts must be enabled.');
  const updater=tauri.plugins?.updater;
  if(!updater?.pubkey || updater.pubkey.trim()!==read('src-tauri/updater.pub').trim())throw new Error('Updater public keys must match.');
  if(JSON.stringify(updater.endpoints)!==JSON.stringify(['https://github.com/gardengim/chest/releases/latest/download/latest.json']))throw new Error('Unexpected updater endpoint.');
  return version;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(`Release version ${checkRelease(process.cwd(),process.argv[2])} and updater configuration verified.`);
}
