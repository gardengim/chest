import {spawnSync} from 'node:child_process';
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run this through npm run verify.');
const commands=[
  [process.execPath,[npm,'run','check:release']],
  [process.execPath,[npm,'run','test:scripts']],
  [process.execPath,[npm,'run','check']],
  [process.execPath,[npm,'run','build']],
  ['cargo',['test','--locked','--manifest-path','core/Cargo.toml']],
  ['cargo',['clippy','--locked','--manifest-path','core/Cargo.toml','--all-targets','--','-D','warnings']],
  ['cargo',['check','--locked','--manifest-path','src-tauri/Cargo.toml']],
  [process.execPath,[npm,'test']],
];
for(const [command,args] of commands){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status ?? 1);}
