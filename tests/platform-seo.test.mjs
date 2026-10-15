import test from 'node:test';
import assert from 'node:assert/strict';
import {entityIndexable} from '../platform/seo.js';
import {pageJsonLd} from '../platform/render/page-seo.js';
import {channelJsonLd,postJsonLd,schemaText} from '../platform/render/jsonld.js';
import {page} from '../platform/render/ui.js';
import {platformMarkupProblems} from '../tools/audit-platform-seo.mjs';
import {sfxPage} from '../tools/sfx-build.mjs';

const origin='https://nerulio.example.test',canonical=origin+'/en/ai/example/';
const metadata={l:'en',title:'Example service | Nerulio',description:'Sourced service details',canonical};
const entity={id:'service:example',vertical:'ai',type:'service',names:{en:'Example'},descriptions:{ko:'한국어 설명'},official_urls:[],index_state:'auto'};

test('content gates use only the description displayed in that language, including English fallback',()=>{
 const counts={facts:3,relations:0,posts:0};
 assert.equal(entityIndexable(entity,counts,'ko'),true);
 assert.equal(entityIndexable(entity,counts,'en'),false);
 const english={...entity,descriptions:{en:'English description'}};
 for(const l of ['ko','en'])assert.equal(entityIndexable(english,counts,l),true);
 assert.equal(entityIndexable({...entity,descriptions:{ko:'   '}},counts,'ko'),false);
 assert.equal(entityIndexable({...english,index_state:'noindex'},counts,'en'),false);
});

test('page graphs retain specialized page identity, publisher and breadcrumbs without duplicate page nodes',()=>{
 const schema=channelJsonLd(entity,[],'en',canonical,origin);
 const graph=pageJsonLd({...metadata,jsonld:schema})['@graph'];
 const pages=graph.filter(n=>n['@id']===canonical+'#webpage');
 assert.equal(pages.length,1);assert.equal(pages[0]['@type'],'CollectionPage');
 assert.equal(pages[0].url,canonical);assert.equal(pages[0].publisher['@id'],origin+'/#organization');
 assert(graph.some(n=>n['@id']===pages[0].breadcrumb['@id']));
 assert.equal(graph.filter(n=>n['@type']==='WebSite').length,1);
 assert.equal(graph.filter(n=>n['@type']==='Organization').length,1);
 assert(!JSON.stringify(graph).includes('aggregateRating'));
});

const post={locale:'en',kind:'question',title:'How do I fix this?',body_md:'Use `x < y` & **details**.',created_at:1700000000000,edited_at:null,author_name:'Reader',anon_id:null,up:2,bot:false};
const comment={id:'answer',parent_id:null,body_md:'Use **nearest** filtering.',created_at:1700000001000,edited_at:null,author_name:'Helper',up:1,deleted:false};
const strings={anonymous:'Anonymous'};

test('questions keep accepted and suggested answers inside the canonical QAPage graph',()=>{
 const url=origin+'/en/community/studio/1';
 const jsonld=postJsonLd({post:{...post,solved:'answer'},channel:'studio',comments:[comment,{...comment,id:'deleted',deleted:true}]},url,strings);
 const graph=pageJsonLd({...metadata,canonical:url,jsonld})['@graph'];
 const qa=graph.find(n=>n['@type']==='QAPage');
 assert.equal(qa['@id'],url+'#webpage');assert.equal(qa.mainEntity.answerCount,1);
 assert.equal(qa.mainEntity.acceptedAnswer.text,'Use nearest filtering.');
 assert.equal(qa.mainEntity.acceptedAnswer.url,url+'#c-answer');
 assert.deepEqual(qa.mainEntity.suggestedAnswer,[]);
 assert.equal(graph.filter(n=>n['@id']===url+'#webpage').length,1);
});

test('forum metadata preserves nested replies and code text and distinguishes collector posts',()=>{
 const url=origin+'/en/community/studio/2',model={post:{...post,kind:'free'},channel:'studio',comments:[comment,{...comment,id:'reply',parent_id:'answer'}]};
 const forum=postJsonLd(model,url,strings);
 assert.equal(forum['@type'],'DiscussionForumPosting');assert.equal(forum.commentCount,2);
 assert.equal(forum.comment[0].comment[0]['@id'],url+'#c-reply');
 assert.equal(schemaText(post.body_md),'Use x < y & details.');
 const collected=postJsonLd({...model,post:{...post,bot:true}},url,strings);
 assert.equal(collected['@type'],'Article');assert.equal(collected.author['@type'],'Organization');
 assert(!('digitalSourceType' in collected),'collection does not establish how source content was created');
});

test('page shell safely serializes user content and keeps noindex pages out of the base search graph',()=>{
 const dangerous='</script><script>alert(1)</script>';
 const out=String(page({...metadata,title:dangerous,channels:[],body:'Body',jsonld:{'@type':'Article',headline:dangerous}}));
 assert(!out.includes(dangerous));
 const ld=JSON.parse(out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(ld['@graph'].find(n=>n['@type']==='Article').headline,dangerous);
 const hidden=String(page({...metadata,noindex:true,channels:[],body:'Private'}));
 assert.match(hidden,/content="noindex,follow"/);assert(!hidden.includes('application/ld+json'));
});

test('platform audit reads the document head while still rejecting duplicate page titles and missing H1',()=>{
 const markup='<html><head><title>Service</title><meta name="description" content="Details"></head><body><h1>Service</h1><svg><title>Uptime chart</title></svg></body></html>';
 assert.deepEqual(platformMarkupProblems(canonical,markup),[]);
 assert(platformMarkupProblems(canonical,markup.replace('</head>','<title>Duplicate</title></head>')).includes('expected one title'));
 assert(platformMarkupProblems(canonical,markup.replace('<h1>Service</h1>','')).includes('expected one H1'));
});

test('SFX previews are noindex while production pages retain their canonical URL',()=>{
 const preview=sfxPage({locale:'en',base:'../../../',siteURL:origin+'/',preview:true});
 assert.match(preview,/name="robots" content="noindex,nofollow"/);
 const production=sfxPage({locale:'en',base:'../../../',siteURL:origin+'/'});
 assert(!production.includes('noindex'));
 assert(production.includes(`rel="canonical" href="${origin}/en/game/sfx-generator/"`));
});
