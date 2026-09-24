/** PURE: where and how big the Studio's desktop ad column is, and whether a session gets it.
 * Rules (docs/ADS.md): one labelled unit in its own column to the right of the panels, only on
 * desktop-sized viewports, fixed size chosen once at mount (never resized, never refreshed). */
export const AD_MIN_WIDTH=1280;   // below this the editor keeps every pixel (tablets, small laptops, phones)
export const AD_MIN_HEIGHT=700;   // a 600 px unit + label must fit below the menu bar without scrolling
export const AD_WIDE_WIDTH=1600;  // from here the 300×600 unit; below it the 160×600 skyscraper
export const AD_GUTTER=20;        // clear space on each side of the unit inside the column (Photopea: ~19 px)
/** Unit size for a viewport, or null when the Studio shows no ad at that size. */
export function adUnitSize(width,height){
 if(!(width>=AD_MIN_WIDTH&&height>=AD_MIN_HEIGHT))return null;
 const w=width>=AD_WIDE_WIDTH?300:160;
 return {width:w,height:600,column:w+2*AD_GUTTER};
}
/** Session decision. `adConfig` = the build's Studio ad unit (or null); `entitlement` =
 * {enabled, status, me} from src/entitlement.js after the capped wait (status 'timeout' when
 * the answer did not arrive in time). Unknown or unreachable → no ad (conservative). */
export function adsForSession(adConfig,entitlement){
 if(!adConfig?.client||!adConfig?.slot)return {ads:false,reason:'not-configured'};
 if(!entitlement?.enabled)return {ads:true,reason:'no-accounts'};
 const {status,me}=entitlement;
 if(status==='unconfigured')return {ads:true,reason:'accounts-unconfigured'};
 if(status==='ready')return me?.ads===true?{ads:true,reason:'free'}:{ads:false,reason:me?.plan==='pro'?'pro':'server-says-no'};
 return {ads:false,reason:status==='timeout'?'timeout':'unreachable'};
}
/** Rectangles are {left,top,right,bottom} (DOMRect-like). Distance 0 means touching/overlap. */
export function rectDistance(a,b){
 const dx=Math.max(0,b.left-a.right,a.left-b.right),dy=Math.max(0,b.top-a.bottom,a.top-b.bottom);
 return Math.hypot(dx,dy);
}
/** Left position that keeps a popup of `width` out of the ad column that starts at `columnLeft`. */
export function clampLeftOfColumn(left,width,columnLeft,margin=4){
 return left+width>columnLeft-margin?Math.max(margin,columnLeft-margin-width):left;
}
/** Human wait until the reset instant. */
export function waitParts(ms){const m=Math.max(0,Math.ceil(ms/60e3));return {h:Math.floor(m/60),m:m%60};}
