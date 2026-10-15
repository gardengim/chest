import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packLicenses,validateLicenses} from './license-bundle.mjs';
test('license packing preserves every notice exactly while sharing identical text',()=>{
  const original={chest:'MIT',notices:[{name:'a',texts:['Copyright Alice\nMIT','Apache']},{name:'b',texts:['Copyright Bob\nMIT','Apache']},{name:'c',texts:[]}]};
  const packed=packLicenses(original);validateLicenses(packed);
  assert.equal(packed.texts.length,3);
  assert.deepEqual({...packed,texts:undefined,notices:packed.notices.map(n=>({...n,texts:n.texts.map(i=>packed.texts[i])}))},{...original,texts:undefined});
  packed.notices[0].texts.push(50);assert.throws(()=>validateLicenses(packed),/Invalid license reference/);
});
