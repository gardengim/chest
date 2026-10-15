type Translate=(key:string,values?:Record<string,string|number>)=>string;
// Translate the launcher's known progress formats, preserving filenames and
// unknown diagnostics verbatim rather than guessing at third-party messages.
export function activityText(text:string,translate:Translate):string {
  const verified=/^(.*?) · (\d+) \/ (\d+) files verified$/.exec(text);
  if(verified)return translate('{phase} · {verified} of {total} files verified',{phase:translate(verified[1]),verified:verified[2],total:verified[3]});
  const pack=/^Preparing modpack files · (\d+)\/(\d+)$/.exec(text);
  if(pack)return translate('Preparing modpack files · {current}/{total}',{current:pack[1],total:pack[2]});
  return translate(text);
}
