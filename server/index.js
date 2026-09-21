import {handleApi} from './api.js';
import {errorResponse,ApiError} from './http.js';
import {secureResponse} from '../tools/ads-worker.mjs';
import BUILD from './build-info.js';
/** Cloudflare Pages advanced-mode entry (dist/_worker.js/index.js).
 * The control plane only: accounts, sessions, entitlement, daily usage and billing
 * webhooks. It never receives, stores or processes user files.
 * _routes.json keeps static assets (JS, CSS, images, examples) off this Worker; HTML
 * reaches it only in advertising builds, which need a fresh CSP nonce per response. */
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/api/v1'||url.pathname.startsWith('/api/v1/'))return handleApi(request,env,ctx);
  if(url.pathname==='/api'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/_worker.js'))return errorResponse(new ApiError('NOT_FOUND'));
  const response=await env.ASSETS.fetch(request);
  return BUILD.adsHtml?secureResponse(response):response;
 }
};
