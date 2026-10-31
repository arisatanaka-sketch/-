import { checkText, applyFindings } from './checker.js';
import { initVideoReview } from './video.js';

const $ = id => document.getElementById(id);
const editor = $('text-input');
const MAX = 50000;
const state = { findings: [], checked: false, ignored: [], undo: [], filter: 'all', fileName: '', custom: [], history: [] };
const sample = `1\n00:00:01,000 --> 00:00:05,000\n皆さん、こんにちわ。今週の競馬予想をお届けします。\n\n2\n00:00:05,500 --> 00:00:11,000\n今回は天皇賞春の注目馬と、追いきりの様子を見ていきましょう。\n\n3\n00:00:11,500 --> 00:00:17,000\nこの馬に騎上するのは、前走でも好走したジョッキーです。\n\n4\n00:00:17,500 --> 00:00:24,000\n以外と人気がありませんが、復勝の候補としても注目しています。\n\n5\n00:00:24,500 --> 00:00:30,000\n皆さんの予想も、ぜひコメントで教えてください。`;
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
function readStored(key) { try { const val = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(val) ? val : []; } catch { return []; } }
state.custom = readStored('keiba-proof-dictionary').filter(x => x && typeof x.from === 'string' && typeof x.to === 'string' && x.from.length > 0 && x.from.length <= 100 && x.to.length > 0 && x.to.length <= 100 && x.from !== x.to);
state.history = readStored('keiba-proof-history').filter(x => x && typeof x.name === 'string' && typeof x.date === 'string' && Number.isFinite(x.chars) && Number.isFinite(x.count)).slice(0, 30);
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('ブラウザへの保存ができませんでした。この画面では引き続き使えます。'); } }
function escapeHTML(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function categories() { return [...document.querySelectorAll('.check-options input:checked')].map(x => x.value); }
function updateEditor() {
  const length = editor.value.length;
  $('char-count').textContent = length.toLocaleString('ja-JP');
  $('editor-empty-icon').hidden = length > 0;
  $('copy-button').disabled = $('download-button').disabled = !length;
  $('check-button').disabled = !length || length > MAX;
  $('char-count').style.color = length > MAX ? '#b56452' : '';
  $('file-label').textContent = state.fileName || 'TXT / SRT / VTT 対応 · ドラッグ＆ドロップ可';
}
function invalidate() {
  state.checked = false; state.findings = []; state.ignored = []; state.undo = [];
  $('result-count').textContent = '—'; $('status-pill').textContent = 'チェック待ち'; $('status-pill').className = 'status-pill';
  $('results-empty').hidden = false; $('results-content').hidden = true;
  $('step-check').classList.remove('current'); $('step-export').classList.remove('current');
  updateEditor();
}
function scan() { state.findings = checkText(editor.value, { custom: state.custom, ignored: state.ignored, categories: categories() }); renderResults(); updateEditor(); }
function renderResults() {
  $('results-empty').hidden = true; $('results-content').hidden = false;
  $('result-count').textContent = state.findings.length;
  $('findings-total').textContent = state.findings.length;
  $('status-pill').textContent = 'チェック済み'; $('status-pill').className = 'status-pill done';
  $('apply-all').disabled = state.findings.length === 0;
  $('undo-button').disabled = !state.undo.length;
  $('step-check').classList.add('current'); $('step-export').classList.toggle('current', state.findings.length === 0);
  $('results-note').textContent = state.ignored.length ? `${state.ignored.length} 件を無視 · 編集すると再チェックします` : '候補を確認してから適用してください';
  const shown = state.findings.filter(f => state.filter === 'all' || state.filter === f.category);
  $('findings-list').innerHTML = shown.length ? shown.map(f => {
    const categoryClass = f.category === '誤字・脱字' ? 'typo' : f.category === '表記ゆれ' ? 'style' : '';
    const context = `${escapeHTML(f.context.slice(0, f.contextOffset))}<mark>${escapeHTML(f.from)}</mark>${escapeHTML(f.context.slice(f.contextOffset + f.from.length))}`;
    return `<article class="finding"><div class="finding-meta"><span class="category-badge ${categoryClass}">${escapeHTML(f.category)}</span><span>${f.time ? escapeHTML(f.time) : `${f.line} 行目`}</span></div><div class="finding-replacement"><del>${escapeHTML(f.from)}</del><span>→</span><strong>${escapeHTML(f.to)}</strong></div><button class="finding-context" data-jump="${escapeHTML(f.id)}" title="該当箇所を選択">${context}</button><p class="finding-reason">${escapeHTML(f.reason)}</p><div class="finding-actions"><button data-ignore="${escapeHTML(f.id)}">無視</button><button data-apply="${escapeHTML(f.id)}">適用する ✓</button></div></article>`;
  }).join('') : `<div class="success-state"><svg><use href="#i-check"/></svg><h3>${state.findings.length ? 'この項目の候補はありません' : '修正候補はありません'}</h3><p>${state.findings.length ? '別の項目も確認してみましょう。' : '辞書に一致する誤記は見つかりませんでした。<br>内容を確認したら、書き出して制作のつづきへ。'}</p></div>`;
}
function runCheck() {
  if (!editor.value.trim()) return toast('チェックするテキストを入力してください。');
  if (editor.value.length > MAX) return toast('50,000 文字以内で入力してください。');
  if (!categories().length && !state.custom.length) return toast('チェック項目を1つ以上選択してください。');
  state.ignored = []; state.undo = []; state.checked = true; scan();
  state.history.unshift({ date: new Date().toISOString(), name: state.fileName || 'テキスト入力', chars: editor.value.length, count: state.findings.length });
  state.history = state.history.slice(0,30); save('keiba-proof-history', state.history);
  toast(`${state.findings.length} 件の修正候補が見つかりました。`);
}
function remember() { state.undo.push({ text: editor.value, ignored: [...state.ignored] }); if (state.undo.length > 50) state.undo.shift(); }
function apply(selected) {
  if (!selected.length) return;
  remember(); editor.value = applyFindings(editor.value, selected); state.ignored = []; scan(); toast(`${selected.length} 件の修正を適用しました。`);
}
editor.addEventListener('input', invalidate);
$('check-button').addEventListener('click', runCheck);
document.querySelectorAll('.check-options input').forEach(el => el.addEventListener('change', invalidate));
$('sample-button').addEventListener('click', () => {
  if (editor.value && !window.confirm('入力中のテキストをサンプルに置き換えますか？')) return;
  editor.value = sample; state.fileName = 'sample.srt'; invalidate(); runCheck();
});
$('apply-all').addEventListener('click', () => apply(state.findings));
$('undo-button').addEventListener('click', () => { const prev = state.undo.pop(); if (!prev) return; editor.value = prev.text; state.ignored = prev.ignored; scan(); toast('ひとつ前の状態に戻しました。'); });
$('findings-list').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const id = button.dataset.apply || button.dataset.ignore || button.dataset.jump;
  const finding = state.findings.find(f => f.id === id); if (!finding) return;
  if (button.dataset.apply) apply([finding]);
  else if (button.dataset.ignore) { remember(); state.ignored.push(finding.id); scan(); }
  else { editor.focus(); editor.setSelectionRange(finding.start, finding.end); editor.scrollTop = Math.max(0, (finding.line - 4) * 26); }
});
$('result-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderResults();
});
$('upload-tab').addEventListener('click', () => $('file-input').click());
$('paste-tab').addEventListener('click', () => editor.focus());
async function loadFile(file) {
  if (!file) return;
  if (!/\.(txt|srt|vtt)$/i.test(file.name)) return toast('TXT・SRT・VTT ファイルを選択してください。');
  if (file.size > MAX * 4) return toast('ファイルが大きすぎます。50,000 文字以内のファイルを選択してください。');
  try {
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.length > MAX) return toast('50,000 文字以内のファイルを選択してください。');
    if (editor.value && !window.confirm('入力中のテキストを読み込んだファイルに置き換えますか？')) return;
    editor.value = text; state.fileName = file.name; invalidate(); toast(`${file.name} を読み込みました。`);
  } catch { toast('ファイルを読み込めませんでした。UTF-8 形式で保存して再度お試しください。'); }
}
$('file-input').addEventListener('change', event => { loadFile(event.target.files[0]); event.target.value = ''; });
for (const type of ['dragenter','dragover']) $('drop-zone').addEventListener(type, event => { event.preventDefault(); $('drop-zone').classList.add('dragging'); });
for (const type of ['dragleave','drop']) $('drop-zone').addEventListener(type, event => { event.preventDefault(); $('drop-zone').classList.remove('dragging'); if(type === 'drop') loadFile(event.dataTransfer.files[0]); });
// Keep unsupported files dropped outside the editor from navigating away.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
$('copy-button').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(editor.value); toast('テキストをコピーしました。'); }
  catch { editor.focus(); editor.select(); toast('コピー権限がありません。選択したテキストを Ctrl/Cmd+C でコピーしてください。'); }
});
$('download-button').addEventListener('click', () => {
  const ext = state.fileName.match(/\.(txt|srt|vtt)$/i)?.[1].toLowerCase() || 'txt';
  const base = state.fileName ? state.fileName.replace(/\.[^.]+$/, '') : 'keiba-proof';
  const blob = new Blob([editor.value], { type: ext === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8' });
  const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = `${base}_checked.${ext}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('修正済みファイルを書き出しました。');
});
function renderDictionary() {
  $('dictionary-count').textContent = state.custom.length;
  $('dictionary-list').innerHTML = state.custom.length ? state.custom.map((r,i) => `<div class="dictionary-row"><span>${escapeHTML(r.from)}</span><span>→</span><strong>${escapeHTML(r.to)}</strong><button data-delete="${i}" aria-label="${escapeHTML(r.from)} のルールを削除">削除</button></div>`).join('') : '<p class="list-empty">まだルールはありません。よく使う言葉を登録しましょう。</p>';
}
$('dictionary-form').addEventListener('submit', event => {
  event.preventDefault(); const from = $('dict-from').value.trim(), to = $('dict-to').value.trim();
  if (!from || !to || from === to) return toast('検出する表記と修正後の表記を別の言葉で入力してください。');
  if (state.custom.some(r => r.from === from)) return toast('その表記は登録済みです。削除してから登録し直してください。');
  state.custom.push({ from, to }); save('keiba-proof-dictionary', state.custom); $('dictionary-form').reset(); renderDictionary(); invalidate(); toast('ユーザー辞書に登録しました。');
});
$('dictionary-list').addEventListener('click', event => { const button = event.target.closest('[data-delete]'); if (!button) return; state.custom.splice(Number(button.dataset.delete), 1); save('keiba-proof-dictionary', state.custom); renderDictionary(); invalidate(); toast('ルールを削除しました。'); });
function renderHistory() {
  $('history-list').innerHTML = state.history.length ? state.history.map(h => `<div class="history-row"><svg><use href="#i-file"/></svg><div><strong>${escapeHTML(h.name)}</strong><small>${escapeHTML(new Date(h.date).toLocaleString('ja-JP'))}</small></div><span>${h.chars.toLocaleString('ja-JP')} 文字</span><span>候補 ${h.count} 件</span></div>`).join('') : '<p class="list-empty">チェック履歴はまだありません。</p>';
  $('clear-history').disabled = !state.history.length;
}
$('clear-history').addEventListener('click', () => { if (!window.confirm('すべてのチェック履歴を削除しますか？')) return; state.history = []; save('keiba-proof-history', []); renderHistory(); toast('履歴を削除しました。'); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.view;
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `${view}-view`);
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el === button);
    if (el === button) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  $('breadcrumb-current').textContent = view === 'video' ? '動画テロップチェック' : view === 'workspace' ? 'テキストチェック' : view === 'dictionary' ? 'ユーザー辞書' : 'チェック履歴';
  if (view === 'history') renderHistory(); if (view === 'dictionary') renderDictionary(); window.scrollTo(0,0);
}));
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
document.querySelector('.dialog-close').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
renderDictionary(); updateEditor();
initVideoReview({
  getDictionary: () => state.custom,
  notify: toast,
  onTextExport: (text, name) => {
    if (editor.value && !window.confirm('テキスト校正の入力を、動画から読み取った文字に置き換えますか？')) return;
    editor.value=text;state.fileName=name;invalidate();
    document.querySelector('[data-view="workspace"]').click();runCheck();
    toast('動画から読み取った文字を転記しました。字幕の区切り時刻はサンプリング間隔に基づく概算です。');
  },
});
