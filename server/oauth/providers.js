// @ts-check
/** Sign-in providers (OAuth 2.0 authorization-code flow). A provider module only turns a code into a
 * verified profile; server/oauth/flow.js owns state, PKCE, cookies, identities and sessions.
 * A provider is offered only when both its client id (variable) and client secret (secret) are set,
 * so Google stays dormant until GOOGLE_OAUTH_CLIENT_ID/SECRET exist. */
import {google} from './google.js';
import {github} from './github.js';
import {discord} from './discord.js';

/** @typedef {import('./util.js').ProviderId} ProviderId @typedef {import('./util.js').Provider} Provider @typedef {import('./util.js').Credentials} Credentials @typedef {import('./util.js').Upstream} Upstream */

/** Display order of the sign-in buttons. */
export const PROVIDER_IDS=/** @type {readonly ProviderId[]} */(Object.freeze(['google','github','discord']));
export const PROVIDERS=/** @type {Readonly<Record<ProviderId,Provider>>} */(Object.freeze({google,github,discord}));
/** @param {unknown} id @returns {id is ProviderId} */
export const isProvider=id=>typeof id==='string'&&/** @type {readonly string[]} */(PROVIDER_IDS).includes(id);

/** Client credentials per provider from the Pages environment. @param {Record<string,any>} env @returns {Record<ProviderId,Credentials>} */
export function providerCredentials(env={}){
 const pair=(/** @type {string} */ p)=>({clientId:String(env[`${p}_OAUTH_CLIENT_ID`]||'').trim(),clientSecret:String(env[`${p}_OAUTH_CLIENT_SECRET`]||'').trim()});
 return {google:pair('GOOGLE'),github:pair('GITHUB'),discord:pair('DISCORD')};
}
/** Providers with both a client id and a client secret, in display order. @param {{oauth:Record<ProviderId,Credentials>}} cfg @returns {ProviderId[]} */
export const configuredProviders=cfg=>PROVIDER_IDS.filter(id=>!!(cfg.oauth[id].clientId&&cfg.oauth[id].clientSecret));

/** Development E2E only (config.js honours OAUTH_TEST_ORIGIN solely on local development builds):
 * https://github.com/login/oauth/authorize → <origin>/github.com/login/oauth/authorize.
 * @param {string} origin @returns {Upstream} */
export function upstreamFor(origin){
 if(!origin)return url=>url;
 return url=>{const u=new URL(url);return `${origin}/${u.host}${u.pathname}${u.search}`;};
}
