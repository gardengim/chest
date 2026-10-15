import {test} from 'node:test';
import {deepStrictEqual,throws} from 'node:assert';
import {scriptCommand} from './package-runner.mjs';
test('verify invokes Bun as a binary and npm as a Node script',()=>{
  deepStrictEqual(scriptCommand('check','/tools/bun','/tools/node'),['/tools/bun',['run','check']]);
  deepStrictEqual(scriptCommand('check','/tools/npm-cli.js','/tools/node'),['/tools/node',['/tools/npm-cli.js','run','check']]);
  throws(()=>scriptCommand('check',''),/npm run verify or bun run verify/);
});
