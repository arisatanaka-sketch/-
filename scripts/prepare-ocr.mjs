import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(project, 'public/vendor/ocr');
await mkdir(output, { recursive: true });
const assets = {
  'tesseract.min.js': 'tesseract.js/dist/tesseract.min.js',
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'core.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'jpn.traineddata.gz': '@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'TESSERACT-LICENSE.txt': 'tesseract.js/LICENSE.md',
  'CORE-LICENSE.txt': 'tesseract.js-core/LICENSE',
  'tesseract.min.js.LICENSE.txt': 'tesseract.js/dist/tesseract.min.js.LICENSE.txt',
  'worker.min.js.LICENSE.txt': 'tesseract.js/dist/worker.min.js.LICENSE.txt',
};
for (const [name, source] of Object.entries(assets)) await copyFile(path.join(project,'node_modules',source),path.join(output,name));
const modelPackages = await Promise.all(['jpn','eng'].map(lang => readFile(path.join(project, 'node_modules/@tesseract.js-data',lang,'package.json'),'utf8')));
await writeFile(path.join(output,'MODEL-NOTICES.txt'), `Tesseract language models: https://github.com/naptha/tessdata\nPackage metadata:\n${modelPackages.join('\n')}\n`);
console.log('Local Japanese/English OCR assets prepared. No CDN requests are needed.');
