// Builds a CC0 test file samurai.aseprite (sebshady's CC0 samurai sheet) with Nerulio's writer:
// 12 frames of 48x48: tag "idle" (row 1, 6 x 100 ms, loops) and tag "attack" (row 0, per-frame ms, plays once),
// a "pivot" slice (bottom centre), a "hurtbox" slice on every frame and a "hitbox" slice only on attack frames 3-4.
// RGBA frames come from frames.rgba (written by make_samurai_frames.py).
import {documentFromImages, writeAseprite, readAseprite} from 'file:///C:/Users/2009s/Desktop/SITE/.claude/worktrees/agent-aef499f5f486793c5/src/game/aseprite.js';
import {readFileSync, writeFileSync} from 'node:fs';
const here = new URL('./', import.meta.url);
const raw = readFileSync(new URL('frames.rgba', here));
const W = 48, H = 48, N = 12, size = W * H * 4;
const durations = [100, 100, 100, 100, 100, 100, 80, 80, 80, 120, 160, 100];
const frames = [];
for (let i = 0; i < N; i++) frames.push({duration: durations[i], images: {0: new Uint8Array(raw.subarray(i * size, (i + 1) * size))}});
const tags = [
  {name: 'idle', from: 0, to: 5, direction: 'forward', repeat: 0, color: '#3fa9ffff'},
  {name: 'attack', from: 6, to: 11, direction: 'forward', repeat: 1, color: '#ff4d5eff'},
];
const empty = f => ({frame: f, x: 0, y: 0, w: 0, h: 0});
const slices = [
  {name: 'pivot', keys: [{frame: 0, x: 0, y: 0, w: 48, h: 48, pivot: {x: 24, y: 47}}], userData: null},
  {name: 'hurtbox', keys: [{frame: 0, x: 13, y: 4, w: 22, h: 43}], userData: null},
  {name: 'hitbox', keys: [empty(0), {frame: 9, x: 4, y: 4, w: 16, h: 18}, {frame: 10, x: 6, y: 9, w: 17, h: 29}, empty(11)], userData: null},
];
const doc = documentFromImages({width: W, height: H, layers: [{name: 'samurai'}], frames, tags, slices});
const bytes = writeAseprite(doc);
writeFileSync(new URL('samurai.aseprite', here), bytes);
const back = readAseprite(bytes);
console.log('wrote', bytes.length, 'bytes; frames', back.frames.length, 'tags', back.tags.map(t => `${t.name}:${t.from}-${t.to}/${t.direction}/r${t.repeat}`).join(' '),
  'slices', back.slices.map(s => `${s.name}[${s.keys.length}]`).join(' '));
