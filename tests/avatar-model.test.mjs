import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,normalize,parse,randomize,serialize} from '../src/avatar/model.js';

test('avatar URL round trip keeps a versioned, bounded state',()=>{
 assert.deepEqual(parse('').state,DEFAULT);
 const state={...DEFAULT,seed:4294967295,face:'angular',hair:'swept',eyes:'sleepy',outfit:'jacket',hairPalette:'red',size:4096,motion:'breathe',delay:200};
 assert.deepEqual(parse(serialize(state)),{state:normalize(state),valid:true,versionMismatch:false});
 const hostile=parse('?v=1&face=<script>&seed=-3&hair=bogus');
 assert.equal(hostile.valid,false);
 assert.equal(hostile.state.face,DEFAULT.face);
 assert.equal(hostile.state.hair,DEFAULT.hair);
 assert.equal(hostile.state.seed,DEFAULT.seed);
 assert.equal(parse('?v=99').versionMismatch,true);
 assert.equal(parse('?v=1&size=33&motion=spin&delay=-1').valid,false);
 assert.equal(parse('?'+ 'x'.repeat(3000)).valid,false);
});

test('seeded random is repeatable and category locks preserve values',()=>{
 const locks={face:true,hair:true};
 const a=randomize(DEFAULT,locks,41328),b=randomize(DEFAULT,locks,41328);
 assert.deepEqual(a,b);
 assert.equal(a.face,DEFAULT.face);
 assert.equal(a.hair,DEFAULT.hair);
 assert.equal(a.hairPalette,DEFAULT.hairPalette);
 assert.equal(a.seed,41328);
 assert.notDeepEqual(randomize(DEFAULT,{},41329),a);
});
