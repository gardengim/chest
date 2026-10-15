import {spawnSync} from 'node:child_process';
import {scriptCommand} from './package-runner.mjs';
const run=scriptCommand;
const commands=[
  run('check:release'),
  run('test:scripts'),
  run('check'),
  run('build'),
  run('check:licenses'),
  ['cargo',['test','--locked','--manifest-path','core/Cargo.toml']],
  ['cargo',['clippy','--locked','--manifest-path','core/Cargo.toml','--all-targets','--','-D','warnings']],
  ['cargo',['check','--locked','--manifest-path','src-tauri/Cargo.toml']],
  ['cargo',['test','--locked','--manifest-path','src-tauri/Cargo.toml','--lib','shortcuts']],
  run('test'),
];
for(const [command,args] of commands){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status ?? 1);}
