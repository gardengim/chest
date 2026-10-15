import type {Tab} from './types';
import type {SettingsTab} from './ui-state';

export type ExitAction='close'|'quit'|'restart';
export type Target={page:string}|{tab:SettingsTab}|{exit:ExitAction}|{instanceTab:Tab};
type DraftState={destination:string;settingsTab:SettingsTab;settingsDirty:boolean;settingsPending:boolean;creationDirty:boolean;creationPending:boolean;instanceDirty?:boolean;instancePending?:boolean;instanceTab?:Tab};

// Own pending decisions in one place; saving and creating remain distinct workflows.
export class NavigationDecisions {
  instance=$state<Target|null>(null);
  settings=$state<Target|null>(null);
  creation=$state<{page:string}|{exit:ExitAction}|null>(null);
  constructor(private state:()=>DraftState){}

  allow(target:Target,completed=false):boolean {
    if(completed)return true;
    const state=this.state();
    const leavingInstance='exit' in target || ('instanceTab' in target?target.instanceTab!==state.instanceTab:'page' in target?target.page!==state.destination:false);
    if(leavingInstance && (state.instanceDirty || state.instancePending)){this.instance=target;return false;}
    if('instanceTab' in target)return true;
    const leavingSettings='exit' in target || ('tab' in target?target.tab!=='Settings':target.page!=='profile');
    if(state.destination==='profile' && state.settingsTab==='Settings' && leavingSettings && (state.settingsDirty || state.settingsPending)){
      this.settings=target;
      return false;
    }
    if(!('tab' in target) && state.destination==='create' && ('exit' in target || target.page!=='create') && (state.creationDirty || state.creationPending)){
      this.creation=target;
      return false;
    }
    return true;
  }
}
