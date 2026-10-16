import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hexagonPoints,chestMark} from './chest-mark.mjs';
import {readFileSync} from 'node:fs';
test('chest outline is a centered regular hexagon and exported SVG matches the generator',()=>{
  const vertices=hexagonPoints();
  for(let i=0;i<6;i++){
    const [x,y]=vertices[i],[nextX,nextY]=vertices[(i+1)%6];
    assert.ok(Math.abs(Math.hypot(x-64,y-64)-52)<1e-10);
    assert.ok(Math.abs(Math.hypot(nextX-x,nextY-y)-52)<1e-10);
    assert.ok(Math.abs(x+vertices[(i+3)%6][0]-128)<1e-10);
    assert.ok(Math.abs(y+vertices[(i+3)%6][1]-128)<1e-10);
  }
  assert.equal(readFileSync(new URL('../public/chest.svg',import.meta.url),'utf8'),chestMark());
});
