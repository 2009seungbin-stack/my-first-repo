/** Independent FFmpeg decode/reopen of real Kenney CC0 audio; no browser or network. */
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {edit,loudness,protectSamplePeakInPlace} from '../src/audio-lab/dsp.js';
import {encodeWav,encodeCompressed} from '../src/audio-lab/encode.js';
const fixture=fileURLToPath(new URL('./fixtures/audio-lab/kenney-preview.ogg',import.meta.url));
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const ffmpegMeter=file=>{const result=spawnSync('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null',process.platform==='win32'?'NUL':'/dev/null'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr.slice(-400));const loud=[...result.stderr.matchAll(/Integrated loudness:\s*I:\s*(-?\d+(?:\.\d+)?)/g)],peak=[...result.stderr.matchAll(/True peak:\s*Peak:\s*(-?\d+(?:\.\d+)?)/g)];assert.ok(loud.length&&peak.length,'FFmpeg ebur128 summary');return {integrated:Number(loud.at(-1)[1]),truePeak:Number(peak.at(-1)[1])};};
const meta=probe(fixture),stream=meta.streams.find(x=>x.codec_type==='audio');assert.equal(stream.codec_name,'vorbis');
const rate=Number(stream.sample_rate),count=stream.channels;
const raw=execFileSync('ffmpeg',['-v','error','-i',fixture,'-f','f32le','-acodec','pcm_f32le','pipe:1'],{maxBuffer:32*1048576});
const frames=raw.length/(4*count),channels=Array.from({length:count},()=>new Float32Array(frames));
for(let i=0;i<frames;i++)for(let c=0;c<count;c++)channels[c][i]=raw.readFloatLE((i*count+c)*4);
const original=loudness(channels,rate),edited=edit(channels,rate,{start:2,end:8,fadeIn:.1,fadeOut:.1,snapToZero:true}),guard=protectSamplePeakInPlace(edited);
const independentSource=ffmpegMeter(fixture);assert.ok(Math.abs(original.integrated-independentSource.integrated)<.2,`${original.integrated} vs FFmpeg ${independentSource.integrated}`);
assert.ok(loudness(edited,rate).samplePeak<=0,'the exported selection is sample-peak safe');
const folder=mkdtempSync(join(tmpdir(),'nerulio-audio-lab-'));
try{
 for(const format of ['wav','ogg']){
  const bytes=format==='wav'?encodeWav(edited,rate):await encodeCompressed(edited,rate,'ogg'),path=join(folder,`kenney-edited.${format}`);writeFileSync(path,bytes);
  if(process.env.AUDIO_LAB_QA_OUT)writeFileSync(join(process.env.AUDIO_LAB_QA_OUT,`kenney-edited.${format}`),bytes);
  const reopened=probe(path),track=reopened.streams.find(x=>x.codec_type==='audio');assert.equal(track.codec_name,format==='wav'?'pcm_s16le':'vorbis');
  assert.ok(Math.abs(Number(reopened.format.duration)-6)<.02,`${format} duration`);
  execFileSync('ffmpeg',['-v','error','-i',path,'-f','null',process.platform==='win32'?'NUL':'/dev/null']);
  const meter=ffmpegMeter(path),local=loudness(edited,rate);assert.ok(Math.abs(meter.integrated-local.integrated)<.2,`${format} output LUFS ${meter.integrated} vs ${local.integrated}`);
  console.log(JSON.stringify({format,bytes:bytes.length,codec:track.codec_name,duration:Number(reopened.format.duration),independentDecode:'pass',ffmpegLufs:meter.integrated,ffmpegTruePeakDb:meter.truePeak}));
 }
 console.log(JSON.stringify({source:'Kenney Music Jingles Preview.ogg',sourceDuration:Number(meta.format.duration),sourceLufs:original.integrated,ffmpegLufs:independentSource.integrated,ffmpegTruePeakDb:independentSource.truePeak,decodedSamplePeakDb:original.samplePeak,peakGuardDb:guard.appliedDb,editedLufs:loudness(edited,rate).integrated}));
}finally{rmSync(folder,{recursive:true,force:true});}
