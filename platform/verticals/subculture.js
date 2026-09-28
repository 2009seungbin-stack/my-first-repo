// @ts-check
import {defineVertical,prop,values,COMMON_PROPS} from './_define.js';
export default defineVertical({
 id:'subculture',icon:'star',maturity:'EXPERIMENT',
 label:{en:'Subculture',ko:'서브컬처'},
 tagline:{en:'What is happening around the IPs you follow',ko:'팔로우한 IP에 지금 무슨 일이 있는지'},
 hubTypes:['franchise','work','character','event','collaboration','merchandise','voice_actor','creator','studio_org'],
 types:{
  franchise:{label:{en:'Franchise',ko:'프랜차이즈'},plural:{en:'Franchises',ko:'프랜차이즈'},icon:'layers',props:['homepage','origin_media'],sections:['overview','upcoming','works','characters','changes','community'],indexMin:3},
  work:{label:{en:'Work',ko:'작품'},plural:{en:'Works',ko:'작품'},icon:'film',props:['media_type','release_date','end_date','airing_status','episodes','homepage'],sections:['overview','upcoming','characters','changes','community'],indexMin:3},
  character:{label:{en:'Character',ko:'캐릭터'},plural:{en:'Characters',ko:'캐릭터'},icon:'user',props:[],sections:['overview','upcoming','merch','changes','community'],indexMin:3},
  creator:{label:{en:'Creator',ko:'원작자'},plural:{en:'Creators',ko:'원작자'},icon:'pen',props:['homepage'],sections:['overview','works','changes'],indexMin:3},
  voice_actor:{label:{en:'Voice actor',ko:'성우'},plural:{en:'Voice actors',ko:'성우'},icon:'mic',props:['agency','homepage'],sections:['overview','roles','upcoming','changes'],indexMin:3},
  studio_org:{label:{en:'Studio',ko:'제작사'},plural:{en:'Studios',ko:'제작사'},icon:'building',props:['homepage'],sections:['overview','works','changes'],indexMin:3},
  event:{label:{en:'Event',ko:'이벤트'},plural:{en:'Events',ko:'이벤트'},icon:'calendar',props:['homepage'],sections:['overview','changes','community'],indexMin:2},
  collaboration:{label:{en:'Collaboration',ko:'콜라보'},plural:{en:'Collaborations',ko:'콜라보'},icon:'link',props:['homepage'],sections:['overview','changes','community'],indexMin:2},
  merchandise:{label:{en:'Merchandise',ko:'굿즈'},plural:{en:'Merchandise',ko:'굿즈'},icon:'box',props:['manufacturer_name','price','preorder_start','preorder_end','release_date','homepage'],sections:['overview','changes','community'],indexMin:3},
 },
 properties:{
  ...COMMON_PROPS,
  origin_media:prop({en:'Original media',ko:'원작 매체'},'text',{volatility:'static'}),
  media_type:prop({en:'Media',ko:'매체'},'enum',{values:values({tv_anime:['TV anime','TV 애니메이션'],film:['Film','극장판'],manga:['Manga','만화'],webtoon:['Webtoon','웹툰'],light_novel:['Light novel','라이트노벨'],game:['Game','게임'],ona:['Web anime','웹 애니메이션']}),volatility:'static'}),
  end_date:prop({en:'End date',ko:'종료일'},'date',{volatility:'medium'}),
  airing_status:prop({en:'Airing',ko:'방영 상태'},'enum',{values:values({upcoming:['Upcoming','방영 예정'],airing:['Airing','방영 중'],finished:['Finished','완결'],hiatus:['On hiatus','휴재/휴방']}),volatility:'fast'}),
  episodes:prop({en:'Episodes',ko:'화수'},'number',{volatility:'medium'}),
  agency:prop({en:'Agency',ko:'소속사'},'text',{volatility:'slow'}),
  manufacturer_name:prop({en:'Manufacturer',ko:'제조사'},'text',{volatility:'static'}),
  price:prop({en:'Price',ko:'가격'},'money',{volatility:'medium'}),
  preorder_start:prop({en:'Pre-order opens',ko:'예약 시작'},'date',{volatility:'medium'}),
  preorder_end:prop({en:'Pre-order closes',ko:'예약 마감'},'date',{volatility:'medium'}),
 },
});
