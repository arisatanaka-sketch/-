import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBrowserVideo,videoLoadError} from '../public/media-loader.js';

class FakeVideo extends EventTarget {
  readyState=0;videoWidth=0;videoHeight=0;duration=NaN;error=null;preload='metadata';
  load() {this.onLoad?.();}
  decoded() {this.readyState=2;this.videoWidth=1920;this.videoHeight=1080;this.duration=3;this.dispatchEvent(new Event('canplay'));}
}
test('loads a decoded first frame even when no loadeddata event is emitted',async()=>{
  const video=new FakeVideo();video.onLoad=()=>video.decoded();
  assert.deepEqual(await loadBrowserVideo(video,'blob:valid'),{duration:3,width:1920,height:1080});
  assert.equal(video.preload,'auto');
});
test('catches codec errors emitted synchronously by video.load',async()=>{
  const video=new FakeVideo();video.onLoad=()=>{video.error={code:4};video.dispatchEvent(new Event('error'));};
  await assert.rejects(loadBrowserVideo(video,'blob:hevc'),/コーデック/);
});
test('metadata alone does not mark the source ready before a frame is decoded',async()=>{
  const video=new FakeVideo();let resolved=false;
  const pending=loadBrowserVideo(video,'blob:slow').then(()=>resolved=true);
  video.readyState=1;video.videoWidth=1280;video.videoHeight=720;video.duration=5;
  video.dispatchEvent(new Event('loadedmetadata'));
  await Promise.resolve();assert.equal(resolved,false);
  video.decoded();await pending;assert.equal(resolved,true);
});
test('changing files aborts the old load and a stalled load times out with guidance',async()=>{
  const controller=new AbortController();const video=new FakeVideo();
  const pending=loadBrowserVideo(video,'blob:old',{signal:controller.signal});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
  await assert.rejects(loadBrowserVideo(new FakeVideo(),'blob:stalled',{timeoutMs:5}),/サンプル動画/);
});
test('decode and unsupported errors give specific next steps',()=>{
  assert.match(videoLoadError({code:3}),/破損/);
  assert.match(videoLoadError({code:4}),/H\.264/);
});
