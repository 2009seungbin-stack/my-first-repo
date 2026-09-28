import {handleApi} from './api.js';
import {errorResponse,ApiError} from './http.js';
import {secureResponse} from '../tools/ads-worker.mjs';
import BUILD from './build-info.js';
import {handlePlatformPage} from './platform/pages.js';
import {handlePlatformApi} from './platform/api.js';
/** Cloudflare Pages advanced-mode entry (dist/_worker.js/index.js).
 * The control plane only: accounts, sessions, entitlement, daily usage and billing
 * webhooks. It never receives, stores or processes user files.
 * _routes.json keeps static assets (JS, CSS, images, examples) off this Worker; HTML
 * reaches it only in advertising builds, which need a fresh CSP nonce per response. */
/** The ad CSP forbids forms (tool pages have none); platform pages post to their own origin. @param {Response} r */
function allowForms(r){const h=new Headers(r.headers),csp=h.get('Content-Security-Policy');if(csp)h.set('Content-Security-Policy',csp.replace("form-action 'none'","form-action 'self'"));return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/api/v1'||url.pathname.startsWith('/api/v1/'))return handleApi(request,env,ctx);
  if(BUILD.platform&&(url.pathname==='/api/v2'||url.pathname.startsWith('/api/v2/')))return handlePlatformApi(request,env,ctx);
  if(url.pathname==='/api'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/_worker.js'))return errorResponse(new ApiError('NOT_FOUND'));
  // Nerulio 2.0 channel/community pages (PLATFORM=on builds only); anything else is the static site.
  if(BUILD.platform){const page=await handlePlatformPage(request,env,ctx,{origin:BUILD.siteURL||url.origin});if(page)return BUILD.adsHtml?allowForms(await secureResponse(page)):page;}
  const response=await env.ASSETS.fetch(request);
  return BUILD.adsHtml?secureResponse(response):response;
 }
};
