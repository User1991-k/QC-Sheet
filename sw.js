/* QC Survey App SW v261 clean DC sketch without drawn safe-area boundary. */
const CACHE = 'qc-survey-v321-mobile-hardening';
/* v296: the app shell includes the local Arabic/English OCR engine and models so
   recognition remains available offline; unrelated heavy libraries still cache on first use. */
const SHELL = [
  './',
  './index.html',
  './features.js?v=321.0',
  './features.css',
  './i18n.js',
  './converters.js',
  './converters.css',
  './rd-line-detection.js?v=315.0',
  './rd-line-detection.css?v=315.0',
  './survey-pro.js',
  './survey-pro.css',
  './survey-pro-advanced.js',
  './survey-pro-advanced.css',
  './educational-guide.js',
  './educational-guide.css',
  './qc-ai-reference.js?v=299.0',
  './qc-assistant-learning.js?v=292.1',
  './qc-assistant-learning.css?v=293.0',
  './qc-assistant-knowledge.js?v=293.0',
  './qc-assistant.js?v=296.2',
  './qc-assistant.css?v=293.0',
  './qc-field-coach.js?v=321.0',
  './qc-field-coach.css?v=321.0',
  './ts-project-info.js?v=294.0',
  './ts-project-info.css?v=294.0',
  './ts-batch-ocr.css?v=299.0',
  './electronic-signature.js?v=295.0',
  './electronic-signature.css?v=295.0',
  './ui-workspace.js?v=282.0',
  './page-navigation-pro.js',
  './ui-workspace.css',
  './responsive-topbar.css',
  './smart-datetime.js?v=285.0',
  './smart-datetime.css?v=285.0',
  './design-system-pro.js?v=321.0',
  './design-system-pro.css?v=316.0',
  './bilingual-translation.css?v=286.0',
  './bilingual-translation.js?v=286.0',
  './global-quality.js',
  './global-quality.css',
  './vendor/three-r128.min.js',
  './vendor/OrbitControls-r128.js',
  './dc-flange.js?v=321.0',
  './dc-flange-pro.js?v=317.0',
  './dc-sketch-pro.js',
  './dc-flange.css?v=317.0',
  './dc-flange-pro.css?v=317.0',
  './dc-sketch-pro.css',
  './gpr-logging.js',
  './gpr-logging.css',
  './dpr.js?v=288.0',
  './dpr.css?v=288.0',
  './mobile-mapping.js?v=278.0',
  './mobile-mapping.css?v=278.0',
  './exceljs-local.min.js',
  './gpr-columns-pro.css',
  './navigation-wrap-touch.css',
  './page-navigation-pro.css',
  './backfilling.js',
  './backfilling.css',
  './fonts/NotoSansArabic-Variable.ttf',
  './fonts/Cairo-Variable.ttf',
  './fonts/Inter-Variable.ttf',
  './fonts/NotoKufiArabic-Variable.ttf',
  './fonts/NotoNaskhArabic-Variable.ttf',
  './fonts/Tajawal-Regular.ttf',
  './fonts/Tajawal-Bold.ttf',
  './fonts/Almarai-Regular.ttf',
  './fonts/Almarai-Bold.ttf',
  './fonts/OFL-Noto-Arabic.txt',
  './fonts/OFL-Tajawal.txt',
  './fonts/OFL-Almarai.txt',
  './docs/QC-Survey-Educational-Guide-AR.pdf',
  './docs/QC-Survey-Educational-Guide-EN.pdf',
  './voice-entry.js',
  './voice-entry.css',
  './smart-entry-pro.js?v=318.0',
  './smart-entry-pro.css?v=296.0',
  './ocr-ai-pro.css?v=296.0',
  './smart-quality-pro.js',
  './smart-quality-pro.css',
  './ui-polish-v320.js?v=321.0',
  './ui-polish-v320.css?v=321.0',
  './universal-field-engine-v320.js?v=321.0',
  './universal-field-engine-v320.css?v=321.0',
  './page-lifecycle-v320.js?v=321.0',
  './page-lifecycle-v320.css?v=321.0',
  './mobile-hardening-v321.css?v=321.0',
  './pdfjs-local.mjs',
  './pdfjs-worker-local.mjs',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/lang/eng.traineddata.gz',
  './vendor/tesseract/lang/ara.traineddata.gz',
  './enterprise.js',
  './enterprise.css',
  './protection.js',
  './protection.css',
  './vendor/qrcode.min.js',
  './vendor/jsQR.js',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(()=>null).then(()=>self.skipWaiting()));
});
/* v204: تفعيل فوري بطلب الصفحة (زر «حدّث الآن») ⟶ لا يبقى المستخدم على نسخة قديمة */
self.addEventListener('message', (e) => {
  if (e && e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k!==CACHE).map((k)=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then((res)=>{const x=res.clone(); caches.open(CACHE).then((c)=>c.put('./index.html', x)).catch(()=>{}); return res;}).catch(()=>caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then((cached)=> cached || fetch(req).then((res)=>{ if(res&&res.ok){const x=res.clone(); caches.open(CACHE).then((c)=>c.put(req,x)).catch(()=>{});} return res; })));
  }
});
