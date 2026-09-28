// @ts-check
/** Helpers for vertical configs. A property definition:
 *  {label:{en,ko}, type, unit?, values?, volatility, group}
 *  type: number | text | date | bool | enum | list | money | url | tokens
 *  volatility → freshness SLA (days after which a value shows a stale warning):
 *   static: never · slow: 365 · medium: 90 · fast: 14 · live: 2 */
export const FRESHNESS_DAYS=Object.freeze({static:Infinity,slow:365,medium:90,fast:14,live:2});
/** @typedef {{en:string,ko:string,ja?:string}} Label */
/** @typedef {{label:Label,type:string,unit?:string,values?:Record<string,Label>,volatility:keyof typeof FRESHNESS_DAYS,group?:string,public?:boolean}} PropertyDef */
/** @typedef {{label:Label,plural:Label,icon:string,props:string[],sections?:string[],reportKinds?:string[],tools?:string[],indexMin?:number}} TypeDef */
/** @typedef {{id:string,label:Label,icon:string,maturity:'LIVE'|'BETA'|'EXPERIMENT'|'PAUSED',tagline:Label,types:Record<string,TypeDef>,properties:Record<string,PropertyDef>,hubTypes:string[]}} VerticalDef */
/** @param {Label} label @param {string} type @param {Partial<PropertyDef>} [more] @returns {PropertyDef} */
export const prop=(label,type,more={})=>({label,type,volatility:'slow',...more});
/** @param {Record<string,[string,string]>} o @returns {Record<string,Label>} */
export const values=o=>Object.fromEntries(Object.entries(o).map(([k,[en,ko]])=>[k,{en,ko}]));
/** @param {VerticalDef} v */
export const defineVertical=v=>Object.freeze(v);
/** Properties every entity type may carry. */
export const COMMON_PROPS=Object.freeze({
 status:prop({en:'Status',ko:'상태'},'enum',{values:values({active:['Active','활성'],upcoming:['Upcoming','예정'],preview:['Preview','프리뷰'],deprecated:['Deprecated','지원 종료 예정'],retired:['Retired','종료'],discontinued:['Discontinued','단종']}),volatility:'medium'}),
 release_date:prop({en:'Release date',ko:'출시일'},'date',{volatility:'static'}),
 homepage:prop({en:'Official site',ko:'공식 사이트'},'url',{volatility:'slow'}),
});
