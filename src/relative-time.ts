// Browser localization supplies plural forms and RTL word order for every locale.
export function relativeTime(timestamp:number,language:string,now=Date.now()):string{
  if(!Number.isFinite(timestamp) || timestamp<=0)return '';
  const seconds=Math.max(0,(now-timestamp)/1000);
  if(seconds<60)return new Intl.RelativeTimeFormat(language,{numeric:'auto'}).format(0,'second');
  const units:[Intl.RelativeTimeFormatUnit,number][]=[['year',365*86400],['month',30*86400],['week',7*86400],['day',86400],['hour',3600],['minute',60]];
  const [unit,length]=units.find(([,length])=>seconds>=length)!;
  return new Intl.RelativeTimeFormat(language,{numeric:'always'}).format(-Math.floor(seconds/length),unit);
}
