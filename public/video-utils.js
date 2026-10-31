export function formatVideoTime(seconds, separator = ',') {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = String(total % 1000).padStart(3, '0');
  const s = Math.floor(total / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2,'0')}:${String(Math.floor(s / 60) % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}${separator}${ms}`;
}
export function buildSampleTimes(start, end, interval, maxFrames = 600) {
  if (![start,end,interval].every(Number.isFinite) || start < 0 || end <= start || interval < .5) throw new Error('読み取り範囲と間隔を確認してください。終了は開始より後に指定してください。');
  const count = Math.ceil((end-start)/interval);
  if (count > maxFrames) throw new Error(`一度に読み取れるのは${maxFrames}フレームまでです。時間範囲を短くするか、間隔を長くしてください。`);
  return Array.from({length:count}, (_,i) => Math.min(start+i*interval, end-.001));
}
export function videoCropRect(width, height, crop) {
  const x = Math.round(width * Math.max(0,Math.min(99,crop.x))/100);
  const y = Math.round(height * Math.max(0,Math.min(99,crop.y))/100);
  return {x,y,width:Math.max(1,Math.min(width-x,Math.round(width*crop.w/100))),height:Math.max(1,Math.min(height-y,Math.round(height*crop.h/100)))};
}
export function normalizedCaption(text) { return text.replace(/\s+/g,'').trim(); }
export function normalizeOcrText(text) {
  // Keep the raw OCR separately. Only join spacing inserted between Japanese
  // characters; English word spaces and line boundaries remain intact.
  return text.replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[ \t\u3000]+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,'');
}
export function assessCaption(row) {
  const reasons=[];
  if (!Number.isFinite(row.confidence) || row.confidence < 70) reasons.push('OCRスコアが70未満');
  const compact=String(row.text||'').replace(/\s/g,'');
  const latin=(compact.match(/[A-Za-z]/g)||[]).length;
  const japanese=(compact.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)||[]).length;
  if(compact.length>=8 && latin>=6 && japanese>0 && latin/compact.length>=.4) reasons.push('日本語の中に英字が多く混在');
  return {needsReview:reasons.length>0,reasons};
}
export function captionsToSrt(captions) {
  return captions.filter(c=>c.text.trim()).map((c,i)=>`${i+1}\n${formatVideoTime(c.time)} --> ${formatVideoTime(c.end)}\n${c.text.trim()}\n`).join('\n');
}
export function videoReportCsv(captions, getFindings) {
  // Force text fields to prevent spreadsheet formula evaluation of OCR/user text.
  const cell = value => {
    let s = String(value ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g,'""')}"`;
  };
  const rows = [['開始時刻','終了時刻（概算）','OCR原文（自動読取・未保証）','確認用テキスト','辞書の修正候補','OCRスコア','確認状態','読み取りの注意点']];
  for (const c of captions) rows.push([formatVideoTime(c.time,'.'),formatVideoTime(c.end,'.'),c.raw,c.text,getFindings(c).map(f=>`${f.from} → ${f.to}`).join(' / '),Math.round(c.confidence),c.confirmed?'画像と照合済み':'未確認',assessCaption(c).reasons.join(' / ')]);
  return '\uFEFF' + rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
