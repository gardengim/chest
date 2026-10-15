import {basename} from 'node:path';
export function scriptCommand(script,executable=process.env.npm_execpath,node=process.execPath){
  if(!executable)throw new Error('Run this through npm run verify or bun run verify.');
  return /^bun(?:\.exe)?$/i.test(basename(executable))?[executable,['run',script]]:[node,[executable,'run',script]];
}
