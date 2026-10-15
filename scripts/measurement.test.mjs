import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,existsSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('native measurements reject an early exit without publishing zero-resource results',{skip:process.platform==='win32'},t=>{
  const directory=mkdtempSync(join(tmpdir(),'chest-measurement-test-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const executable=join(directory,'early-exit'),output=join(directory,'result.json');
  writeFileSync(executable,'#!/bin/sh\necho expected-test-exit >&2\nexit 17\n');
  chmodSync(executable,0o700);
  const result=spawnSync('python3',['scripts/measure-native-startup.py','--executable',executable,'--samples','1','--output',output],{encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/App exited before readiness/);
  assert.equal(existsSync(output),false);
});

test('live log retention bounds WebView strings and indicates omitted history',async()=>{
  const {trimLogs}=await import('../src/log-retention.ts');
  const logs={old:Array.from({length:1000},()=> 'a'.repeat(10000)),active:['latest line']};
  trimLogs(logs,['active']);
  assert.equal(logs.old[0],'Earlier logs omitted.');
  assert.deepEqual(logs.active,['latest line']);
  assert.ok(Object.values(logs).flat().reduce((n,line)=>n+line.length*2,0)<=16*1024*1024+100);
});
