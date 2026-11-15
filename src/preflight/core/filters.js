// @ts-check
/** Report filters. `null` matches every status; "problems" is everything that is neither ready nor not applicable.
 * @type {Record<string,string[]|null>} */
export const FILTERS={all:null,problems:['UPDATE_REQUIRED','CAUTION','LEGACY','DEPRECATED','UNKNOWN','BLOCKED'],updates:['UPDATE_REQUIRED'],
 caution:['CAUTION','LEGACY','DEPRECATED'],unknown:['UNKNOWN'],blocked:['BLOCKED'],ready:['READY']};
export const FILTER_ORDER=['all','problems','updates','caution','unknown','blocked','ready'];
/** Scorecard tile → filter. The caution tile already groups CAUTION, LEGACY and DEPRECATED. */
export const TILE_FILTER={READY:'ready',UPDATE_REQUIRED:'updates',CAUTION:'caution',UNKNOWN:'unknown',BLOCKED:'blocked'};
/** @param {string} status @param {string} filter */
export function matchesFilter(status,filter){
 const allowed=FILTERS[filter];
 if(allowed===undefined)return false;
 if(filter==='problems')return status!=='READY'&&status!=='NOT_APPLICABLE';
 return allowed===null||allowed.includes(status);
}
/** @param {{status:string}[]} components @returns {Record<string,number>} */
export function filterCounts(components){
 return Object.fromEntries(FILTER_ORDER.map(f=>[f,components.reduce((n,c)=>n+(matchesFilter(c.status,f)?1:0),0)]));
}
