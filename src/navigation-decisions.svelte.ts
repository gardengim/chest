import type {SettingsTab} from './ui-state';

export type ExitAction='close'|'quit'|'restart';
type Target={page:string}|{tab:SettingsTab}|{exit:ExitAction};
type DraftState={destination:string;settingsTab:SettingsTab;settingsDirty:boolean;settingsPending:boolean;creationDirty:boolean;creationPending:boolean};

// Own pending decisions in one place; saving and creating remain distinct workflows.
export class NavigationDecisions {
  settings=$state<Target|null>(null);
  creation=$state<{page:string}|{exit:ExitAction}|null>(null);
  constructor(private state:()=>DraftState){}

  allow(target:Target,completed=false):boolean {
    if(completed)return true;
    const state=this.state();
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
