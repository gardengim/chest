export const compactNumber=(value:number,locale='en')=>Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(value);

export const newsDate=(date:string,locale='en')=>{const value=new Date(date+'T00:00:00Z');return Number.isNaN(value.getTime())?date:new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(value);};
