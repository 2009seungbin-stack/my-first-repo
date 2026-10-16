/** Browser-test-only server: substitute ONLY the external eBay service, not the app renderer.
 * These prices are synthetic fixtures. Nothing from this file is copied to the production Worker.
 */
import {createDevServer} from '../tools/platform/dev-server.mjs';
import {MARKETS} from '../src/hardware/market.js';
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname!=='api.ebay.com')return original(input,init);
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(url.pathname==='/identity/v1/oauth2/token')return json({access_token:'browser-fixture-token',expires_in:7200});
 if(url.pathname!=='/buy/browse/v1/item_summary/search')throw new Error('Unexpected test upstream route');
 const headers=new Headers(init?.headers),country=String(headers.get('X-EBAY-C-MARKETPLACE-ID')).replace('EBAY_',''),m=MARKETS.find(x=>x.id===country);
 if(!m?.ebay)throw new Error('Unexpected test marketplace');
 const q=url.searchParams.get('q');if(q==='RTX 9999')return json({error:'fixture failure'},500);
 if(q==='RTX 4070')return json({total:0});
 const row=(id,title,price)=>({itemId:String(id),title,itemWebUrl:`https://${m.ebay}/itm/${id}`,conditionId:'3000',buyingOptions:['FIXED_PRICE'],itemLocation:{country},price:{value:String(price),currency:m.currency}});
 return json({total:7,itemSummaries:[...Array.from({length:5},(_,i)=>({...row(i+1,`MSI RTX 4060 8GB used graphics card ${i+1}`,(i+1)*100),shippingOptions:i===0?[{shippingCost:{value:'0.00',currency:m.currency}}]:[]})),row(6,'RTX 4060 Ti',999),row(7,'RTX 4060 gaming PC',1999)]});
};
const app=await createDevServer({port:Number(process.argv[2])});
Object.assign(app.env,{EBAY_APP_ID:'browser-fixture-app',EBAY_CERT_ID:'browser-fixture-cert',EBAY_BROWSE_APPROVED:'on',EBAY_PRICE_STATS_APPROVED:'on',RATE_LIMITER:{limit:async()=>({success:true})}});
console.log(`Hardware market fixture server: ${app.origin}`);
