/** Official platform documents checked 2026-09-28. Advisory guides are separate from requirements.
 * Steam: https://partner.steamgames.com/doc/store/assets/standard
 * Library: https://partner.steamgames.com/doc/store/assets/libraryassets
 * Rules: https://partner.steamgames.com/doc/store/assets/rules
 * itch: https://itch.io/docs/creators/getting-started and /design
 * Google: https://support.google.com/googleplay/android-developer/answer/9866151
 * Apple: https://developer.apple.com/documentation/xcode/configuring-your-app-icon
 */
export const SPEC_DATE='2026-09-28';
const slot=(id,platform,w,h,{required=true,format='png',alpha=false,logo=false,text='title',guide='',source,notes=''}={})=>Object.freeze({id,platform,w,h,required,format,alpha,logo,text,guide,source,notes,path:`${platform}/${id}-${w}x${h}.${format==='jpeg'?'jpg':'png'}`});
const STEAM_STORE='https://partner.steamgames.com/doc/store/assets/standard';
const STEAM_LIBRARY='https://partner.steamgames.com/doc/store/assets/libraryassets';
const ITCH='https://itch.io/docs/creators/getting-started';
const PLAY='https://support.google.com/googleplay/android-developer/answer/9866151';
const APPLE='https://developer.apple.com/documentation/xcode/configuring-your-app-icon';
export const STORE_SLOTS=Object.freeze([
 slot('store-header','steam',920,430,{logo:true,source:STEAM_STORE}),
 slot('store-small','steam',462,174,{logo:true,guide:'small',source:STEAM_STORE}),
 slot('store-main','steam',1232,706,{logo:true,source:STEAM_STORE}),
 slot('store-vertical','steam',748,896,{logo:true,source:STEAM_STORE}),
 slot('library-capsule','steam',600,900,{logo:true,source:STEAM_LIBRARY}),
 slot('library-header','steam',920,430,{logo:true,source:STEAM_LIBRARY}),
 slot('library-hero','steam',3840,1240,{text:'none',guide:'hero',source:STEAM_LIBRARY,notes:'Artwork only; no text or baked logo.'}),
 slot('library-logo','steam',1280,720,{alpha:true,text:'logo-only',source:STEAM_LIBRARY,notes:'1280 wide and/or 720 tall; transparent logo-only PNG.'}),
 slot('page-background','steam',1438,810,{required:false,text:'none',source:STEAM_STORE}),
 slot('bundle-header','steam',707,232,{required:false,logo:true,source:STEAM_STORE}),
 slot('cover','itch',630,500,{source:ITCH}),
 slot('banner-suggested','itch',960,300,{required:false,source:'https://itch.io/docs/creators/design',notes:'Custom suggestion, not an official fixed size.'}),
 slot('icon','google-play',512,512,{alpha:true,text:'none',source:PLAY}),
 slot('feature','google-play',1024,500,{format:'jpeg',text:'optional',guide:'center-advisory',source:PLAY}),
 slot('icon-source','apple',1024,1024,{text:'none',source:APPLE,notes:'Xcode asset catalog source, not a standalone App Store upload.'})
]);
export const REQUIRED_SLOTS=Object.freeze(STORE_SLOTS.filter(s=>s.required).map(s=>s.id));
export const slotById=id=>STORE_SLOTS.find(s=>s.id===id);
export function validateSlotSpec(s){
 if(!s||!Number.isInteger(s.w)||!Number.isInteger(s.h)||s.w<1||s.h<1||!['png','jpeg'].includes(s.format))throw Error('Invalid store slot');
 if(s.id==='library-hero'&&s.text!=='none')throw Error('Library hero must contain no text');
 if(s.id==='feature'&&(s.alpha||s.w!==1024||s.h!==500))throw Error('Invalid Play feature graphic');
 return s;
}
