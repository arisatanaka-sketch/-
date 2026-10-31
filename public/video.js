import { checkText, applyFindings } from './checker.js';
import { createLocalOcrWorker } from './ocr-engine.js';
import { formatVideoTime, buildSampleTimes, videoCropRect, normalizedCaption, captionsToSrt, videoReportCsv } from './video-utils.js';

export function initVideoReview({ getDictionary, onTextExport, notify }) {
  const v$ = id => document.getElementById(id);
  const video = v$('video-player');
  const review = { file: null, url: null, ready: false, busy: false, rows: [], filter: 'all', worker: null, abort: null, loadId: 0 };
  const safe = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const abortError = () => new DOMException('読み取りを停止しました。','AbortError');
  const message = (text, error = false) => {v$('video-message').textContent=text;v$('video-message').classList.toggle('error',error);};
  const crop = () => ({ x:Number(v$('video-crop-x').value),y:Number(v$('video-crop-y').value),w:Number(v$('video-crop-w').value),h:Number(v$('video-crop-h').value) });
  const findings = row => checkText(row.text, {custom:getDictionary(),ignored:row.ignored});
  const fields = ['video-crop-preset','video-crop-x','video-crop-y','video-crop-w','video-crop-h','video-start','video-end','video-interval','video-file','video-change','video-choose'];
  function updateButtons() {
    for (const id of fields) v$(id).disabled = review.busy;
    document.querySelectorAll('[data-caption-edit], [data-video-apply], [data-video-ignore]').forEach(el => el.disabled = review.busy);
    v$('video-scan').disabled = v$('video-current').disabled = !review.ready || review.busy;
    v$('video-stop').hidden = !review.busy;
    v$('video-report').disabled = v$('video-to-editor').disabled = !review.rows.length || review.busy;
    video.controls = !review.busy;
  }
  function samplePlan() {
    const start = Number(v$('video-start').value);
    const end = v$('video-end').value === '' ? video.duration : Number(v$('video-end').value);
    if (end > video.duration + .001) throw new Error('終了時刻が動画の長さを超えています。');
    return {end,times:buildSampleTimes(start,end,Number(v$('video-interval').value))};
  }
  function updateEstimate() {
    if (!review.ready) return;
    try {const {times} = samplePlan();v$('video-estimate').textContent=`${times.length}枚の画面を読み取ります。1枚ずつ処理するため、動画の長さと端末性能によって時間がかかります。`;}
    catch(e) {v$('video-estimate').textContent=e.message;}
  }
  function updateCrop() {
    const c = crop();
    const valid = Object.values(c).every(Number.isFinite) && c.x >= 0 && c.y >= 0 && c.w > 0 && c.h > 0 && c.x < 100 && c.y < 100 && c.x+c.w <= 100 && c.y+c.h <= 100;
    v$('video-crop-overlay').hidden = !review.ready || !valid;
    if (valid) Object.assign(v$('video-crop-overlay').style,{left:`${c.x}%`,top:`${c.y}%`,width:`${c.w}%`,height:`${c.h}%`});
    return valid;
  }
  function seekTo(time, signal) {
    return new Promise((resolve,reject) => {
      if (signal?.aborted) return reject(abortError());
      const target = Math.min(Math.max(0,time),Math.max(0,video.duration-.001));
      if (Math.abs(video.currentTime-target) < .001 && video.readyState >= 2) return resolve();
      const finish = error => {clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);signal?.removeEventListener('abort',cancel);error?reject(error):resolve();};
      const done = () => finish();
      const failed = () => finish(new Error('動画を再生できません。MP4（H.264）やWebM形式をお試しください。'));
      const cancel = () => finish(abortError());
      const timer = setTimeout(()=>finish(new Error('動画の読み込みがタイムアウトしました。別の形式や短い動画でお試しください。')),15000);
      video.addEventListener('seeked',done,{once:true});video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',cancel,{once:true});
      video.currentTime=target;
    });
  }
  function abortable(promise, signal) {
    return new Promise((resolve,reject) => {
      const cancel=()=>reject(abortError());
      if(signal.aborted) return reject(abortError());
      signal.addEventListener('abort',cancel,{once:true});
      promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
    });
  }
  function capture() {
    const rect = videoCropRect(video.videoWidth,video.videoHeight,crop());
    const canvas=document.createElement('canvas');
    const scale=Math.min(2,1920/rect.width);
    canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height,0,0,canvas.width,canvas.height);
    const thumbnail=document.createElement('canvas');thumbnail.width=Math.min(360,canvas.width);thumbnail.height=Math.max(1,Math.round(canvas.height*thumbnail.width/canvas.width));
    thumbnail.getContext('2d').drawImage(canvas,0,0,thumbnail.width,thumbnail.height);
    return {canvas,image:thumbnail.toDataURL('image/jpeg',.8)};
  }
  function renderReview() {
    let issueCount=0;
    for (const row of review.rows) issueCount += findings(row).length;
    v$('video-captions-count').textContent=review.rows.length;
    v$('video-review-summary').textContent=review.rows.length?`${review.rows.length}件のテロップ / 修正候補 ${issueCount}件 · 画像と見比べて確認してください。`:'読み取った文字を、元の画像と見比べて確認できます。';
    const rows=review.rows.filter(row=>review.filter==='all'||(review.filter==='issues'?findings(row).length>0:row.confidence<70));
    v$('video-captions').innerHTML=rows.length?rows.map(row=>{
      const list=findings(row);
      return `<article class="video-caption-card" data-caption="${row.id}"><div class="video-caption-image"><button data-video-jump="${row.id}" title="この時刻の動画を見る"><img src="${row.image}" alt="${formatVideoTime(row.time,'.')} のテロップ領域"><span>▶ ${formatVideoTime(row.time,'.')}</span></button><span class="video-ocr-score ${row.confidence<70?'low':''}">OCRスコア ${Math.round(row.confidence)}${row.confidence<70?' · 画像と要照合':''}</span></div><div class="video-caption-body"><label for="video-caption-text-${row.id}">読み取ったテロップ <span>OCRの読み間違いはここで修正</span></label><textarea id="video-caption-text-${row.id}" data-caption-edit="${row.id}" maxlength="4000" spellcheck="false" ${review.busy?'disabled':''}>${safe(row.text)}</textarea><div class="video-caption-issues">${list.length?list.map(f=>`<div class="video-caption-issue"><span><del>${safe(f.from)}</del><span> → </span><strong>${safe(f.to)}</strong></span><div><button data-video-ignore="${row.id}" data-issue-id="${safe(f.id)}">無視</button><button data-video-apply="${row.id}" data-issue-id="${safe(f.id)}">候補を適用</button></div><small>${safe(f.reason)}</small></div>`).join(''):'<p class="video-caption-clear">✓ 辞書に一致する修正候補はありません</p>'}</div></div></article>`;
    }).join(''):`<div class="video-empty-review"><svg><use href="#i-video"/></svg><h3>${review.rows.length?'この条件のテロップはありません':'映像と文字を、並べてチェック。'}</h3><p>${review.rows.length?'別の表示条件で確認してみましょう。':'読み取り後に、時刻・画像・修正候補がここに並びます。'}</p></div>`;
    updateButtons();
  }
  async function loadVideo(file) {
    if (!file || review.busy) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) return message('動画ファイルを選択してください。MP4・WebMなどに対応しています。',true);
    if (review.rows.length && !window.confirm('確認中のテロップを消して、別の動画に切り替えますか？必要なレポートを先に保存してください。')) return;
    const loadId=++review.loadId;
    review.ready=false;review.rows=[];review.file=file;
    video.pause();video.removeAttribute('src');video.load();
    if (review.url) URL.revokeObjectURL(review.url);
    review.url=URL.createObjectURL(file);video.src=review.url;
    video.hidden=false;v$('video-upload').hidden=true;v$('video-drop').classList.add('has-video');
    v$('video-file-name').textContent=file.name;v$('video-file-meta').textContent='動画を読み込み中…';
    v$('video-crop-overlay').hidden=true;updateButtons();renderReview();message('動画を読み込んでいます…');
    try {
      await new Promise((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',ok);video.removeEventListener('error',fail);};
        const ok=()=>{cleanup();resolve();};const fail=()=>{cleanup();reject(new Error('この動画を再生できません。MP4（H.264）やWebM形式に変換してお試しください。'));};
        const timer=setTimeout(()=>{cleanup();reject(new Error('動画の読み込みに時間がかかっています。短い動画や別形式でお試しください。'));},20000);
        video.addEventListener('loadeddata',ok,{once:true});video.addEventListener('error',fail,{once:true});
        if(video.readyState>=2) ok();
      });
      if(loadId!==review.loadId)return;
      if (!Number.isFinite(video.duration)||video.duration<=0) throw new Error('動画の長さを取得できません。別形式で保存してお試しください。');
      review.ready=true;
      v$('video-start').value=0;v$('video-end').value=Number(video.duration.toFixed(3));
      v$('video-file-meta').textContent=`${formatVideoTime(video.duration,'.')} / ${video.videoWidth} × ${video.videoHeight}`;
      updateCrop();updateEstimate();updateButtons();message('動画を読み込みました。テロップの位置を指定し、「この画面を読む」または「テロップを読み取る」を押してください。');
    } catch(e) {if(loadId!==review.loadId)return;review.ready=false;v$('video-file-meta').textContent='再生できません';v$('video-crop-overlay').hidden=true;message(e.message,true);updateButtons();}
  }
  async function scanVideo(manual) {
    if(!review.ready||review.busy)return;
    if(!updateCrop()) return message('読み取り範囲を確認してください。左＋幅、上＋高さはそれぞれ100%以内にしてください。',true);
    let times,end;
    try {if(manual){times=[video.currentTime];end=Math.min(video.duration,video.currentTime+Number(v$('video-interval').value));}else({times,end}=samplePlan());}
    catch(e){return message(e.message,true);}
    if(!manual&&review.rows.length&&!window.confirm('前の読み取り結果を消して、指定範囲を読み取り直しますか？'))return;
    if(!manual)review.rows=[];
    review.busy=true;review.abort=new AbortController();const signal=review.abort.signal;
    video.pause();updateButtons();renderReview();v$('video-progress').hidden=false;v$('video-progress-bar').value=0;
    v$('video-progress-label').textContent='日本語OCRを準備しています…';message('動画のテロップを読み取り中です。音声は処理しません。');
    let processed=0,last=null;
    let initialTimeout;
    try {
      const workerPromise=createLocalOcrWorker(event=>{if(signal.aborted)return;if(processed===0&&event.status!=='recognizing text')v$('video-progress-label').textContent='日本語OCRを準備しています…';});
      workerPromise.then(worker=>{if(signal.aborted)worker.terminate();},()=>{});
      initialTimeout=setTimeout(()=>review.abort.abort(),90000);
      review.worker=await abortable(workerPromise,signal);clearTimeout(initialTimeout);
      for (let i=0;i<times.length;i++) {
        if(signal.aborted)throw abortError();
        await seekTo(times[i],signal);
        const frame=capture();
        v$('video-progress-label').textContent=`${i+1} / ${times.length}枚 · ${formatVideoTime(times[i],'.')} を読み取り中`;
        const result=await abortable(review.worker.recognize(frame.canvas),signal);
        if(signal.aborted)throw abortError();
        const text=result.data.text.replace(/\r/g,'').trim();
        const nextEnd=Math.min(end,times[i]+Number(v$('video-interval').value));
        if(text){
          if(!manual&&last&&normalizedCaption(last.raw)===normalizedCaption(text))last.end=nextEnd;
          else {
            const duplicate=manual?review.rows.find(r=>Math.abs(r.time-times[i])<.05):null;
            const row={id:duplicate?.id||crypto.randomUUID(),time:times[i],end:Math.max(times[i]+.001,nextEnd),raw:text,text,confidence:Number(result.data.confidence)||0,image:frame.image,ignored:[]};
            if(duplicate)review.rows.splice(review.rows.indexOf(duplicate),1,row);else review.rows.push(row);
            review.rows.sort((a,b)=>a.time-b.time);
            last=row;
          }
        }else last=null;
        processed++;v$('video-progress-bar').value=Math.round(processed/times.length*100);
        renderReview();
      }
      message(review.rows.length?`読み取り完了：${processed}枚から${review.rows.length}件のテロップを抽出しました。まず画像と文字を見比べて、OCRの読み間違いを確認してください。`:`${processed}枚を読み取りましたが、文字を抽出できませんでした。再生位置・テロップ範囲・画質を確認してお試しください。`);
      v$('video-progress-label').textContent=`${processed} / ${times.length}枚 · 完了`;
    }catch(e){
      const stopped=signal.aborted||e.name==='AbortError';
      message(stopped?`読み取りを停止しました（${processed} / ${times.length}枚）。抽出済みの結果は残っています。`:`読み取りに失敗しました。${e.message||'ブラウザのWebAssembly・Web Worker設定とOCRファイルを確認してください。'} 抽出済みの結果は残っています。`,!stopped);
      v$('video-progress-label').textContent=stopped?'停止しました':'読み取りに失敗しました';
    }finally{clearTimeout(initialTimeout);if(review.worker){await review.worker.terminate();review.worker=null;}review.busy=false;review.abort=null;updateButtons();}
  }
  for(const id of ['video-choose','video-change'])v$(id).addEventListener('click',()=>v$('video-file').click());
  v$('video-file').addEventListener('change',event=>{loadVideo(event.target.files[0]);event.target.value='';});
  for(const type of ['dragenter','dragover'])v$('video-drop').addEventListener(type,event=>{event.preventDefault();if(!review.busy)v$('video-drop').classList.add('dragging');});
  for(const type of ['dragleave','drop'])v$('video-drop').addEventListener(type,event=>{event.preventDefault();v$('video-drop').classList.remove('dragging');if(type==='drop')loadVideo(event.dataTransfer.files[0]);});
  v$('video-crop-preset').addEventListener('change',()=>{
    const preset=v$('video-crop-preset').value;
    if(preset==='custom'){v$('video-crop-details').open=true;return;}
    const y=preset==='bottom'?65:preset==='half'?50:0;
    v$('video-crop-x').value=0;v$('video-crop-y').value=y;v$('video-crop-w').value=100;v$('video-crop-h').value=100-y;updateCrop();
  });
  for(const key of ['x','y','w','h'])v$(`video-crop-${key}`).addEventListener('input',()=>{v$('video-crop-preset').value='custom';updateCrop();});
  for(const id of ['video-start','video-end','video-interval'])v$(id).addEventListener('input',updateEstimate);
  v$('video-scan').addEventListener('click',()=>scanVideo(false));v$('video-current').addEventListener('click',()=>scanVideo(true));
  v$('video-stop').addEventListener('click',()=>{review.abort?.abort();review.worker?.terminate();review.worker=null;});
  v$('video-review-filters').addEventListener('click',event=>{const b=event.target.closest('[data-video-filter]');if(!b)return;review.filter=b.dataset.videoFilter;document.querySelectorAll('[data-video-filter]').forEach(el=>el.classList.toggle('active',el===b));renderReview();});
  v$('video-captions').addEventListener('change',event=>{
    const id=event.target.dataset.captionEdit;if(!id||review.busy)return;
    const row=review.rows.find(r=>r.id===id);if(!row)return;
    row.text=event.target.value;row.ignored=[];renderReview();
  });
  v$('video-captions').addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    const id=b.dataset.videoJump||b.dataset.videoApply||b.dataset.videoIgnore;
    const row=review.rows.find(r=>r.id===id);if(!row)return;
    if(b.dataset.videoJump){if(review.busy)return notify('読み取りを停止してから、動画の位置を変更してください。');try{video.pause();await seekTo(row.time);v$('video-drop').scrollIntoView({behavior:'smooth',block:'center'});}catch(e){message(e.message,true);}return;}
    if(review.busy)return;
    const issue=findings(row).find(f=>f.id===b.dataset.issueId);if(!issue)return;
    if(b.dataset.videoApply)row.text=applyFindings(row.text,[issue]);else row.ignored.push(issue.id);
    renderReview();
  });
  v$('video-report').addEventListener('click',()=>{
    const link=document.createElement('a');const url=URL.createObjectURL(new Blob([videoReportCsv(review.rows,findings)],{type:'text/csv;charset=utf-8'}));
    link.href=url;link.download=`${review.file.name.replace(/\.[^.]+$/,'')}_telop-review.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  v$('video-to-editor').addEventListener('click',()=>{
    const srt=captionsToSrt(review.rows);
    if(srt.length>50000)return notify('50,000文字を超えるため、確認レポートCSVで書き出してください。');
    onTextExport(srt,`${review.file.name.replace(/\.[^.]+$/,'')}_ocr.srt`);
  });
  document.querySelector('[data-view="video"]').addEventListener('click',renderReview);
  window.addEventListener('pagehide',()=>{review.abort?.abort();review.worker?.terminate();if(review.url)URL.revokeObjectURL(review.url);});
  updateButtons();
}
