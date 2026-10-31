function decodeOcrBase64(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

export async function createLocalOcrWorker(logger) {
  const packed = document.getElementById('ocr-packed-assets');
  const urls = [];
  let workerPath, corePath, langPath;
  if (packed) {
    const assets = JSON.parse(packed.textContent);
    if (!window.Tesseract) {
      const script = document.createElement('script');
      script.textContent = new TextDecoder().decode(decodeOcrBase64(assets.library));
      document.head.append(script);
    }
    // A classic worker with the intact core preloaded. Model fetches resolve from
    // the bundled files instead of the network, including when opened as a file.
    const bootstrap = `const localOcrModels = ${JSON.stringify({jpn:assets.jpn,eng:assets.eng})};\nself.fetch = async function(resource) {\n const match = String(resource).match(/(?:^|\\/)embedded-ocr-data\\/(jpn|eng)\\.traineddata\\.gz$/);\n if (!match) throw new Error('Unexpected network request in offline OCR');\n return new Response(Uint8Array.from(atob(localOcrModels[match[1]]), c => c.charCodeAt(0)));\n};\n`;
    const code = bootstrap + new TextDecoder().decode(decodeOcrBase64(assets.core)) + '\n' + new TextDecoder().decode(decodeOcrBase64(assets.worker));
    workerPath = URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
    urls.push(workerPath);
    corePath = 'embedded-core.js'; // Preloaded global.TesseractCore is reused.
    langPath = 'embedded-ocr-data';
  } else {
    const base = new URL('./vendor/ocr/', document.baseURI);
    if (!window.Tesseract) await new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = new URL('tesseract.min.js',base).href;
      script.onload = resolve;
      script.onerror = () => {script.remove();reject(new Error('OCRファイルを読み込めません。npm ci と npm run prepare:ocr を実行してください。'));};
      document.head.append(script);
    });
    workerPath = new URL('worker.min.js',base).href;
    corePath = new URL('core.wasm.js',base).href;
    langPath = base.href.replace(/\/$/,'');
  }
  try {
    const worker = await window.Tesseract.createWorker('jpn+eng',1,{
      workerPath,corePath,langPath,workerBlobURL:!packed,cacheMethod:'none',logger,
      errorHandler: () => {},
    });
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    return worker;
  } finally { for (const url of urls) URL.revokeObjectURL(url); }
}
