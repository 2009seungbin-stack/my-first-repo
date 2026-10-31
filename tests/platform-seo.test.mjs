import test from 'node:test';
import assert from 'node:assert/strict';
import {entityIndexable,historyIndexable} from '../platform/seo.js';
import {pageJsonLd} from '../platform/render/page-seo.js';
import {channelJsonLd,postJsonLd,schemaText} from '../platform/render/jsonld.js';
import {page} from '../platform/render/ui.js';
import {platformMarkupProblems} from '../tools/audit-platform-seo.mjs';
import {sfxPage} from '../tools/sfx-build.mjs';

const origin='https://nerulio.example.test',canonical=origin+'/en/ai/example/';
const metadata={l:'en',title:'Example service | Nerulio',description:'Sourced service details',canonical};
const entity={id:'service:example',vertical:'ai',type:'service',names:{en:'Example'},descriptions:{ko:'한국어 설명'},official_urls:[],index_state:'auto'};

const words=n=>Array.from({length:n},(_,i)=>`word${i}`).join(' ');
const none={posts:0,contributions:0};

test('content gate: collected-only entities are noindex; posts, editor text, contributions or a manual override index',()=>{
 // Facts and relations are shown on the page but are not content for the gate.
 assert.equal(entityIndexable(entity,{facts:50,relations:20,posts:0,contributions:0},'ko'),false);
 // A short editor description is not enough; a long one is, in its own language only.
 assert.equal(entityIndexable({...entity,descriptions:{ko:'한'.repeat(299)}},none,'ko'),false);
 assert.equal(entityIndexable({...entity,descriptions:{ko:'한'.repeat(300)}},none,'ko'),true);
 assert.equal(entityIndexable({...entity,descriptions:{ko:'한'.repeat(300)}},none,'en'),false,'English pages never show a Korean-only description');
 assert.equal(entityIndexable({...entity,descriptions:{en:words(59)}},none,'en'),false);
 assert.equal(entityIndexable({...entity,descriptions:{en:words(60)}},none,'en'),true);
 assert.equal(entityIndexable({...entity,descriptions:{en:words(60)}},none,'ko'),true,'Korean pages may display the English fallback');
 assert.equal(entityIndexable({...entity,descriptions:{ko:'한'.repeat(300),en:'Short.'}},none,'en'),false);
 assert.equal(entityIndexable({...entity,descriptions:{ko:'   '}},none,'ko'),false);
 // A description composed from collected data (Steam blurb) never counts, however long.
 const collected={...entity,descriptions:{ko:'한'.repeat(400),en:words(80)},description_src:{ko:'collected',en:'collected'}};
 for(const l of ['ko','en'])assert.equal(entityIndexable(collected,none,l),false,l);
 assert.equal(entityIndexable({...collected,description_src:{en:'collected'}},none,'ko'),true,'the Korean text was written by an editor');
 // Community: three posts by people, or three accepted contributions.
 assert.equal(entityIndexable(entity,{posts:2,contributions:2},'ko'),false);
 for(const l of ['ko','en']){
  assert.equal(entityIndexable(entity,{posts:3,contributions:0},l),true);
  assert.equal(entityIndexable(entity,{posts:0,contributions:3},l),true);
 }
 // Manual overrides: noindex always wins, index always lists.
 assert.equal(entityIndexable({...entity,index_state:'index'},none,'en'),true);
 assert.equal(entityIndexable({...entity,index_state:'noindex',descriptions:{en:words(90)}},{posts:9,contributions:9},'en'),false);
});

test('a change history follows its entity and needs three editorial changes of its own',()=>{
 const rich={...entity,index_state:'index'};
 assert.equal(historyIndexable(rich,{editorial_changes:3},'en'),true);
 assert.equal(historyIndexable(rich,{editorial_changes:2},'en'),false);
 assert.equal(historyIndexable(entity,{editorial_changes:40},'en'),false,'a non-indexable parent has no indexable history');
 assert.equal(historyIndexable({...rich,index_state:'noindex'},{editorial_changes:40},'en'),false);
 assert.equal(historyIndexable({...entity,descriptions:{en:words(60)}},{editorial_changes:3},'ko'),true);
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

test('merged navigation keeps reference pages in the portal and standalone Preflight links static',()=>{
 const options={...metadata,channels:[],body:'Content'};
 const portal=String(page(options));
 assert(portal.includes('href="/en/ai/"'));
 assert(portal.includes('href="/en/bracket/"'));
 const standalone=String(page({...options,toolsOnly:true}));
 assert(standalone.includes('href="/en/preflight/obs/"'));
 assert(!standalone.includes('href="/en/ai/"'));
 assert(!standalone.includes('href="/en/bracket/"'));
});

test('SFX previews are noindex while production pages retain their canonical URL',()=>{
 const preview=sfxPage({locale:'en',base:'../../../',siteURL:origin+'/',preview:true});
 assert.match(preview,/name="robots" content="noindex,nofollow"/);
 const production=sfxPage({locale:'en',base:'../../../',siteURL:origin+'/'});
 assert(!production.includes('noindex'));
 assert(production.includes(`rel="canonical" href="${origin}/en/game/sfx-generator/"`));
});
