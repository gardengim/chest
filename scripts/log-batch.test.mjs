import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {createLogBatch} from '../src/log-batch.ts';

test('burst retention is bounded globally and reports omissions',async()=>{
  let delivered;
  const batch=createLogBatch(entries=>delivered=entries);
  for(let n=0;n<20_000;n++)batch.push({id:`session-${n%100}`,line:'x'.repeat(8192)});
  await wait(80);
  assert.ok(delivered);
  const lines=[...delivered.values()].flat();
  assert.ok(lines.reduce((sum,line)=>sum+line.length*2,0)<=16*1024*1024+100*'Earlier logs omitted.'.length*2);
  assert.ok(lines.includes('Earlier logs omitted.'));
  assert.ok(delivered.get('session-99').some(line=>line.startsWith('x')));
  batch.dispose();
});

test('disposing a pending batch releases it without a late callback',async()=>{
  let calls=0;
  const batch=createLogBatch(()=>calls++);
  batch.push({id:'session',line:'pending'});
  batch.dispose();
  await wait(80);
  assert.equal(calls,0);
});

test('a burst of distinct sessions cannot retain unbounded map entries',async()=>{
  let delivered;
  const batch=createLogBatch(entries=>delivered=entries);
  for(let n=0;n<10_000;n++)batch.push({id:`session-${n}`,line:'entry'});
  await wait(80);
  assert.equal(delivered.size,1000);
  assert.ok(delivered.has('session-9999'));
  assert.ok(delivered.get('session-9999').includes('Earlier logs omitted.'));
  batch.dispose();
});
