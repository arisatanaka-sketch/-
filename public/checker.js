// Conservative dictionary rules: never infer or silently rewrite horse names.
export const rules = [
  ['皐月賞典', '皐月賞', '競馬用語', 'レースの正式名称は「皐月賞」です。'],
  ['天皇賞春', '天皇賞（春）', '表記ゆれ', '春・秋の区別は括弧で表記すると読みやすくなります。'],
  ['天皇賞秋', '天皇賞（秋）', '表記ゆれ', '春・秋の区別は括弧で表記すると読みやすくなります。'],
  ['追いきり', '追い切り', '表記ゆれ', '調教を表す用語は「追い切り」に統一するのがおすすめです。'],
  ['騎乗停止', '騎乗停止', '', ''],
  ['騎上', '騎乗', '誤字・脱字', '馬に乗ることは「騎乗」と表記します。'],
  ['出走表明', '出走表明', '', ''],
  ['出層', '出走', '誤字・脱字', 'レースに出ることは「出走」です。'],
  ['複勝率', '複勝率', '', ''],
  ['復勝', '複勝', '競馬用語', '馬券の種類を表す正しい表記は「複勝」です。'],
  ['単証', '単勝', '競馬用語', '馬券の種類を表す正しい表記は「単勝」です。'],
  ['馬番連複', '馬番連勝複式', '競馬用語', '正式名称への修正候補です。略称「馬連」も使われます。'],
  ['未勝利戦戦', '未勝利戦', '誤字・脱字', '「戦」が重複しています。'],
  ['シュミレーション', 'シミュレーション', '誤字・脱字', '一般的な表記は「シミュレーション」です。'],
  ['以外と', '意外と', '誤字・脱字', '「思いのほか」という意味なら「意外と」です。文脈を確認してください。'],
  ['確立が高', '確率が高', '誤字・脱字', '起こりやすさを表す場合は「確率」を使います。'],
  ['こんにちわ', 'こんにちは', '誤字・脱字', '挨拶は「こんにちは」と表記します。'],
  ['出来る', 'できる', '表記ゆれ', '読みやすさのため、ひらがなへの統一を提案します。'],
  ['と言う', 'という', '表記ゆれ', '引用・説明の表現では、ひらがなへの統一を提案します。']
].filter(r => r[2]);

export function checkText(text, { custom = [], ignored = [], categories = ['競馬用語', '誤字・脱字', '表記ゆれ'] } = {}) {
  const active = [...custom.map(r => [r.from, r.to, 'ユーザー辞書', 'ユーザー辞書に登録された表記です。']), ...rules];
  const findings = [];
  const occupied = [];
  for (const [from, to, category, reason] of active) {
    if (!from || from === to || (!categories.includes(category) && category !== 'ユーザー辞書')) continue;
    let pos = 0;
    while ((pos = text.indexOf(from, pos)) !== -1) {
      const start = pos, end = pos + from.length;
      pos = end;
      const id = `${start}:${end}:${from}:${to}`;
      if (occupied.some(([s,e]) => start < e && end > s)) continue;
      occupied.push([start,end]);
      if (ignored.includes(id)) continue;
      const before = text.slice(0, start);
      const line = before.split('\n').length;
      const lineStart = before.lastIndexOf('\n') + 1;
      const nextBreak = text.indexOf('\n', end);
      const contextEnd = nextBreak < 0 ? text.length : nextBreak;
      const timestamps = before.match(/(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->/g);
      const time = timestamps?.at(-1)?.replace(/\s*-->$/, '').replace(',', '.') || null;
      findings.push({ id, start, end, from, to, category, reason, line, time, context: text.slice(lineStart, contextEnd), contextOffset: start - lineStart });
    }
  }
  return findings.sort((a,b) => a.start - b.start);
}

export function applyFindings(text, findings) {
  return [...findings].sort((a,b) => b.start - a.start).reduce((result, f) => result.slice(0,f.start) + f.to + result.slice(f.end), text);
}
