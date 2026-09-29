import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeCbor,decodeCborPrefix,derToRaw,parseAuthData,coseAlg,makeChallenge,readChallenge,verifyRegistration,verifyAuthentication,WebAuthnError,ALG} from '../server/webauthn.js';
import {SoftAuthenticator,cbor,rawToDer} from './passkey-authenticator.mjs';

const hex=h=>Uint8Array.from(h.match(/../g)||[],x=>parseInt(x,16));
const SECRET='test-session-secret-0123456789abcdef-0123456789',ORIGIN='https://nerulio.test',RP='nerulio.test',T0=Date.UTC(2026,8,29,0,0);

test('CBOR: RFC 8949 Appendix A examples',()=>{
 const cases=[['00',0],['17',23],['1818',24],['190100',256],['1a000f4240',1000000],['1b000000e8d4a51000',1000000000000],['20',-1],['3863',-100],['6449455446','IETF'],['62c3bc','ü'],['f4',false],['f5',true],['f6',null],['fb3ff199999999999a',1.1]];
 for(const [h,v] of cases)assert.deepEqual(decodeCbor(hex(h)),v,h);
 assert.deepEqual(decodeCbor(hex('4401020304')),new Uint8Array([1,2,3,4]));
 assert.deepEqual(decodeCbor(hex('8301820203820405')),[1,[2,3],[4,5]]);
 const m=decodeCbor(hex('a201020304'));assert(m instanceof Map);assert.equal(m.get(1),2);assert.equal(m.get(3),4);
 assert.equal(decodeCbor(hex('a26161016162820203')).get('b')[1],3);
 assert.deepEqual(decodeCborPrefix(hex('0102')),{value:1,length:1});
 for(const bad of ['5f42010243030405ff','9fff','bf6161f5ff','1a0000','62c3','a20102','0102','a2010201ff'])assert.throws(()=>decodeCbor(hex(bad)),undefined,bad);
 assert.throws(()=>decodeCbor(hex('a201020103')),/duplicate/);
});

test('ECDSA DER ↔ raw',()=>{
 const raw=new Uint8Array(64);raw[0]=0x80;raw[31]=1;raw[32]=0;raw[33]=0x7f;raw[63]=2;
 assert.deepEqual(derToRaw(rawToDer(raw)),raw);
 assert.throws(()=>derToRaw(hex('3006020101020102ff')));
 assert.throws(()=>derToRaw(hex('310602010102010')));
});

test('stateless challenges: signed, expiring, tamper-evident',async()=>{
 const ch=await makeChallenge(SECRET,{p:'auth',n:'x'},T0);
 assert.equal((await readChallenge(SECRET,ch,T0+1000)).p,'auth');
 assert.equal(await readChallenge(SECRET,ch,T0+5*60e3+1),null,'expired');
 assert.equal(await readChallenge('another-secret-0123456789abcdef-0123456789',ch,T0),null,'other secret');
 assert.equal(await readChallenge(SECRET,ch.slice(0,-2)+(ch.endsWith('A')?'B':'A')+ch.slice(-1),T0),null,'tampered');
 assert.equal(await readChallenge(SECRET,'not-base64!!',T0),null);
 assert.notEqual(await makeChallenge(SECRET,{p:'auth'},T0),await makeChallenge(SECRET,{p:'auth'},T0),'random per call');
});

async function register(auth,o={}){
 const challenge=await makeChallenge(SECRET,{p:'reg'},T0);
 const cred=await auth.create({rp:{id:RP},user:{id:'aGFuZGxlLWhhbmRsZS0x'},challenge},{origin:ORIGIN,...o});
 return {cred,challenge};
}
const opts=(extra={})=>({origin:ORIGIN,rpId:RP,checkChallenge:async c=>readChallenge(SECRET,c,T0+1000),...extra});

for(const alg of ['ES256','RS256'])test(`${alg}: registration then authentication (real keys, fmt none)`,async()=>{
 const auth=new SoftAuthenticator({alg});
 const {cred}=await register(auth);
 const r=await verifyRegistration(cred,opts());
 assert.equal(r.alg,alg==='ES256'?ALG.ES256:ALG.RS256);assert.equal(r.credentialId,cred.id);assert.equal(r.fmt,'none');assert.equal(r.uv,true);
 assert.deepEqual(r.transports,['internal','hybrid']);
 assert.equal(coseAlg(Uint8Array.from(atob(r.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((r.publicKey.length+3)%4)),c=>c.charCodeAt(0))),r.alg);
 const stored={publicKey:r.publicKey,signCount:0};
 const challenge=await makeChallenge(SECRET,{p:'auth'},T0);
 const a=await auth.get({challenge,rpId:RP},{origin:ORIGIN});
 const v=await verifyAuthentication(a,opts({getCredential:async id=>id===r.credentialId?stored:null}));
 assert.equal(v.credentialId,r.credentialId);assert.equal(v.userHandle,'aGFuZGxlLWhhbmRsZS0x');assert.equal(v.signCount,0);
 // Tampered signature.
 const bad=structuredClone(a);const s=bad.response.signature;bad.response.signature=s.slice(0,10)+(s[10]==='A'?'B':'A')+s.slice(11);
 await assert.rejects(verifyAuthentication(bad,opts({getCredential:async()=>stored})),WebAuthnError);
});

