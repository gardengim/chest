import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCandidate} from './audit-candidate.mjs';

async function fixture(run){
  const directory=await mkdtemp(join(tmpdir(),'chest-audit-test-'));
  const data=Buffer.from('fixture installer'),item={path:'Chest.dmg',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  const inventory={commit:'source',files:[item]};
  await writeFile(join(directory,item.path),data);
  const save=()=>writeFile(join(directory,'candidate-inventory.json'),JSON.stringify(inventory));
  try{await save();await run(directory,inventory,save);}finally{await rm(directory,{recursive:true,force:true});}
}
test('candidate evidence verifies bytes and source before accepting an installer',()=>fixture(async directory=>{
  assert.equal((await verifyCandidate(directory,'source','aarch64-apple-darwin')).verifiedInstallers.length,1);
  await assert.rejects(verifyCandidate(directory,'different','aarch64-apple-darwin'),/source mismatch/);
}));
test('same-size modified installer fails integrity verification',()=>fixture(async directory=>{
  await writeFile(join(directory,'Chest.dmg'),'Fixture installer');
  await assert.rejects(verifyCandidate(directory,'source','aarch64-apple-darwin'),/integrity failure/);
}));
test('missing required installer fails rather than producing partial evidence',()=>fixture(async(directory,inventory,save)=>{
  inventory.files=[];await save();
  await assert.rejects(verifyCandidate(directory,'source','aarch64-apple-darwin'),/Missing .dmg/);
}));
test('inventory cannot verify an installer outside its artifact directory',()=>fixture(async(directory,inventory,save)=>{
  inventory.files[0].path='../outside.dmg';await save();
  await assert.rejects(verifyCandidate(directory,'source','aarch64-apple-darwin'),/Unconfined/);
}));
