// @ts-check
/** Share cards of the status pages: one pre-rendered PNG per home status service × state × language
 * (assets/social/{l}-status-{slug}-{state}.png, 1200×630, made by tools/generate-status-cards.py from the
 * words below), so a shared "Claude 지금 안 돼요?" link shows "Claude · 리포트 급증" in the preview. Workers
 * cannot draw images; the status page picks the file for the state it shows. A card says only what the
 * page says at that moment: an official incident, a spike of user reports (labelled as such), no
 * official incident after a recent check, or nothing but the question. */
import {RAIL_SERVICES} from './render/rail.js';

/** @typedef {'bad'|'warn'|'ok'|'unk'} CardState */
export const CARD_STATES=/** @type {readonly CardState[]} */(Object.freeze(['bad','warn','ok','unk']));
export const CARD_LOCALES=Object.freeze(['ko','en']);
/** The services with cards and the slug of their pages. */
export const CARD_SERVICES=Object.freeze(RAIL_SERVICES.map(s=>({id:s.id,short:s.short,ko:s.ko,slug:s.id.replace(/^service:/,'')})));

/** The state line of a card. @param {CardState} state @param {string} l */
export function cardLabel(state,l){
 const ko=l==='ko';
 if(state==='bad')return ko?'공식 장애':'Official incident';
 if(state==='warn')return ko?'리포트 급증':'Reports spiking';
 if(state==='ok')return ko?'공식 장애 없음':'No official incident';
 return ko?'지금 안 돼요?':'Is it down?';
}
/** The line under it: where the state comes from. @param {CardState} state @param {string} l */
export function cardNote(state,l){
 const ko=l==='ko';
 if(state==='bad')return ko?'공식 상태 페이지에 장애가 올라왔어요':'Reported on the official status page';
 if(state==='warn')return ko?'Nerulio 사용자들의 ‘안 돼요’ 리포트가 평소보다 많아요':'More “not working” reports from Nerulio users than usual';
 if(state==='ok')return ko?'공식 상태 페이지 확인 · 사용자 리포트는 평소 수준':'Official status checked · user reports at the usual level';
 return ko?'공식 장애 기록과 사용자 리포트를 따로 확인하세요':'Official incidents and user reports, shown separately';
}
/** The card's path for a service in a state, or null (other services use the site card).
 * @param {string} entityId @param {string} state @param {string} l */
export function statusCardPath(entityId,state,l){
 const s=CARD_SERVICES.find(x=>x.id===entityId);
 if(!s||!CARD_STATES.includes(/** @type {CardState} */(state)))return null;
 return `/assets/social/${l==='ko'?'ko':'en'}-status-${s.slug}-${state}.png`;
}
/** Alt text of a card. @param {string} name @param {CardState} state @param {string} l */
export const cardAlt=(name,state,l)=>`${name} · ${cardLabel(state,l)}`;
