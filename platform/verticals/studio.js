// @ts-check
import {defineVertical,prop,values,COMMON_PROPS} from './_define.js';
export default defineVertical({
 id:'studio',icon:'sliders',maturity:'BETA',
 label:{en:'Studio',ko:'스튜디오'},
 tagline:{en:'DAWs, plugins and creative apps: is it safe to upgrade?',ko:'DAW·플러그인·창작 앱: 지금 업그레이드해도 될까?'},
 hubTypes:['app','plugin','os_release','vendor','audio_device'],
 types:{
  app:{label:{en:'App',ko:'앱'},plural:{en:'Apps',ko:'앱'},icon:'app',props:['latest_version','release_date','os_support','min_macos','min_windows','apple_silicon','plugin_formats','license_model','homepage'],sections:['overview','compat','versions','changes','community'],reportKinds:['compat','issue'],indexMin:3},
  plugin:{label:{en:'Plugin',ko:'플러그인'},plural:{en:'Plugins',ko:'플러그인'},icon:'plug',props:['latest_version','formats','os_support','min_macos','min_windows','apple_silicon','homepage'],sections:['overview','compat','versions','changes','community'],reportKinds:['compat','issue'],indexMin:3},
  os_release:{label:{en:'OS release',ko:'OS 버전'},plural:{en:'OS releases',ko:'OS 버전'},icon:'monitor',props:['release_date','os_family','version_number','cpu_arch','status'],sections:['overview','compat','changes'],indexMin:2},
  vendor:{label:{en:'Developer',ko:'개발사'},plural:{en:'Developers',ko:'개발사'},icon:'building',props:['hq_country','homepage'],sections:['overview','products','changes'],indexMin:3},
  audio_device:{label:{en:'Audio interface',ko:'오디오 인터페이스'},plural:{en:'Audio interfaces',ko:'오디오 인터페이스'},icon:'speaker',props:['latest_driver','os_support','homepage'],sections:['overview','compat','versions','changes','community'],reportKinds:['compat','issue'],indexMin:3},
 },
 properties:{
  ...COMMON_PROPS,
  hq_country:prop({en:'Headquarters',ko:'본사'},'text',{volatility:'static'}),
  latest_version:prop({en:'Latest version',ko:'최신 버전'},'text',{volatility:'fast',group:'versions'}),
  latest_driver:prop({en:'Latest driver',ko:'최신 드라이버'},'text',{volatility:'fast',group:'versions'}),
  os_support:prop({en:'Operating systems',ko:'운영체제'},'list',{volatility:'medium'}),
  min_macos:prop({en:'Minimum macOS',ko:'최소 macOS'},'text',{volatility:'medium'}),
  min_windows:prop({en:'Minimum Windows',ko:'최소 Windows'},'text',{volatility:'medium'}),
  apple_silicon:prop({en:'Apple Silicon',ko:'Apple Silicon'},'enum',{values:values({native:['Native','네이티브'],rosetta:['Rosetta 2 only','Rosetta 2 필요'],none:['Not supported','미지원'],unknown:['Unknown','확인 안 됨']}),volatility:'medium'}),
  plugin_formats:prop({en:'Plugin formats hosted',ko:'지원 플러그인 포맷'},'list',{volatility:'medium'}),
  formats:prop({en:'Formats',ko:'포맷'},'list',{volatility:'medium'}),
  license_model:prop({en:'License',ko:'라이선스'},'text',{volatility:'slow'}),
  os_family:prop({en:'OS family',ko:'OS 계열'},'enum',{values:values({macos:['macOS','macOS'],windows:['Windows','Windows'],linux:['Linux','Linux']}),volatility:'static'}),
  version_number:prop({en:'Version',ko:'버전'},'text',{volatility:'static'}),
 cpu_arch:prop({en:'CPU architectures',ko:'CPU 아키텍처'},'list',{volatility:'static'}),
 },
});
