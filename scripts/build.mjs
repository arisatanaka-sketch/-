import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(root, 'public', name), 'utf8');
const [template, css, favicon] = await Promise.all(['index.html', 'style.css', 'favicon.svg'].map(read));
// The downloadable version makes no font/asset requests and needs no server.
const styles = css.replace(/^@import\s+url\([^\n]+\);\s*/m, '');
const modules = await Promise.all(['checker.js','video-utils.js','media-loader.js','ocr-engine.js','video.js','app.js'].map(read));
const logic = modules.map(source => source.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,'')).join('\n');
const assets = {};
assets.demo = (await readFile(path.join(root,'public/demo.mp4'))).toString('base64');
for (const [key,name] of Object.entries({library:'tesseract.min.js',worker:'worker.min.js',core:'core.wasm.js',jpn:'jpn.traineddata.gz',eng:'eng.traineddata.gz'})) {
  assets[key] = (await readFile(path.join(root,'public/vendor/ocr',name))).toString('base64');
}
assets.notices = (await Promise.all(['TESSERACT-LICENSE.txt','CORE-LICENSE.txt','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt','MODEL-NOTICES.txt'].map(name=>readFile(path.join(root,'public/vendor/ocr',name),'utf8')))).join('\n\n');
const html = template
  .replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="/style.css">', `<style>\n${styles}\n</style>`)
  .replace('class="brand" href="/"', 'class="brand" href="#"')
  .replace('<script type="module" src="/app.js"></script>', `<script id="ocr-packed-assets" type="application/json">${JSON.stringify(assets).replace(/</g,'\\u003c')}</script>\n<script type="module">\n${logic.replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (/src="\//.test(html) || /href="\/(?!\/)/.test(html) || /@import/.test(html)) throw new Error('Standalone output still has external asset dependencies');
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist', 'keiba-proof.html'), html);
await writeFile(path.join(root, 'dist', 'index.html'), html);
console.log('Created dist/index.html for web hosting and dist/keiba-proof.html for download.');
