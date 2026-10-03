// Synthetic browser fixtures only. Never imported by production or the scheduled collector.
import {createDevServer} from '../tools/platform/dev-server.mjs';
import {saveCommunity} from '../platform/hardware-community.js';
const app=await createDevServer({port:Number(process.argv[2])}),now=Date.now();
for(const [source,country,currency] of [['giggle','KR','KRW'],['hardforum','US','USD'],['hardwarefr','FR','EUR']]){
 const model=country==='FR'?'RTX 5070 Ti':'RTX 4060';
 const items=Array.from({length:5},(_,n)=>({id:`${source}:${n}`,source,postId:String(n),url:source==='giggle'?`https://gigglehd.com/gg/${n+1}`:source==='hardforum'?`https://hardforum.com/threads/fixture.${n+1}/`:`https://forum.hardware.fr/hfr/AchatsVentes/Hardware/fixture-sujet_${n+1}_1.htm`,country,currency,model,capacity:country==='FR'?'16':'8',price:country==='KR'?200000+n*10000:200+n*100,shipping:null,basis:'asking'}));
 await saveCommunity(app.env.DB,[{source,country,status:'ok',observedAt:now,items,posts:[],fetches:[],excluded:0}]);
 if(country==='KR')await saveCommunity(app.env.DB,[{source,country,status:'ok',observedAt:now+1,items:items.slice(0,1).map(i=>({...i,basis:'sold'})),posts:[],fetches:[],excluded:0}]);
}
console.log(`Community fixture server: ${app.origin}`);