test('registration is refused on every mismatch',async()=>{
 const auth=new SoftAuthenticator();
 const cases=[
  [{origin:'https://evil.example'},/origin/],
  [{rpId:'evil.example'},/rpId/],
  [{type:'webauthn.get'},/ceremony type/],
  [{crossOrigin:true},/cross-origin/],
  [{flags:0x04|0x40},/not present/],
  [{flags:0x01|0x04},/attested/],
  [{idOverride:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'},/credential id/],
 ];
 for(const [o,re] of cases){const {cred}=await register(auth,o);await assert.rejects(verifyRegistration(cred,opts()),re,JSON.stringify(o));}
 const {cred}=await register(auth);
 await assert.rejects(verifyRegistration(cred,opts({checkChallenge:async()=>null})),/challenge/);
 await assert.rejects(verifyRegistration(cred,opts({origin:'http://nerulio.test'})),/origin/);
 await assert.rejects(verifyRegistration({...cred,type:'password'},opts()),WebAuthnError);
 await assert.rejects(verifyRegistration({...cred,response:{...cred.response,attestationObject:'!!'}},opts()),WebAuthnError);
 // UV is optional by default, required when asked.
 const {cred:noUv}=await register(auth,{flags:0x01|0x40});
 assert.equal((await verifyRegistration(noUv,opts())).uv,false);
 await assert.rejects(verifyRegistration(noUv,opts({requireUV:true})),/verified/);
});

test('authentication: counter, presence, origin, unknown credential',async()=>{
 const auth=new SoftAuthenticator();
 const {cred}=await register(auth);const r=await verifyRegistration(cred,opts());
 const challenge=await makeChallenge(SECRET,{p:'auth'},T0),o=(stored,x={})=>opts({getCredential:async()=>stored,...x});
 // A counting authenticator: 5 after 4 is fine, 4 after 4 (a clone) is not; 0 stays allowed for synced passkeys.
 assert.equal((await verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,counter:5}),o({publicKey:r.publicKey,signCount:4}))).signCount,5);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,counter:4}),o({publicKey:r.publicKey,signCount:4})),/counter/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,counter:0}),o({publicKey:r.publicKey,signCount:7})),/counter/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,flags:0x04}),o({publicKey:r.publicKey,signCount:0})),/not present/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:'https://evil.example'}),o({publicKey:r.publicKey,signCount:0})),/origin/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,rpId:'evil.example'}),o({publicKey:r.publicKey,signCount:0})),/rpId/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN,type:'webauthn.create'}),o({publicKey:r.publicKey,signCount:0})),/ceremony/);
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN}),o(null)),/unknown credential/);
 // Another key's signature over the same data.
 const other=new SoftAuthenticator();const {cred:c2}=await register(other);const r2=await verifyRegistration(c2,opts());
 await assert.rejects(verifyAuthentication(await auth.get({challenge,rpId:RP},{origin:ORIGIN}),o({publicKey:r2.publicKey,signCount:0})),/bad signature/);
});

test('authenticator data: extension data and truncation',()=>{
 const base=new Uint8Array(37);base[32]=0x01;
 assert.equal(parseAuthData(base).flags,1);
 assert.throws(()=>parseAuthData(base.slice(0,36)));
 const at=new Uint8Array(37);at[32]=0x41;assert.throws(()=>parseAuthData(at),/truncated/);
 // AT without ED must end exactly after the key; with ED, extensions may follow.
 const cose=cbor(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(32)],[-3,new Uint8Array(32)]]));
 const mk=(flags,tail)=>{const a=new Uint8Array(37+18+16+cose.length+tail.length);a[32]=flags;a[54]=16;a.set(cose,71);a.set(tail,71+cose.length);return a;};
 assert.throws(()=>parseAuthData(mk(0x41,cbor({credProtect:1}))),/trailing/);
 assert.equal(parseAuthData(mk(0xc1,cbor({credProtect:1}))).publicKey.length,cose.length);
 assert.throws(()=>coseAlg(cbor(new Map([[1,2],[3,-8]]))),/unsupported/);
 assert.throws(()=>coseAlg(cbor(new Map([[1,2],[3,-7],[-1,2],[-2,new Uint8Array(32)],[-3,new Uint8Array(32)]]))),/EC2/);
});
