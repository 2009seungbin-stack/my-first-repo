// @ts-check
/** Adapter-owned host mapping keeps OS-upgrade verticals out of core special cases.
 * @param {import('./types').Adapter} adapter @param {import('./types').Platform} platform */
export const hostName=(adapter,platform)=>adapter.hosts?.[platform]||adapter.host;
/** @param {import('./types').Adapter} adapter @param {string} name */
export const acceptsHost=(adapter,name)=>[adapter.host,...Object.values(adapter.hosts||{})].some(h=>h.toLowerCase()===name.toLowerCase());
