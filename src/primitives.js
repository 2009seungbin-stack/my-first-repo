/** Bounded, pure RGBA primitives. No DOM, network or application state. */
export const ANALYSIS_PIXELS = 4_000_000;
export function positive(n, max = 65535) {
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error('Invalid dimensions');
  return n;
}
export function pixels(data, w, h, max = ANALYSIS_PIXELS) {
  positive(w); positive(h);
  if (w * h > max || data.length !== w * h * 4) throw Error('Pixel limit exceeded or invalid RGBA data');
}
export function bounds(data, w, h, threshold = 8) {
  pixels(data, w, h); let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] <= threshold) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
}
/** Eight-connected alpha components are candidates, not semantic segmentation. */
export function components(data, w, h, {threshold = 8, minArea = 4, maxFrames = 256} = {}) {
  pixels(data, w, h); positive(minArea, w * h); positive(maxFrames, 256);
  const seen = new Uint8Array(w * h), queue = new Uint32Array(w * h), result = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (seen[seed] || data[seed * 4 + 3] <= threshold) continue;
    let front = 0, back = 1, x0 = w, y0 = h, x1 = 0, y1 = 0;
    queue[0] = seed; seen[seed] = 1;
    while (front < back) {
      const p = queue[front++], x = p % w, y = Math.floor(p / w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && data[n * 4 + 3] > threshold) { seen[n] = 1; queue[back++] = n; }
      }
    }
    if (back >= minArea) {
      if (result.length === maxFrames) throw Error('Too many frame candidates; increase minimum area');
      result.push({x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area: back});
    }
  }
  return result.sort((a, b) => a.y - b.y || a.x - b.x);
}
export function rectangle(r, w, h) {
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isSafeInteger) || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > w || r.y + r.h > h) throw Error('Frame is outside the image');
  return {x: r.x, y: r.y, w: r.w, h: r.h};
}
export function grid(w, h, cellW, cellH) {
  positive(cellW); positive(cellH);
  if (w % cellW || h % cellH) throw Error('Tile dimensions must divide the image exactly');
  if (w / cellW * (h / cellH) > 256) throw Error('At most 256 frames');
  const frames = [];
  for (let y = 0; y < h; y += cellH) for (let x = 0; x < w; x += cellW) frames.push({x, y, w: cellW, h: cellH});
  return frames;
}
export function sheetLayout(count, frameW, frameH, columns = 4, padding = 0) {
  positive(count, 256); positive(frameW); positive(frameH); positive(columns, 256);
  if (!Number.isInteger(padding) || padding < 0 || padding > 64) throw Error('Invalid padding');
  columns = Math.min(columns, count);
  const rows = Math.ceil(count / columns), width = columns * (frameW + padding * 2), height = rows * (frameH + padding * 2);
  positive(width); positive(height);
  if (width * height > 536870911) throw Error('Sheet exceeds safe RGBA indexing');
  return {width, height, frameWidth: frameW, frameHeight: frameH, padding, columns, rows,
    frames: Array.from({length: count}, (_, i) => ({name: `frame-${String(i + 1).padStart(3, '0')}`, x: i % columns * (frameW + padding * 2) + padding, y: Math.floor(i / columns) * (frameH + padding * 2) + padding, w: frameW, h: frameH}))};
}
export function placement(w, h, targetW, targetH, align = 'bottom', anchor = .5) {
  if (w > targetW || h > targetH) throw Error('A frame does not fit the output canvas');
  return {x: Math.round((targetW - w) * Math.max(0, Math.min(1, anchor))), y: align === 'top' ? 0 : align === 'center' ? Math.round((targetH - h) / 2) : targetH - h};
}
export function swap(data, w, h, {from = [255, 0, 0], to = [0, 128, 255], tolerance = 0, shading = false} = {}) {
  pixels(data, w, h);
  if (![...from, ...to].every(v => Number.isFinite(v) && v >= 0 && v <= 255) || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 441) throw Error('Invalid color');
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3] || Math.hypot(data[i] - from[0], data[i + 1] - from[1], data[i + 2] - from[2]) > tolerance) continue;
    const delta = shading ? .2126 * (data[i] - from[0]) + .7152 * (data[i + 1] - from[1]) + .0722 * (data[i + 2] - from[2]) : 0;
    for (let k = 0; k < 3; k++) out[i + k] = to[k] + delta;
  }
  return out;
}
export function mapTexture(data, w, h, {mode = 'gray', strength = 2, invertY = false} = {}) {
  pixels(data, w, h);
  if (!['gray', 'invert', 'alpha', 'normal'].includes(mode) || !Number.isFinite(strength) || strength < 0 || strength > 10) throw Error('Invalid texture options');
  const gray = new Float32Array(w * h), out = new Uint8ClampedArray(data.length);
  for (let p = 0; p < gray.length; p++) gray[p] = (.2126 * data[p * 4] + .7152 * data[p * 4 + 1] + .0722 * data[p * 4 + 2]) / 255;
  const at = (x, y) => gray[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    if (mode === 'normal') {
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength, ny = (at(x, y - 1) - at(x, y + 1)) * strength * (invertY ? -1 : 1), norm = Math.hypot(nx, ny, 1);
      out.set([Math.round((nx / norm + 1) * 127.5), Math.round((ny / norm + 1) * 127.5), Math.round((1 / norm + 1) * 127.5), 255], i);
    } else {
      const v = mode === 'alpha' ? data[i + 3] : mode === 'invert' ? (1 - gray[p]) * 255 : gray[p] * 255;
      out.set([v, v, v, mode === 'alpha' ? 255 : data[i + 3]], i);
    }
  }
  return out;
}
export function packChannels(inputs, w, h, mapping) {
  inputs.forEach(data => pixels(data, w, h));
  if (mapping.length !== 4) throw Error('Four channel mappings are required');
  const out = new Uint8ClampedArray(w * h * 4);
  mapping.forEach((m, channel) => {
    if (m === 'zero' || m === 'one') { for (let i = channel; i < out.length; i += 4) out[i] = m === 'one' ? 255 : 0; return; }
    if (!Number.isInteger(m) || !inputs[m]) throw Error('Missing channel input');
    const source = inputs[m];
    for (let i = 0; i < out.length; i += 4) out[i + channel] = Math.round(.2126 * source[i] + .7152 * source[i + 1] + .0722 * source[i + 2]);
  });
  return out;
}
/** Grid-only extrusion; returns new pixel coordinates, not a UV bake. */
export function extrude(data, w, h, tileW, tileH, padding = 2) {
  pixels(data, w, h); const tiles = grid(w, h, tileW, tileH), layout = sheetLayout(tiles.length, tileW, tileH, w / tileW, padding);
  if (layout.width * layout.height > ANALYSIS_PIXELS) throw Error('Atlas output exceeds analysis limit');
  const out = new Uint8ClampedArray(layout.width * layout.height * 4);
  tiles.forEach((tile, j) => {
    const dest = layout.frames[j];
    for (let y = -padding; y < tileH + padding; y++) for (let x = -padding; x < tileW + padding; x++) {
      const sx = tile.x + Math.max(0, Math.min(tileW - 1, x)), sy = tile.y + Math.max(0, Math.min(tileH - 1, y));
      out.set(data.subarray((sy * w + sx) * 4, (sy * w + sx) * 4 + 4), ((dest.y + y) * layout.width + dest.x + x) * 4);
    }
  });
  return {data: out, ...layout};
}
export function offset(data, w, h) {
  pixels(data, w, h); const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (((y + Math.floor(h / 2)) % h) * w + (x + Math.floor(w / 2)) % w) * 4;
    out.set(data.subarray(i, i + 4), (y * w + x) * 4);
  }
  return out;
}
export function marginBounds(data, w, h, threshold = 245, padding = 0) {
  pixels(data, w, h); const mask = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) mask[i + 3] = data[i + 3] > 8 && Math.min(data[i], data[i + 1], data[i + 2]) < threshold ? 255 : 0;
  const b = bounds(mask, w, h);
  if (!b) return null;
  const x = Math.max(0, b.x - padding), y = Math.max(0, b.y - padding);
  return {x, y, w: Math.min(w, b.x + b.w + padding) - x, h: Math.min(h, b.y + b.h + padding) - y};
}
export function fontMetadata(w, h, cellW, cellH, text, baseline = cellH) {
  const cells = grid(w, h, cellW, cellH), chars = Array.from(text);
  if (!chars.length || chars.length > cells.length || new Set(chars).size !== chars.length) throw Error('Character order must be nonempty, unique, and fit the grid');
  if (!Number.isInteger(baseline) || baseline < 0 || baseline > cellH) throw Error('Invalid baseline');
  return {format: 'fileforge-grid-font-v1', image: 'font.png', width: w, height: h, lineHeight: cellH, baseline,
    glyphs: chars.map((char, i) => ({char, codepoint: char.codePointAt(0), ...cells[i], xOffset: 0, yOffset: 0, xAdvance: cellW}))};
}
