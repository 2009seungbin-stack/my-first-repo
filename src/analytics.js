import {INTENTS} from './intents.js';
import {LOCALES} from './i18n.js';

export const EVENTS = Object.freeze(['page_view','tool_open','file_selected','tool_run','tool_success','tool_error','download','related_tool_click','share_result','share_preset','language_change','account_status_loaded','quota_authorized','quota_denied','upgrade_view','checkout_started','checkout_completed','login_started','login_completed','logout','pro_active']);
let adapter = null;
let context = {};
/** No network, cookies, persistent IDs or event buffer without an explicit adapter. */
export function setAnalyticsAdapter(next) { adapter = typeof next === 'function' ? next : null; }
export function setAnalyticsContext(next) { context = {...next}; }
export function trafficSource(referrer,origin) {
  if (!referrer) return 'direct';
  try {
    const u = new URL(referrer);
    if (u.origin === origin) return 'internal';
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) return 'google';
    if (/(^|\.)bing\.com$/.test(u.hostname)) return 'bing';
    return 'referral';
  } catch { return 'direct'; }
}
/** Strict allowlist; arbitrary paths, referrer queries, errors and filenames are dropped. */
export function eventPayload(name,values={}) {
  if (!EVENTS.includes(name)) return null;
  const v={...context,...values}, out={event:name};
  for (const k of ['intent','landing_intent','target_intent']) if (Object.hasOwn(INTENTS,v[k])) out[k]=v[k];
  if (LOCALES.includes(v.language)) out.language=v.language;
  if (['mobile','desktop'].includes(v.device_class)) out.device_class=v.device_class;
  if (['direct','internal','google','bing','referral'].includes(v.traffic_source)) out.traffic_source=v.traffic_source;
  if (['image','pdf','media','mixed'].includes(v.file_kind)) out.file_kind=v.file_kind;
  if (Number.isInteger(v.count)) out.count=Math.min(100,Math.max(0,v.count));
  if (['native','download','copy','dialog'].includes(v.method)) out.method=v.method;
  if (['processing_failed','cancelled'].includes(v.error_code)) out.error_code=v.error_code;
  if (['free','pro'].includes(v.plan)) out.plan=v.plan;
  return Object.freeze(out);
}
export function track(name,values={}) {
  const data=eventPayload(name,values);
  if(data&&adapter) { try { adapter(data); } catch { /* Metrics cannot break editing. */ } }
  return data;
}
