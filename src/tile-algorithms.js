import {addOutline} from './core.js';
import {swap,mapTexture} from './primitives.js';
export function processTile(data,w,h,{kind='outline',radius=1,color,options={}}){if(kind==='swap')return swap(data,w,h,options);if(kind==='texture')return mapTexture(data,w,h,options);return addOutline(data,w,h,radius,color);}
