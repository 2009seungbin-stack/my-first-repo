import test from 'node:test';
import assert from 'node:assert/strict';
import {detect,readExif,formatCoordinates,inspect,strip,crc32,orientationExif,cleanName} from '../src/image-metadata.js';

const cat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const ascii=s=>Uint8Array.from(s,c=>c.charCodeAt(0));
/** A little-endian EXIF block written by hand: IFD0 (Make, Model, Orientation, pointers), an Exif
 * IFD (DateTimeOriginal, ExposureTime, ISO), a GPS IFD (Seoul City Hall, 38 m) and a thumbnail IFD. */
function tiff({orientation=6,gps=true}={}){
 const b=new Uint8Array(400),v=new DataView(b.buffer);let heap=260;
 const put=s=>{const at=heap;b.set(ascii(s+'\0'),at);heap+=s.length+1+(s.length+1)%2;return at;};
 const rat=pairs=>{const at=heap;for(const [n,d] of pairs){v.setUint32(heap,n,true);v.setUint32(heap+4,d,true);heap+=8;}return at;};
 const dir=(at,entries,next=0)=>{v.setUint16(at,entries.length,true);entries.forEach(([tag,type,count,val],i)=>{const e=at+2+i*12;v.setUint16(e,tag,true);v.setUint16(e+2,type,true);v.setUint32(e+4,count,true);if(type===3&&count===1)v.setUint16(e+8,val,true);else if(type===2&&count<=4)b.set(ascii(val),e+8);else v.setUint32(e+8,val,true);});v.setUint32(at+2+entries.length*12,next,true);return at;};
 b.set([0x49,0x49,42,0,8,0,0,0]);
 dir(8,[[0x010f,2,6,put('Canon')],[0x0110,2,11,put('EOS R6 II ')],[0x0112,3,1,orientation],[0x8769,4,1,100],...(gps?[[0x8825,4,1,150]]:[])],230);
 dir(100,[[0x829a,5,1,rat([[1,250]])],[0x8827,3,1,400],[0x9003,2,20,put('2024:05:01 09:30:00')]]);
 if(gps)dir(150,[[1,2,2,'N\0'],[2,5,3,rat([[37,1],[33,1],[5994,100]])],[3,2,2,'E\0'],[4,5,3,rat([[126,1],[58,1],[4080,100]])],[5,1,1,0],[6,5,1,rat([[38,1]])]]);
 dir(230,[[0x0201,4,1,390],[0x0202,4,1,10]]);
 return b;
}
const seg=(marker,payload)=>cat(Uint8Array.of(0xff,marker,(payload.length+2)>>8,(payload.length+2)&255),payload);
const JFIF=seg(0xe0,cat(ascii('JFIF\0'),Uint8Array.of(1,1,0,0,1,0,1,0,0))),DQT=seg(0xdb,new Uint8Array(65).fill(1)),SOF=seg(0xc0,Uint8Array.of(8,0,48,0,64,1,1,0x11,0)),DHT=seg(0xc4,new Uint8Array(20));
// Entropy data with a stuffed FF00 and a restart marker, which must not be mistaken for segments.
const SCAN=cat(seg(0xda,Uint8Array.of(1,1,0,0,63,0)),Uint8Array.of(0x12,0xff,0x00,0x34,0xff,0xd0,0x56,0xff,0x00)),EOI=Uint8Array.of(0xff,0xd9),SOI=Uint8Array.of(0xff,0xd8);
const EXIF=o=>seg(0xe1,cat(ascii('Exif\0\0'),tiff(o))),XMP=seg(0xe1,ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta exif:GPSLatitude="37,33.99N"/>')),ICC=seg(0xe2,cat(ascii('ICC_PROFILE\0'),Uint8Array.of(1,1,9,9,9))),IPTC=seg(0xed,ascii('Photoshop 3.0\x008BIM')),ADOBE=seg(0xee,cat(ascii('Adobe'),Uint8Array.of(0,100,0,0,0,0,1))),COM=seg(0xfe,ascii('made with love'));
const jpeg=(o={})=>cat(SOI,JFIF,EXIF(o),XMP,ICC,IPTC,ADOBE,COM,DQT,SOF,DHT,SCAN,EOI,ascii('MOTIONPHOTO'));

test('formats are detected by signature, not by name',()=>{
 assert.equal(detect(jpeg()),'jpeg');assert.equal(detect(ascii('\x89PNG\r\n\x1a\n....')),'png');assert.equal(detect(ascii('RIFF\0\0\0\0WEBPVP8 ')),'webp');
 assert.equal(detect(ascii('GIF89a')),'');assert.equal(inspect(ascii('GIF89a')).format,'');assert.throws(()=>strip(ascii('GIF89a')));
});
test('EXIF: camera, date, exposure, orientation, thumbnail and GPS are read from a hand-written block',()=>{
 const e=readExif(tiff());
 assert.equal(e.make,'Canon');assert.equal(e.model,'EOS R6 II');assert.equal(e.orientation,6);assert.equal(e.taken,'2024:05:01 09:30:00');
 assert.equal(e.exposure,1/250);assert.equal(e.iso,400);assert.equal(e.thumbnail,10);assert.equal(e.gpsTags,6);
 assert.ok(Math.abs(e.gps.latitude-(37+33/60+59.94/3600))<1e-9);assert.ok(Math.abs(e.gps.longitude-(126+58/60+40.8/3600))<1e-9);assert.equal(e.gps.altitude,38);
 assert.deepEqual(formatCoordinates(e.gps),{decimal:'37.566650, 126.978000',dms:'37°33′59.9″N 126°58′40.8″E'});
 assert.deepEqual(formatCoordinates({latitude:-33.8568,longitude:-70.999999}),{decimal:'-33.856800, -70.999999',dms:'33°51′24.5″S 71°00′00.0″W'});
 assert.equal(readExif(tiff({gps:false})).gps,null);assert.equal(readExif(ascii('nonsense')),null);assert.equal(readExif(new Uint8Array(3)),null);
 // A pointer loop or an offset outside the block must not hang or throw.
 const loop=tiff();new DataView(loop.buffer).setUint32(8+2+3*12+8,8,true);assert.equal(readExif(loop).make,'Canon');
 const wild=tiff();new DataView(wild.buffer).setUint32(4,0xfffffff0,true);assert.equal(readExif(wild).make,'');
});
test('JPEG: every metadata segment is listed and the location is flagged',()=>{
 const r=inspect(jpeg());
 assert.equal(r.format,'jpeg');assert.equal(r.width,64);assert.equal(r.height,48);assert.equal(r.damaged,false);assert.equal(r.location,true);
 assert.deepEqual(r.blocks.map(b=>b.kind),['exif','xmp','icc','iptc','comment','trailing']);
 assert.equal(r.blocks[1].location,true);assert.equal(r.blocks[4].text,'made with love');assert.equal(r.blocks[5].bytes,11);assert.equal(r.exif.model,'EOS R6 II');
});
test('JPEG: stripping copies structure and scan data byte for byte and keeps only what decoding needs',()=>{
 const upright=strip(jpeg({orientation:1}));
 assert.deepEqual(upright.bytes,cat(SOI,JFIF,ICC,ADOBE,DQT,SOF,DHT,SCAN,EOI));assert.equal(upright.orientationKept,false);
 assert.deepEqual(upright.removed.map(p=>p.kind),['exif','xmp','iptc','comment','trailing']);assert.equal(upright.removedBytes,jpeg({orientation:1}).length-upright.bytes.length);
 assert.deepEqual(strip(jpeg({orientation:1}),{keepICC:false}).bytes,cat(SOI,JFIF,ADOBE,DQT,SOF,DHT,SCAN,EOI));
 // A rotated photo keeps a one-tag EXIF block right after JFIF, and nothing else from the old block.
 const rotated=strip(jpeg()),mini=seg(0xe1,cat(ascii('Exif\0\0'),orientationExif(6)));
 assert.deepEqual(rotated.bytes,cat(SOI,JFIF,mini,ICC,ADOBE,DQT,SOF,DHT,SCAN,EOI));assert.equal(rotated.orientationKept,true);
 const again=inspect(rotated.bytes);assert.equal(again.exif.orientation,6);assert.equal(again.exif.tags,1);assert.equal(again.exif.gps,null);assert.equal(again.location,false);assert.equal(again.exif.make,'');
 assert.deepEqual(strip(jpeg(),{keepOrientation:false}).bytes,upright.bytes);
 // Stripping twice changes nothing more, and a file without metadata comes back identical.
 assert.deepEqual(strip(upright.bytes).bytes,upright.bytes);assert.equal(strip(upright.bytes,{keepICC:false}).removedBytes,ICC.length);
});
test('JPEG: a damaged or truncated file is kept whole from the damage onwards',()=>{
 const cut=jpeg().subarray(0,SOI.length+JFIF.length+20),r=inspect(cut);assert.equal(r.damaged,true);assert.deepEqual(strip(cut).bytes,cut);
 const noEnd=cat(SOI,JFIF,COM,DQT,SOF,DHT,SCAN);assert.deepEqual(strip(noEnd).bytes,cat(SOI,JFIF,DQT,SOF,DHT,SCAN));
});
const chunk=(type,data)=>{const body=cat(ascii(type),data),out=new Uint8Array(12+data.length),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set(body,4);v.setUint32(8+data.length,crc32(body));return out;};
const SIG=ascii('\x89PNG\r\n\x1a\n'),IHDR=chunk('IHDR',Uint8Array.of(0,0,0,32,0,0,0,16,8,6,0,0,0)),IDAT=chunk('IDAT',Uint8Array.of(1,2,3,4,5)),IEND=chunk('IEND',new Uint8Array(0)),PHYS=chunk('pHYs',Uint8Array.of(0,0,11,19,0,0,11,19,1)),GAMA=chunk('gAMA',Uint8Array.of(0,0,177,143));
const TEXT=chunk('tEXt',ascii('parameters\0a castle, steps: 20')),ITXT=chunk('iTXt',cat(ascii('Title\0\0\0ko\0'),new TextEncoder().encode('제목\0봄 소풍'))),PXMP=chunk('iTXt',ascii('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>')),TIME=chunk('tIME',Uint8Array.of(7,232,5,1,9,30,0)),ICCP=chunk('iCCP',ascii('sRGB\0\0xx')),PEXIF=o=>chunk('eXIf',tiff(o)),PRIV=chunk('prVt',Uint8Array.of(1,2)),ACTL=chunk('acTL',new Uint8Array(8));
const png=(o={})=>cat(SIG,IHDR,GAMA,ICCP,PHYS,PEXIF(o),TEXT,ITXT,PXMP,TIME,PRIV,ACTL,IDAT,IEND,ascii('extra'));
test('the cleaned copy keeps its name and gets a correct extension',()=>{
 assert.equal(cleanName('IMG_0001.JPG','jpeg'),'IMG_0001-clean.JPG');assert.equal(cleanName('shot.final.png','png'),'shot.final-clean.png');assert.equal(cleanName('download','webp'),'download-clean.webp');assert.equal(cleanName('photo.heic','jpeg'),'photo-clean.jpg');
});
test('crc32 matches the PNG reference value',()=>{assert.equal(crc32(ascii('IEND')),0xae426082);assert.equal(crc32(ascii('123456789')),0xcbf43926);});
test('PNG: text, EXIF, time and private chunks are listed with their content',()=>{
 const r=inspect(png());
 assert.equal(r.format,'png');assert.equal(r.width,32);assert.equal(r.height,16);assert.equal(r.damaged,false);assert.equal(r.location,true);
 assert.deepEqual(r.blocks.map(b=>[b.kind,b.label,b.text]),[['icc','',''],['exif','',''],['text','parameters','a castle, steps: 20'],['text','Title','봄 소풍'],['xmp','XML:com.adobe.xmp',''],['time','','2024-05-01 09:30:00 UTC'],['other','prVt',''],['trailing','','']]);
});
test('PNG: stripping keeps critical, colour and animation chunks untouched with valid CRCs',()=>{
 const upright=strip(png({orientation:1}));
 assert.deepEqual(upright.bytes,cat(SIG,IHDR,GAMA,ICCP,PHYS,ACTL,IDAT,IEND));
 assert.deepEqual(strip(png({orientation:1}),{keepICC:false}).bytes,cat(SIG,IHDR,GAMA,PHYS,ACTL,IDAT,IEND));
 const rotated=strip(png({orientation:8}));
 assert.deepEqual(rotated.bytes,cat(SIG,IHDR,chunk('eXIf',orientationExif(8)),GAMA,ICCP,PHYS,ACTL,IDAT,IEND));
 assert.equal(inspect(rotated.bytes).exif.orientation,8);assert.equal(inspect(rotated.bytes).location,false);
 const cut=png().subarray(0,90);assert.equal(inspect(cut).damaged,true);
});
const riff=(...chunks)=>{const body=cat(ascii('WEBP'),...chunks),out=cat(ascii('RIFF'),new Uint8Array(4),body);new DataView(out.buffer).setUint32(4,body.length,true);return out;};
const wchunk=(id,data)=>{const out=new Uint8Array(8+data.length+(data.length&1));out.set(ascii(id));new DataView(out.buffer).setUint32(4,data.length,true);out.set(data,8);return out;};
const vp8x=flags=>wchunk('VP8X',Uint8Array.of(flags,0,0,0,99,0,0,49,0,0)),VP8=wchunk('VP8 ',Uint8Array.of(0,0,0,0x9d,0x01,0x2a,100,0,50,0,7)),WICC=wchunk('ICCP',Uint8Array.of(1,2,3)),WXMP=wchunk('XMP ',ascii('<x:xmpmeta/>'));
test('WebP: EXIF and XMP chunks are removed, the RIFF size and VP8X flags are corrected',()=>{
 const file=cat(riff(vp8x(0x2c),WICC,VP8,wchunk('EXIF',tiff({orientation:1})),WXMP),ascii('tail')),r=inspect(file);
 assert.equal(r.format,'webp');assert.equal(r.width,100);assert.equal(r.height,50);assert.equal(r.location,true);assert.deepEqual(r.blocks.map(b=>b.kind),['icc','exif','xmp','trailing']);
 assert.deepEqual(strip(file).bytes,riff(vp8x(0x20),WICC,VP8));assert.deepEqual(strip(file,{keepICC:false}).bytes,riff(vp8x(0),VP8));
 const rotated=cat(riff(vp8x(0x0c),VP8,wchunk('EXIF',cat(ascii('Exif\0\0'),tiff({orientation:3}))),WXMP));
 assert.equal(inspect(rotated).exif.orientation,3);assert.deepEqual(strip(rotated).bytes,riff(vp8x(0x08),VP8,wchunk('EXIF',orientationExif(3))));
 const simple=riff(VP8);assert.equal(inspect(simple).width,100);assert.equal(inspect(simple).blocks.length,0);assert.deepEqual(strip(simple).bytes,simple);
});
