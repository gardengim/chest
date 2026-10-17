import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hexagonPoints,chestMark,latchFaces} from './chest-mark.mjs';
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
  assert.equal(readFileSync(new URL('../public/chest.svg',import.meta.url),'utf8').replace(/\r\n/g,'\n'),chestMark());
});

test('latch faces share edges on the cube isometric axes without a distorting transform',()=>{
  const {top:[a,b,c,d],front,side}=latchFaces();
  const slope=(p,q)=>(q[1]-p[1])/(q[0]-p[0]);
  for(const [p,q] of [[a,b],[d,c]])assert.ok(Math.abs(slope(p,q)+1/Math.sqrt(3))<1e-10);
  for(const [p,q] of [[a,d],[b,c]])assert.ok(Math.abs(slope(p,q)-1/Math.sqrt(3))<1e-10);
  const width=Math.hypot(b[0]-a[0],b[1]-a[1]),depth=Math.hypot(d[0]-a[0],d[1]-a[1]);
  const height=front[3][1]-front[0][1];
  assert.ok(Math.abs(depth/width-.5)<1e-10);
  assert.ok(Math.abs(height/width-2)<1e-10);
  assert.deepEqual(front.slice(0,2),[d,c]);assert.deepEqual(side.slice(0,2),[a,d]);
  for(const face of [front,side]){
    assert.equal(face[3][0],face[0][0]);assert.equal(face[2][0],face[1][0]);
    assert.equal(face[3][1]-face[0][1],18);assert.equal(face[2][1]-face[1][1],18);
  }
  assert.ok(!chestMark().includes('matrix('));
});
