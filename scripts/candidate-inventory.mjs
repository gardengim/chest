import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,stat,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
const root=process.argv[2];
if(!root)throw new Error('Expected bundle directory');
const files=[];
async function walk(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(path===join(root,'candidate-inventory.json'))continue;
    if(entry.isDirectory())await walk(path);
    else if(entry.isFile()){
      const hash=createHash('sha256');
      for await(const chunk of createReadStream(path))hash.update(chunk);
      files.push({path:relative(root,path).replaceAll('\\','/'),bytes:(await stat(path)).size,sha256:hash.digest('hex')});
    }
  }
}
await walk(root);
if(!files.length)throw new Error('Bundle directory is empty');
files.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(join(root,'candidate-inventory.json'),JSON.stringify({commit:process.env.GITHUB_SHA || null,platform:process.platform,signing:'Unsigned verification build; not distribution acceptance',files},null,2)+'\n');
