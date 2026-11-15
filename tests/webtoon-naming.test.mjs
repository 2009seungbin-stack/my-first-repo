import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePrefix,partName,archiveName,DEFAULT_PREFIX} from '../src/webtoon/naming.js';
import {equalCuts,partPreview,validateCuts} from '../src/webtoon/geometry.js';

test('default prefix keeps the established episode-01 names and archive name',()=>{
 assert.equal(DEFAULT_PREFIX,'episode');
 assert.equal(partName('episode',1,3,'jpg'),'episode-01.jpg');
 assert.equal(partName('episode',3,3,'png'),'episode-03.png');
 assert.equal(archiveName('episode'),'webtoon-episode.zip');
 assert.equal(archiveName(''),'webtoon-episode.zip');
});

test('pad width grows with the part count so names sort correctly',()=>{
 assert.equal(partName('ep12',7,99,'jpg'),'ep12-07.jpg');
 assert.equal(partName('ep12',7,100,'jpg'),'ep12-007.jpg');
 assert.equal(partName('ep12',200,200,'png'),'ep12-200.png');
 assert.throws(()=>partName('x',0,3,'png'),RangeError);
 assert.throws(()=>partName('x',4,3,'png'),RangeError);
});

test('prefix sanitising removes path and reserved characters but keeps Korean and Japanese',()=>{
 assert.equal(sanitizePrefix('  내 웹툰 3화  '),'내 웹툰 3화');
 assert.equal(sanitizePrefix('第3話'),'第3話');
 assert.equal(sanitizePrefix('../../etc/passwd'),'etcpasswd');
 assert.equal(sanitizePrefix('a\\b:c*d?e"f<g>h|i'),'abcdefghi');
 assert.equal(sanitizePrefix('tab\tand\nnewline'),'tabandnewline');
 assert.equal(sanitizePrefix('...hidden.'),'hidden');
 assert.equal(sanitizePrefix('CON'),'episode');
 assert.equal(sanitizePrefix('///'),'episode');
 assert.equal(sanitizePrefix(null),'episode');
 assert.equal([...sanitizePrefix('가'.repeat(80))].length,40);
 // A non-ASCII prefix names the files inside the ZIP, while the archive keeps its ASCII name.
 assert.equal(archiveName('내 웹툰/3화'),'webtoon-episode.zip');
 assert.equal(archiveName('ep 12/final'),'ep 12final.zip');
 assert.equal(partName('a/b',1,1,'png'),'ab-01.png');
});

test('equalCuts divides source rows into near-equal parts that validate',()=>{
 assert.deepEqual(equalCuts(4000,4),[1000,2000,3000]);
 assert.deepEqual(equalCuts(10,3),[3,7]);
 assert.deepEqual(equalCuts(10,1),[]);
 assert.deepEqual(equalCuts(5,5),[1,2,3,4]);
 const parts=validateCuts(1001,equalCuts(1001,7));
 assert.equal(parts.reduce((n,x)=>n+x.height,0),1001);
 assert.ok(Math.max(...parts.map(x=>x.height))-Math.min(...parts.map(x=>x.height))<=1);
 for(const bad of [0,201,2.5,NaN])assert.throws(()=>equalCuts(4000,bad),RangeError);
 assert.throws(()=>equalCuts(3,4),RangeError);
});

test('partPreview mirrors the export worker width and rounding, and flags parts over the profile height',()=>{
 // 1600 px wide source into an 800 px max-width profile: scale 0.5.
 const rows=partPreview(1600,5000,[2000,4700],{maxWidth:800,maxHeight:1280});
 assert.deepEqual(rows.map(x=>[x.index,x.y,x.height,x.outWidth,x.outHeight,x.tooTall]),[[1,0,2000,800,1000,false],[2,2000,2700,800,1350,true],[3,4700,300,800,150,false]]);
 // Narrower sources keep their width; an exact-width profile forces it.
 assert.equal(partPreview(600,1000,[],{maxWidth:800})[0].outWidth,600);
 assert.equal(partPreview(1380,1000,[],{exactWidth:690})[0].outWidth,690);
 // Heights are differences of rounded edges, so they always add up to the rounded total.
 const odd=partPreview(1000,999,[333,666],{exactWidth:690});
 assert.equal(odd.reduce((n,x)=>n+x.outHeight,0),Math.round(999*0.69));
 assert.equal(partPreview(800,1280,[],{maxHeight:1280})[0].tooTall,false);
 assert.throws(()=>partPreview(0,10,[]),RangeError);
 assert.throws(()=>partPreview(10,10,[5,5]),RangeError);
});
