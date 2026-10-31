import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText, applyFindings } from '../public/checker.js';

test('finds racing terms and typos with exact positions', () => {
  const text = '復勝を買う。復勝にも注目。騎上する。';
  const findings = checkText(text);
  assert.equal(findings.length, 3);
  for (const f of findings) assert.equal(text.slice(f.start, f.end), f.from);
  assert.equal(applyFindings(text, findings), '複勝を買う。複勝にも注目。騎乗する。');
});
test('preserves SRT timing, numbering and line endings', () => {
  const text = '\ufeff1\r\n00:00:01,000 --> 00:00:05,000\r\n復勝で狙います。\r\n\r\n2\r\n00:00:06,000 --> 00:00:09,000\r\n追いきりに注目。\r\n';
  const findings = checkText(text);
  assert.equal(findings[0].time, '00:00:01.000');
  assert.equal(findings[1].time, '00:00:06.000');
  assert.equal(findings[0].line, 3);
  assert.equal(applyFindings(text, findings), text.replace('復勝', '複勝').replace('追いきり', '追い切り'));
});
test('supports filters, ignored issues and custom proper nouns', () => {
  const text = '天皇賞春の復勝。馬名の誤記。';
  assert.equal(checkText(text, { categories: ['表記ゆれ'] }).length, 1);
  const findings = checkText(text);
  assert.equal(checkText(text, { ignored: [findings[0].id] }).length, 1);
  const custom = [{from:'馬名の誤記',to:'登録した馬名'}];
  assert.equal(checkText(text, {custom, categories: []})[0].to, '登録した馬名');
});
test('custom rules take precedence and overlapping replacements never corrupt text', () => {
  const text = '天皇賞春を紹介';
  const findings = checkText(text, { custom: [{from:'天皇賞春を',to:'天皇賞（春）を'}] });
  assert.equal(findings.length, 1);
  assert.equal(applyFindings(text, findings), '天皇賞（春）を紹介');
});
test('does not alter correctly written terminology or infer horse names', () => {
  assert.deepEqual(checkText('皐月賞で騎乗。複勝と単勝、追い切り。イクイノックス。'), []);
});
