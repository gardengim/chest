import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {checkRelease} from './check-release-version.mjs';
const files=['package.json','package-lock.json','core/Cargo.toml','core/Cargo.lock','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json','src-tauri/updater.pub'];
function fixture(t){const root=mkdtempSync(join(tmpdir(),'chest-release-'));for(const file of files){mkdirSync(dirname(join(root,file)),{recursive:true});copyFileSync(file,join(root,file));}t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
test('release inputs agree; a mismatched tag is rejected',t=>{
  const root=fixture(t),version=JSON.parse(readFileSync(join(root,'package.json'))).version;
  assert.equal(checkRelease(root,`v${version}`),version);
  assert.throws(()=>checkRelease(root,'v999.0.0'),/versions must match/);
});
test('stale Cargo lockfile version is rejected',t=>{
  const root=fixture(t),path=join(root,'core/Cargo.lock');
  const source=readFileSync(path,'utf8').replace(/\r?\n/g,'\r\n');
  const changed=source.replace(/(name = "chest-core"\r?\nversion = ")[^"]+/, (_match,prefix)=>prefix+'999.0.0');
  assert.notEqual(changed,source,'fixture must change the package version');
  assert.match(changed,/name = "chest-core"\r?\nversion = "999\.0\.0"/);
  writeFileSync(path,changed);
  assert.throws(()=>checkRelease(root),/versions must match/);
});
for(const change of ['key','endpoint','artifacts'])test(`invalid updater ${change} is rejected`,t=>{
  const root=fixture(t),path=join(root,'src-tauri/tauri.conf.json'),config=JSON.parse(readFileSync(path));
  if(change==='key')config.plugins.updater.pubkey='different';
  if(change==='endpoint')config.plugins.updater.endpoints=['http://example.com/latest.json'];
  if(change==='artifacts')config.bundle.createUpdaterArtifacts=false;
  writeFileSync(path,JSON.stringify(config));assert.throws(()=>checkRelease(root),/Updater|updater/);
});

test('lowering the macOS WebView baseline is rejected',t=>{
  const root=fixture(t),path=join(root,'src-tauri/tauri.conf.json'),config=JSON.parse(readFileSync(path));
  config.bundle.macOS.minimumSystemVersion='10.13';
  writeFileSync(path,JSON.stringify(config));assert.throws(()=>checkRelease(root),/macOS minimum/);
});
