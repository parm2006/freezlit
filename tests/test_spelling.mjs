import assert from 'node:assert/strict';
import {wordAt} from '../web/spelling-menu.js';
assert.deepEqual(wordAt('This is mispelled.',12),{word:'mispelled',start:8,end:17});
assert.deepEqual(wordAt('a café word',4),{word:'café',start:2,end:6});
assert.equal(wordAt('123 !',2),null);
assert.equal(wordAt('',0),null);
assert.deepEqual(wordAt("it's fine",2),{word:"it's",start:0,end:4});
console.log('5 spelling word-selection checks passed');
