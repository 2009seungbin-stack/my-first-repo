// @ts-check
import {defineVertical,prop,values,COMMON_PROPS} from './_define.js';
export default defineVertical({
 id:'hardware',icon:'chip',maturity:'BETA',
 label:{en:'Hardware',ko:'하드웨어'},
 tagline:{en:'GPUs for AI and creators: what fits, measured by the community',ko:'AI·창작용 GPU: 무엇이 돌아가는지, 커뮤니티 측정으로'},
 hubTypes:['gpu','vendor'],
 types:{
  gpu:{label:{en:'GPU',ko:'그래픽카드'},plural:{en:'GPUs',ko:'그래픽카드'},icon:'chip',props:['release_date','segment','architecture','vram_gb','memory_type','memory_bus_bits','memory_bandwidth_gbs','shader_units','boost_clock_mhz','board_power_w','launch_price_usd','pcie','fp16_tflops'],sections:['overview','specs','ai','benchmarks','changes','community'],reportKinds:['benchmark','issue'],tools:['vram-fit'],indexMin:4},
  vendor:{label:{en:'Vendor',ko:'제조사'},plural:{en:'Vendors',ko:'제조사'},icon:'building',props:['hq_country','homepage'],sections:['overview','products','changes'],indexMin:3},
  // n2-data-hardware: GPU driver release branches (collector nvidia-datacenter-drivers).
  driver:{label:{en:'Driver',ko:'드라이버'},plural:{en:'Drivers',ko:'드라이버'},icon:'chip',props:['branch_type','latest_version','release_date','homepage'],sections:['overview','versions','changes'],indexMin:2},
 },
 properties:{
  ...COMMON_PROPS,
  hq_country:prop({en:'Headquarters',ko:'본사'},'text',{volatility:'static'}),
  segment:prop({en:'Segment',ko:'구분'},'enum',{values:values({desktop:['Desktop','데스크톱'],laptop:['Laptop','노트북'],workstation:['Workstation','워크스테이션'],datacenter:['Data center','데이터센터']}),volatility:'static',group:'specs'}),
  architecture:prop({en:'Architecture',ko:'아키텍처'},'text',{volatility:'static',group:'specs'}),
  vram_gb:prop({en:'VRAM',ko:'VRAM'},'number',{unit:'GB',volatility:'static',group:'specs'}),
  memory_type:prop({en:'Memory type',ko:'메모리 종류'},'text',{volatility:'static',group:'specs'}),
  memory_bus_bits:prop({en:'Memory bus',ko:'메모리 버스'},'number',{unit:'bit',volatility:'static',group:'specs'}),
  memory_bandwidth_gbs:prop({en:'Memory bandwidth',ko:'메모리 대역폭'},'number',{unit:'GB/s',volatility:'static',group:'specs'}),
  shader_units:prop({en:'Shader units',ko:'셰이더 유닛'},'text',{volatility:'static',group:'specs'}),
  boost_clock_mhz:prop({en:'Boost clock',ko:'부스트 클럭'},'number',{unit:'MHz',volatility:'static',group:'specs'}),
  board_power_w:prop({en:'Board power',ko:'보드 전력'},'number',{unit:'W',volatility:'static',group:'specs'}),
  launch_price_usd:prop({en:'Launch price (MSRP)',ko:'출시가 (MSRP)'},'money',{unit:'USD',volatility:'static',group:'specs'}),
  pcie:prop({en:'Interface',ko:'인터페이스'},'text',{volatility:'static',group:'specs'}),
  latest_version:prop({en:'Latest version',ko:'최신 버전'},'text',{volatility:'fast'}),
  branch_type:prop({en:'Branch type',ko:'브랜치 유형'},'enum',{values:values({production:['Production branch','프로덕션 브랜치'],lts:['Long-term support branch','장기 지원(LTS) 브랜치'],new_feature:['New feature branch','신기능 브랜치']}),volatility:'slow'}),
  fp16_tflops:prop({en:'FP16',ko:'FP16'},'number',{unit:'TFLOPS',volatility:'static',group:'specs'}),
 },
});
