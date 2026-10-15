// One entry point for repeatable local validation and CI evidence collection.
import {createHash} from 'node:crypto';
import {createReadStream,openSync,closeSync} from 'node:fs';
import {mkdir,readFile,writeFile,stat,realpath,readdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {scriptCommand} from './package-runner.mjs';

const targets={
  'aarch64-apple-darwin':['.dmg'],
  'x86_64-apple-darwin':['.dmg'],
  'x86_64-pc-windows-msvc':['.exe','.msi'],
  'x86_64-unknown-linux-gnu':['.deb','.rpm','.AppImage'],
};
const nativeTargets=['aarch64-apple-darwin','x86_64-pc-windows-msvc','x86_64-unknown-linux-gnu'];
const platforms=['darwin','win32','linux'];
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const save=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const command=(name,args)=>execFileSync(name,args,{encoding:'utf8'}).trim();
const git=(...args)=>command('git',args);
const gh=(...args)=>command('gh',args);
const digest=async path=>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');};

export async function verifyCandidate(directory,commit,target){
  const root=await realpath(directory),inventory=await json(join(root,'candidate-inventory.json'));
  if(inventory.commit!==commit)throw new Error('Candidate source mismatch');
  const extensions=targets[target];
  if(!extensions)throw new Error('Unknown candidate target');
  const installers=inventory.files.filter(item=>extensions.some(extension=>item.path.endsWith(extension)));
  for(const extension of extensions)if(!installers.some(item=>item.path.endsWith(extension)))throw new Error(`Missing ${extension} installer`);
  for(const item of installers){
    const path=resolve(root,item.path);
    if(isAbsolute(item.path)||relative(root,path).startsWith('..'))throw new Error('Unconfined installer path');
    const actual=await realpath(path);
    if(relative(root,actual).startsWith('..'))throw new Error('Unconfined installer symlink');
    if((await stat(path)).size!==item.bytes||await digest(path)!==item.sha256)throw new Error(`Installer integrity failure: ${item.path}`);
  }
  return {target,commit,verifiedInstallers:installers};
}

async function successfulRun(id,workflow){
  if(!/^\d+$/.test(id||''))throw new Error(`Expected numeric ${workflow} run ID`);
  const run=JSON.parse(gh('run','view',id,'--json','databaseId,headSha,status,conclusion,url,workflowName'));
  if(run.workflowName!==workflow||run.status!=='completed'||run.conclusion!=='success')throw new Error(`Run ${id} is not a successful completed ${workflow} run`);
  return run;
}
async function freshOutput(path){
  if(!path)throw new Error('Provide --output pointing to a new evidence directory');
  const output=resolve(path);
  await mkdir(output,{recursive:false}); // Never overwrite previous evidence.
  return output;
}
async function local(output){
  const browser=process.env.CHEST_BROWSER_EXECUTABLE||(await import('@playwright/test')).chromium.executablePath();
  if(!(await stat(browser).catch(()=>null))?.isFile())throw new Error('Browser unavailable. Run npx playwright install chromium or set CHEST_BROWSER_EXECUTABLE.');
  const source=git('rev-parse','HEAD');
  const changes=git('status','--porcelain');
  await save(join(output,'source.json'),{source,workingTreeChanges:changes,platform:process.platform});
  for(const [stage,script,extra] of [['verify','verify',[]],['build','tauri',['--','build',...(process.platform==='darwin'?['--bundles','app']:[]),'--config','{"bundle":{"createUpdaterArtifacts":false}}']]]){
    console.log(`${stage}: writing ${join(output,stage+'.log')}`);
    const [executable,args]=scriptCommand(script),fd=openSync(join(output,stage+'.log'),'wx');
    let result;
    try{result=spawnSync(executable,[...args,...extra],{stdio:['inherit',fd,fd]});}finally{closeSync(fd);}
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`${stage} failed (${result.status}); inspect its log. No later stage ran.`);
  }
  const app=resolve('src-tauri/target/release/bundle/macos/Chest.app');
  const executable=process.platform==='darwin'?join(app,'Contents/MacOS/chest'):resolve('src-tauri/target/release',process.platform==='win32'?'chest.exe':'chest');
  let logicalAppBytes;
  if(process.platform==='darwin'){
    logicalAppBytes=0;
    for(const entry of await readdir(app,{recursive:true,withFileTypes:true}))if(entry.isFile())logicalAppBytes+=(await stat(join(entry.parentPath,entry.name))).size;
  }
  await save(join(output,'local-candidate.json'),{source,workingTreeChanges:changes,artifact:relative(process.cwd(),executable),logicalAppBytes,executableBytes:(await stat(executable)).size,executableSha256:await digest(executable),distributionSigning:false,notarization:false});
  console.log('Local validation/build passed. GUI launch and human acceptance are separate.');
}
async function collect(options){
  const candidate=await successfulRun(options.candidate,'Build verification candidates');
  const checks=await successfulRun(options.check,'Check Chest');
  const resources=await successfulRun(options.resources,'Measure offline resource workloads');
  const startup=await successfulRun(options.startup,'Measure packaged native startup');
  // Test/tooling follow-ups can validate an already-built candidate, but no
  // application, dependency or compiler configuration may have changed.
  for(const path of ['src','core','src-tauri','public','index.html','package-lock.json','bun.lock','svelte.config.js','tsconfig.json','vite.config.ts'])if(git('rev-parse',`${checks.headSha}:${path}`)!==git('rev-parse',`${candidate.headSha}:${path}`))throw new Error(`Checks validate different build inputs: ${path}`);
  const manifest=commit=>{const value=JSON.parse(git('show',`${commit}:package.json`));delete value.scripts;return JSON.stringify(value);};
  if(manifest(checks.headSha)!==manifest(candidate.headSha))throw new Error('Checks validate different package metadata/dependencies');
  // A UI-only follow-up may reuse Core measurements. Record both revisions and
  // require the exact Core tree and measurement workflow to be unchanged.
  for(const path of ['core','.github/workflows/resources.yml'])if(git('rev-parse',`${resources.headSha}:${path}`)!==git('rev-parse',`${candidate.headSha}:${path}`))throw new Error(`Resource evidence is stale: ${path}`);
  const output=await freshOutput(options.output);
  for(const [kind,run] of [['candidate',candidate],['resources',resources],['startup',startup]]){
    console.log(`Downloading ${kind}: ${run.url}`);
    gh('run','download',String(run.databaseId),'--dir',join(output,kind));
  }
  const verified=[];
  for(const target of Object.keys(targets))verified.push(await verifyCandidate(join(output,'candidate',`chest-candidate-${target}-${candidate.headSha}`),candidate.headSha,target));
  if(process.platform==='darwin')command('python3',['scripts/inspect-candidate-installers.py','--bundle',join(output,'candidate'),'--version',JSON.parse(git('show',`${candidate.headSha}:package.json`)).version,'--output',join(output,'installer-inspection.json')]);
  const measurements=[];
  for(const target of nativeTargets){
    const directory=join(output,'startup',`chest-native-startup-${target}-${candidate.headSha}`);
    if((await json(join(directory,'identity.json'))).candidateCommit!==candidate.headSha)throw new Error('Native startup source mismatch');
    const row={target};
    for(const count of [0,1000]){
      const data=await json(join(directory,`native-${count}.json`));
      if(data.instances!==count||data.samples.length!==3||data.samples.some(sample=>!sample.stages.some(stage=>stage.stage==='library-rendered')))throw new Error('Incomplete native readiness evidence');
      row[count]=data.samples.map(sample=>sample.processToLibraryMs).sort((a,b)=>a-b)[1];
    }
    measurements.push(row);
  }
  const resourceRows=[];
  for(const [index,platform] of platforms.entries()){
    const os=['macos-latest','windows-latest','ubuntu-latest'][index];
    const directory=join(output,'resources',`chest-resources-${os}-${resources.headSha}`);
    const host=await json(join(directory,'resource-host.json'));
    if(host.commit!==resources.headSha||host.platform!==platform)throw new Error('Resource host/source mismatch');
    const samples=(await readFile(join(directory,'resource-workloads.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    resourceRows.push({host,samples});
  }
  await save(join(output,'artifact-verification.json'),verified);
  await save(join(output,'native-startup-summary.json'),measurements);
  await save(join(output,'resource-summary.json'),resourceRows);
  await save(join(output,'handoff.json'),{source:candidate.headSha,tooling:{checkout:git('rev-parse','HEAD'),auditScriptSha256:await digest('scripts/audit-candidate.mjs'),installerInspectorSha256:await digest('scripts/inspect-candidate-installers.py')},runs:{candidate,checks,resources,startup},humanVerification:'pending',releasePublished:false});
  console.log(`Evidence verified: ${output}. STOP for human verification; no release/tag was created.`);
}
async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:Object.fromEntries(['output','candidate','check','resources','startup'].map(name=>[name,{type:'string'}]))});
  if(positionals.length!==1||!['local','collect'].includes(positionals[0]))throw new Error('Usage: npm run audit:candidate -- local|collect --output NEW_DIRECTORY [--candidate RUN --check RUN --resources RUN --startup RUN]');
  if(positionals[0]==='local')await local(await freshOutput(values.output));else await collect(values);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
