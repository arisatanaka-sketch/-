export function videoLoadError(mediaError, timedOut = false) {
  if (timedOut) return '動画の読み込みが進んでいません。別の動画か、下の「サンプル動画で試す」をお試しください。HEVC/H.265・ProResなどは、MP4（H.264）に変換すると読み込める場合があります。';
  if (mediaError?.code === 3) return '動画の映像を再生できません。ファイルが破損しているか、このブラウザが映像のコーデックに対応していない可能性があります。MP4（H.264）で書き出し直してお試しください。';
  if (mediaError?.code === 4) return 'この動画の形式・コーデックは、このブラウザで再生できません。.mp4でもHEVC/H.265などの映像は再生できない場合があります。MP4（H.264）かWebMで書き出し直すか、別のブラウザをお試しください。';
  if (mediaError?.code === 1) return '動画の読み込みが中断されました。もう一度動画を選んでください。';
  return '動画を読み込めませんでした。ファイルをパソコンに保存し、ほかのプレーヤーで再生できるか確認してください。サンプル動画でも動かない場合は、別のブラウザをお試しください。';
}

export function loadBrowserVideo(video, source, { signal, timeoutMs = 30000 } = {}) {
  return new Promise((resolve,reject) => {
    if (signal?.aborted) return reject(new DOMException('読み込みを中断しました','AbortError'));
    let settled = false;
    const events = ['loadedmetadata','loadeddata','canplay','canplaythrough','durationchange','seeked'];
    const cleanup = () => {clearTimeout(timer);for(const event of events)video.removeEventListener(event,check);video.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted);};
    const finish = error => {if(settled)return;settled=true;cleanup();error?reject(error):resolve({duration:video.duration,width:video.videoWidth,height:video.videoHeight});};
    const check = () => {
      if(video.error)return failed();
      if(video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0 && Number.isFinite(video.duration) && video.duration>0)finish();
    };
    const failed = () => finish(new Error(videoLoadError(video.error)));
    const aborted = () => finish(new DOMException('読み込みを中断しました','AbortError'));
    const timer=setTimeout(()=>finish(new Error(videoLoadError(video.error,true))),timeoutMs);
    // Register before assigning src/load: even immediate errors are caught.
    for(const event of events)video.addEventListener(event,check);
    video.addEventListener('error',failed);signal?.addEventListener('abort',aborted,{once:true});
    try {video.preload='auto';video.src=source;video.load();check();} catch(e) {finish(e);}
  });
}
