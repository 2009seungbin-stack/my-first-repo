/** Build audio fixtures for a Godot import/playback smoke test. Output stays ignored. */
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {preset,render} from '../src/sfx/engine.js';
import {encodeWav} from '../src/sfx/wav.js';
import {encodeCompressed} from '../src/sfx/encode.js';
const dir=new URL('../test-results/sfx-godot/audio/',import.meta.url);
await mkdir(dir,{recursive:true});
for(const rate of [44100,48000]){
 const sound=preset('coin',123);sound.rate=rate;
 const r=render(sound),ch=[r.left,r.right];
 for(const bits of [16,24])await writeFile(new URL(`coin-${rate}-${bits}.wav`,dir),encodeWav(ch,rate,bits));
 await writeFile(new URL(`coin-${rate}.ogg`,dir),await encodeCompressed(ch,rate,'ogg'));
 await copyFile(new URL(`fixtures/sfx/coin-${rate}.mp3`,import.meta.url),new URL(`coin-${rate}.mp3`,dir));
}
