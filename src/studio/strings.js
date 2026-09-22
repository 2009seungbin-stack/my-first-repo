const S={en:{menu:{file:'File'},status:{zoom:'{z}%'}},ko:{menu:{file:'파일'},status:{zoom:'{z}%'}},ja:{menu:{file:'ファイル'},status:{zoom:'{z}%'}}};
export function st(locale,key,vars={}){const get=o=>key.split('.').reduce((a,k)=>a?.[k],o);const v=get(S[locale]||S.en)??get(S.en)??key;return String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');}
export const STUDIO_STRINGS=S;
