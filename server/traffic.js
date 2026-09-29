// @ts-check
/** PLACEHOLDER for the traffic module (branch nerulio/traffic owns the real server/traffic.js; the
 * coordinator replaces this file at integration). Same exports and signatures as the real one:
 * the admin overview gets traffic:null and GET /api/v2/admin/traffic answers 503 NOT_CONFIGURED to
 * admins (404 to everyone else, through the admin gate). */
import {ApiError,json,errorResponse} from './http.js';

/** Compact traffic numbers for the admin overview, or null when not configured.
 * @param {any} _env @param {number} [_now] @param {any} [_deps]
 * @returns {Promise<null|{humanPageviews:number,botRequests:number,aiBotRequests:number,topBot:null|{name:string,category:string,verified:boolean,requests:number}}>} */
export async function trafficSummary(_env,_now,_deps){return null;}

/** GET /api/v2/admin/traffic. `requireAdmin(request, env, ctx)` may throw an ApiError or return a
 * Response to refuse; without it the answer is 404.
 * @param {Request} request @param {any} env @param {any} ctx
 * @param {{requireAdmin?:(request:Request,env:any,ctx:any)=>any,now?:()=>number,fetch?:typeof fetch}} [o] */
export async function handleTraffic(request,env,ctx,o={}){
 try{
  if(typeof o.requireAdmin!=='function')throw new ApiError('NOT_FOUND');
  const gate=await o.requireAdmin(request,env,ctx);if(gate instanceof Response)return gate;
  const need='TRAFFIC';
  return json({need,missing:[need],error:{code:'NOT_CONFIGURED',message:'Traffic analytics are not part of this build yet.',need}},503);
 }catch(e){return errorResponse(e instanceof ApiError?e:new ApiError('INTERNAL'));}
}
