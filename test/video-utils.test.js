import test from 'node:test';
import assert from 'node:assert/strict';
import {formatVideoTime,buildSampleTimes,videoCropRect,captionsToSrt,videoReportCsv} from '../public/video-utils.js';

test('samples selected range without seeking past the end or accepting excessive work',()=>{
  assert.deepEqual(buildSampleTimes(2,4.2,1),[2,3,4]);
  assert.deepEqual(buildSampleTimes(0,1,.5),[0,.5]);
  assert.throws(()=>buildSampleTimes(0,601,1),/600/);
  assert.throws(()=>buildSampleTimes(3,2,1));
  assert.throws(()=>buildSampleTimes(0,10,0));
  assert.throws(()=>buildSampleTimes(0,Infinity,1));
});
test('turns percentage crop into exact pixels and clips at video bounds',()=>{
  assert.deepEqual(videoCropRect(1920,1080,{x:0,y:65,w:100,h:35}),{x:0,y:702,width:1920,height:378});
  assert.deepEqual(videoCropRect(100,100,{x:90,y:90,w:50,h:50}),{x:90,y:90,width:10,height:10});
});
test('exports sampled timings and corrected text as SRT',()=>{
  assert.equal(formatVideoTime(3600.123),'01:00:00,123');
  assert.equal(formatVideoTime(59.9996),'00:01:00,000');
  assert.equal(captionsToSrt([{time:1,end:2.5,text:'複勝で勝負'},{time:3,end:4,text:' '}]),'1\n00:00:01,000 --> 00:00:02,500\n複勝で勝負\n');
});
test('report retains original OCR alongside correction and quotes CSV content',()=>{
  const csv=videoReportCsv([{time:1,end:2,raw:'復勝,"注目"',text:'複勝\n注目',confidence:85.5}],()=>[{from:'復勝',to:'複勝'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"復勝,""注目"""'));
  assert.ok(csv.includes('"複勝\n注目"'));
  assert.ok(csv.includes('復勝 → 複勝'));
});
test('spreadsheet formulas in OCR and edited text are escaped in CSV',()=>{
  const csv=videoReportCsv([{time:0,end:1,raw:'=1+2',text:'@SUM(1)',confidence:90}],()=>[]);
  assert.ok(csv.includes('"\'=1+2"'));
  assert.ok(csv.includes('"\'@SUM(1)"'));
});
