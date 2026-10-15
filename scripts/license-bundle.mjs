// Exact-text deduplication preserves package-specific notices and copyright lines.
export function sameLicenseText(left,right){
  const normalize=text=>text.replace(/\r\n?/g,'\n');
  return normalize(left)===normalize(right);
}
export function packLicenses({chest,notices}){
  const texts=[],indices=new Map();
  return {chest,texts,notices:notices.map(notice=>({...notice,texts:notice.texts.map(text=>{
    if(!indices.has(text)){indices.set(text,texts.length);texts.push(text);}
    return indices.get(text);
  })}))};
}
export function validateLicenses(bundle){
  if(!Array.isArray(bundle.texts) || !bundle.texts.every(text=>typeof text==='string'))throw new Error('Invalid license text table');
  for(const notice of bundle.notices)for(const index of notice.texts){
    if(!Number.isInteger(index) || index<0 || index>=bundle.texts.length)throw new Error(`Invalid license reference for ${notice.name}`);
  }
}
