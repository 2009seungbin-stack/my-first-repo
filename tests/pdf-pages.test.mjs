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
