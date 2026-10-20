/* QC Survey App SW v261 clean DC sketch without drawn safe-area boundary. */
const CACHE = 'qc-survey-v292-installed-reference';
/* v186: الكاش التلقائي = «الهيكل» فقط (صفحة + مكتبة الواجهة + الأيقونات).
   المكتبات الثقيلة ومحرك OCR تُخزَّن عند أول استخدام ⟶ أول تحميل أخفّ بكثير. */
const SHELL = [
  './',
  './index.html',
  './features.js',
  './features.css',
  './i18n.js',
  './converters.js',
  './converters.css',
  './rd-line-detection.js?v=282.0',
  './rd-line-detection.css?v=282.0',
  './survey-pro.js',
  './survey-pro.css',
  './survey-pro-advanced.js',
  './survey-pro-advanced.css',
  './educational-guide.js',
  './educational-guide.css',
  './qc-ai-reference.js?v=292.0',
  './qc-assistant-learning.js?v=292.1',
  './qc-assistant-learning.css?v=292.0',
  './qc-assistant-knowledge.js?v=292.0',
  './qc-assistant.js?v=292.0',
  './qc-assistant.css?v=292.0',
  './qc-field-coach.js?v=292.0',
  './qc-field-coach.css?v=292.0',
  './ui-workspace.js?v=282.0',
  './page-navigation-pro.js',
  './ui-workspace.css',
  './responsive-topbar.css',
  './smart-datetime.js?v=285.0',
  './smart-datetime.css?v=285.0',
  './design-system-pro.js?v=288.0',
  './design-system-pro.css?v=288.0',
  './bilingual-translation.css?v=286.0',
  './bilingual-translation.js?v=286.0',
  './global-quality.js',
  './global-quality.css',
  './vendor/three-r128.min.js',
  './vendor/OrbitControls-r128.js',
  './dc-flange.js',
  './dc-flange-pro.js',
  './dc-sketch-pro.js',
  './dc-flange.css',
  './dc-flange-pro.css',
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
  './docs/QC-Survey-Educational-Guide-AR.pdf',
  './docs/QC-Survey-Educational-Guide-EN.pdf',
  './voice-entry.js',
  './voice-entry.css',
  './smart-entry-pro.js',
  './smart-entry-pro.css',
  './smart-quality-pro.js',
  './smart-quality-pro.css',
  './pdfjs-local.mjs',
  './pdfjs-worker-local.mjs',
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
