/** The Studio's export-limit dialog: shown exactly when the server refuses a Free Studio export.
 * It never navigates this tab (Pro opens in a new one) and never touches the project: autosave
 * keeps running, and "Save project" writes the .nerulio file right from the dialog. */
import {h} from '../ui/dom.js';
import {modal} from '../ui/dialogs.js';
import {mt} from './strings.js';
import {waitParts} from './layout.js';
import {priceText} from '../../service-content.js';
export async function showStudioLimit(studio,root,{resetAt,used,limit,pricing,pricingURL}){
 const l=studio.locale,t=(k,v)=>mt(l,k,v);
 const {h:hh,m}=waitParts(Date.parse(resetAt)-Date.now());
 const price=pricing?.amount?` · ${priceText(pricing,l)}`:'';
 const body=h('div.st-limit-body',{},
  h('p',{'data-limit-body':''},t('limit.body',{used,limit,time:t('limit.hm',{h:hh,m})})),
  h('p.st-limit-safe',{},t('limit.safe')),
  pricingURL?h('div.st-limit-pro',{},h('strong',{},t('limit.pro')+price),h('ul',{},...t('limit.bullets').split('|').map(b=>h('li',{},b)))):'');
 const buttons=[{label:t('limit.close'),value:'close'}];
 if(studio.doc.assets.length)buttons.push({label:t('limit.save'),value:'save'});
 if(pricingURL)buttons.push({label:t('limit.upgrade'),value:'pro',primary:true});
 const dlg=modal(root,{title:t('limit.title'),body,buttons,className:'st-limit'});
 dlg.dialog.id='studioLimitDialog';
 const v=await dlg.done;
 if(v==='save')studio.runCommand('file.save');
 else if(v==='pro')window.open(pricingURL,'_blank','noopener');
 return v;
}
