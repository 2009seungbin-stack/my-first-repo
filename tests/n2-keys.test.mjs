import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepIndex,shortcutAllowed} from '../src/platform/keys.js';

test('list keys: j/k start at the first row, move one step and stop at the ends',()=>{
 assert.equal(stepIndex(-1,5,1),0);assert.equal(stepIndex(-1,5,-1),0);
 assert.equal(stepIndex(0,5,1),1);assert.equal(stepIndex(3,5,-1),2);
 assert.equal(stepIndex(4,5,1),4);assert.equal(stepIndex(0,5,-1),0);
 assert.equal(stepIndex(9,5,1),0,'a stale index starts over');
 assert.equal(stepIndex(-1,0,1),-1);assert.equal(stepIndex(0,0,-1),-1);
});

test('list keys: typing in a field, a modifier or an IME composition is never a shortcut',()=>{
 assert.equal(shortcutAllowed(null),true);
 assert.equal(shortcutAllowed({tagName:'A'}),true);assert.equal(shortcutAllowed({tagName:'BODY'}),true);
 for(const tagName of ['INPUT','TEXTAREA','SELECT','input'])assert.equal(shortcutAllowed({tagName}),false);
 assert.equal(shortcutAllowed({tagName:'DIV',isContentEditable:true}),false);
 for(const k of ['ctrlKey','metaKey','altKey','defaultPrevented','isComposing'])assert.equal(shortcutAllowed({tagName:'A'},{[k]:true}),false);
});
