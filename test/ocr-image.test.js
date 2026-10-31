import test from 'node:test';
import assert from 'node:assert/strict';
import {isTelopInk} from '../public/ocr-image.js';
test('keeps the chosen telop color and rejects outlines or green backgrounds',()=>{
  assert.equal(isTelopInk(245,220,40,'yellow'),true);
  assert.equal(isTelopInk(30,115,35,'yellow'),false);
  assert.equal(isTelopInk(20,20,20,'yellow'),false);
  assert.equal(isTelopInk(250,205,90,'gold'),true);
  assert.equal(isTelopInk(150,110,60,'gold'),false);
  assert.equal(isTelopInk(240,20,45,'red'),true);
  assert.equal(isTelopInk(180,160,150,'red'),false);
  assert.equal(isTelopInk(235,235,230,'white'),true);
  assert.equal(isTelopInk(245,215,25,'white'),false);
});
