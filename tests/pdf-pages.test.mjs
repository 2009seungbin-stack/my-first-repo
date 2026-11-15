import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSelection,reverseOrder} from '../src/pdf-pages.js';

test('page selection reads lists, ranges and open ends', () => {
  assert.deepEqual(parseSelection('1-3, 7, 10-', 12), [1, 2, 3, 7, 10, 11, 12]);
  assert.deepEqual(parseSelection('-2', 5), [1, 2]);
  assert.deepEqual(parseSelection('4', 5), [4]);
  assert.deepEqual(parseSelection(' 2 - 4 ; 2 ', 5), [2, 3, 4]);
  assert.deepEqual(parseSelection('3 1 2', 5), [1, 2, 3]);
  assert.deepEqual(parseSelection('1–2', 5), [1, 2], 'an en dash typed on a phone keyboard is a range');
});

test('page selection is forgiving about direction and the last page, strict about everything else', () => {
  assert.deepEqual(parseSelection('5-3', 6), [3, 4, 5]);
  assert.deepEqual(parseSelection('4-99', 6), [4, 5, 6]);
  assert.equal(parseSelection('', 6), null);
  assert.equal(parseSelection('   ', 6), null);
  assert.equal(parseSelection('0', 6), null);
  assert.equal(parseSelection('7', 6), null);
  assert.equal(parseSelection('7-9', 6), null);
  assert.equal(parseSelection('1,a', 6), null);
  assert.equal(parseSelection('1--3', 6), null);
  assert.equal(parseSelection('-', 6), null);
  assert.equal(parseSelection('1.5', 6), null);
  assert.equal(parseSelection('1', 0), null);
});

test('reverse turns the whole list around unless several pages are picked', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(reverseOrder(list), ['e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(reverseOrder(list, p => p === 'b'), ['e', 'd', 'c', 'b', 'a'], 'one picked page is not a range to reverse');
  assert.deepEqual(reverseOrder(list, p => 'bde'.includes(p)), ['a', 'e', 'c', 'd', 'b'], 'picked pages swap among their own slots');
  assert.deepEqual(list, ['a', 'b', 'c', 'd', 'e'], 'the input is not mutated');
  assert.deepEqual(reverseOrder([]), []);
});

test('a page number sits at the bottom of the page as displayed, upright, whatever the turn', async () => {
  const {pageNumberMark, labelWidth} = await import('../src/pdf-pages.js');
  assert.ok(Math.abs(labelWidth('12 / 345') - (5 * .556 + 3 * .278)) < 1e-9);
  const page = {logicalW: 600, logicalH: 800, angle: 0};
  const pivot = (m, p) => [m.x * p.logicalW, m.y * p.logicalH + m.size * .85];
  // Where a point of the un-turned page lands once the page is turned clockwise by `a`.
  const shown = ([x, y], p) => p.angle === 90 ? [p.logicalH - y, x] : p.angle === 180 ? [p.logicalW - x, p.logicalH - y] : p.angle === 270 ? [y, p.logicalW - x] : [x, y];
  const centre = pageNumberMark(page, '7');
  assert.equal(centre.type, 'text');
  assert.equal(centre.text, '7');
  assert.equal(centre.size, 11);
  assert.equal(centre.angle, 0);
  const [cx, cy] = pivot(centre, page);
  assert.ok(Math.abs(cx + labelWidth('7') * 11 / 2 - 300) < 1e-6, 'centred on the page');
  assert.ok(Math.abs(cy - (800 - 11 * 2.4)) < 1e-6, 'baseline one margin above the bottom edge');
  const right = pivot(pageNumberMark(page, '7', 'right'), page), left = pivot(pageNumberMark(page, '7', 'left'), page);
  assert.ok(Math.abs(right[0] + labelWidth('7') * 11 - (600 - 26.4)) < 1e-6);
  assert.ok(Math.abs(left[0] - 26.4) < 1e-6);
  for (const angle of [90, 180, 270]) {
    const turned = {...page, angle}, mark = pageNumberMark(turned, '10 / 12', 'right');
    const [sx, sy] = shown(pivot(mark, turned), turned), dw = angle % 180 ? 800 : 600, dh = angle % 180 ? 600 : 800;
    assert.equal(mark.angle, 360 - angle, 'counter-turned so it reads upright');
    assert.ok(Math.abs(sy - (dh - mark.size * 2.4)) < 1e-6, `bottom of the displayed page at ${angle}°`);
    assert.ok(Math.abs(sx + labelWidth('10 / 12') * mark.size - (dw - mark.size * 2.4)) < 1e-6, `right edge of the displayed page at ${angle}°`);
  }
  assert.equal(pageNumberMark({logicalW: 200, logicalH: 200, angle: 0}, '1').size, 8, 'never smaller than 8pt');
  assert.equal(pageNumberMark({logicalW: 3000, logicalH: 3000, angle: 0}, '1').size, 24, 'never larger than 24pt');
});
