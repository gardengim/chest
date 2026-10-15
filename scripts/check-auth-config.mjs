import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function checkAuthConfiguration(root=process.cwd()){
  const source=readFileSync(resolve(root,'core/src/store.rs'),'utf8');
  const id=source.match(/pub const DEFAULT_CLIENT_ID: &str = "([^"]+)"/)?.[1];
  if(!id || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) || /^0(?:0|-)+$/.test(id)){
    throw new Error('Configure Chest’s public Microsoft application ID before packaging a release.');
  }
  return id;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(`Public Microsoft application ID configured: ${checkAuthConfiguration()}`);
}
