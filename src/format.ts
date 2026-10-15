// Keep only the current locale's formatters; catalog and news rows reuse them.
let currentLocale='',numberFormat:Intl.NumberFormat,dateFormat:Intl.DateTimeFormat;
function formatters(locale:string){
  if(locale!==currentLocale){
    numberFormat=new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1});
    dateFormat=new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
    currentLocale=locale;
  }
}
export const compactNumber=(value:number,locale='en')=>{formatters(locale);return numberFormat.format(value);};
export const newsDate=(date:string,locale='en')=>{const value=new Date(date+'T00:00:00Z');if(Number.isNaN(value.getTime()))return date;formatters(locale);return dateFormat.format(value);};
