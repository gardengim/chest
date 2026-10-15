import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkAuthConfiguration} from './check-auth-config.mjs';

test('packaging rejects empty and placeholder application IDs',t=>{
  const root=mkdtempSync(join(tmpdir(),'chest-auth-config-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'core/src'),{recursive:true});
  for(const id of ['', 'placeholder','00000000-0000-0000-0000-000000000000']){
    writeFileSync(join(root,'core/src/store.rs'),`pub const DEFAULT_CLIENT_ID: &str = "${id}";`);
    assert.throws(()=>checkAuthConfiguration(root),/application ID/);
  }
  assert.equal(checkAuthConfiguration(),'2a46389b-7bf0-4854-95b8-0e808d0ac054');
});
