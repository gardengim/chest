import {defaultLaunchSettings,type LaunchSettings} from './types';
import type {LaunchDraft} from './ui-state';

export function setLaunchDraft(draft:LaunchDraft,value:LaunchSettings){
  draft.settings={...defaultLaunchSettings(),...value};
  draft.account=value.account_id || '';
  draft.javaArgs=value.java_args.join('\n');draft.gameArgs=value.game_args.join('\n');
  draft.environment=Object.entries(value.environment).map(([key,val])=>`${key}=${val}`).join('\n');
  draft.before=value.before_launch.join('\n');draft.after=value.after_exit.join('\n');
}
// Compare editable text too, so invalid or unfinished input still triggers the guard.
export const launchDraftValue=(draft:LaunchDraft)=>JSON.stringify([draft.settings,draft.account,draft.javaArgs,draft.gameArgs,draft.environment,draft.before,draft.after]);
export const launchDraftDirty=(draft:LaunchDraft|undefined)=>!!draft?.loaded && launchDraftValue(draft)!==draft.baseline;
export function readLaunchDraft(draft:LaunchDraft):LaunchSettings{
  const lines=(text:string)=>text.split(/\r?\n/).filter(line=>line.length>0);
  const environment:Record<string,string>={};
  for(const line of lines(draft.environment)){
    const index=line.indexOf('=');
    if(index<1)throw new Error('Use NAME=value for each environment variable.');
    const key=line.slice(0,index);
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || Object.hasOwn(environment,key))throw new Error('Use unique environment variable names.');
    Object.defineProperty(environment,key,{value:line.slice(index+1),enumerable:true});
  }
  return {...draft.settings,account_id:draft.account || null,java_args:lines(draft.javaArgs),game_args:lines(draft.gameArgs),environment,before_launch:lines(draft.before),after_exit:lines(draft.after)};
}
