// @ts-check
import {defineVertical,prop,values,COMMON_PROPS} from './_define.js';
export const KOREAN_SUPPORT=values({full_audio:['Korean interface, subtitles and audio','한국어 인터페이스·자막·음성'],interface_subtitles:['Korean interface and subtitles','한국어 인터페이스·자막'],none:['No official Korean','공식 한국어 없음'],unknown:['Unknown','확인 안 됨']});
export default defineVertical({
 id:'games',icon:'gamepad',maturity:'LIVE',
 label:{en:'Games',ko:'게임'},
 tagline:{en:'Korean support, translation patches and whether they still work',ko:'공식 한국어, 한글패치, 그리고 지금 버전에서 작동하는지'},
 hubTypes:['game','translation_patch','org'],
 types:{
  game:{label:{en:'Game',ko:'게임'},plural:{en:'Games',ko:'게임'},icon:'gamepad',props:['steam_appid','release_date','korean_official','official_languages','platforms','current_build','last_update_at','genres','homepage'],sections:['overview','korean','translations','versions','changes','community'],reportKinds:['compat','issue'],tools:['sprite-lab','pixel-lab','tile-lab','texture-lab','ui-lab'],indexMin:3},
  translation_patch:{label:{en:'Translation patch',ko:'번역 패치'},plural:{en:'Translation patches',ko:'한글패치'},icon:'languages',props:['patch_version','patch_language','author_name','distribution','verified_game_version','homepage','license_note'],sections:['overview','compat','versions','changes','community'],reportKinds:['compat'],indexMin:3},
  org:{label:{en:'Company',ko:'회사'},plural:{en:'Companies',ko:'회사'},icon:'building',props:['hq_country','homepage'],sections:['overview','works','changes'],indexMin:3},
 },
 properties:{
  ...COMMON_PROPS,
  steam_appid:prop({en:'Steam app id',ko:'Steam 앱 ID'},'number',{volatility:'static'}),
  korean_official:prop({en:'Official Korean',ko:'공식 한국어'},'enum',{values:KOREAN_SUPPORT,volatility:'medium',group:'korean'}),
  official_languages:prop({en:'Official languages',ko:'공식 지원 언어'},'list',{volatility:'medium'}),
  platforms:prop({en:'Platforms',ko:'플랫폼'},'list',{volatility:'medium'}),
  current_build:prop({en:'Current build',ko:'현재 빌드'},'text',{volatility:'live',group:'versions'}),
  last_update_at:prop({en:'Last update',ko:'마지막 업데이트'},'date',{volatility:'live',group:'versions'}),
  genres:prop({en:'Genres',ko:'장르'},'list',{volatility:'slow'}),
  hq_country:prop({en:'Headquarters',ko:'본사'},'text',{volatility:'static'}),
  patch_version:prop({en:'Patch version',ko:'패치 버전'},'text',{volatility:'fast'}),
  patch_language:prop({en:'Language',ko:'언어'},'text',{volatility:'static'}),
  author_name:prop({en:'Author',ko:'제작자'},'text',{volatility:'slow'}),
  distribution:prop({en:'Distribution',ko:'배포 방식'},'enum',{values:values({link_only:['Link to the author (Nerulio does not host files)','제작자 링크 (Nerulio는 파일을 올리지 않음)'],official_mod_platform:['Official mod platform','공식 모드 플랫폼']}),volatility:'slow'}),
  verified_game_version:prop({en:'Verified against game version',ko:'확인된 게임 버전'},'text',{volatility:'fast'}),
  license_note:prop({en:'Permission note',ko:'배포 허가 참고'},'text',{volatility:'slow'}),
 },
});
