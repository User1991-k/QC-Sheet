#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os, sys, urllib.parse, urllib.request

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
        '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
        '.js': 'text/javascript; charset=utf-8'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        if self.path != '/api/translate':
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get('Content-Length', '0')), 20000)
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            text = str(body.get('text', '')).strip()
            source = str(body.get('source', 'ar'))
            target = str(body.get('target', 'en'))
            if not text or len(text) > 500 or (source, target) not in {('ar','en'),('en','ar')}:
                raise ValueError('Invalid translation request')
            query = urllib.parse.urlencode({'q': text, 'langpair': f'{source}|{target}'})
            req = urllib.request.Request('https://api.mymemory.translated.net/get?' + query,
                headers={'User-Agent': 'QC-Survey-Local/286'})
            with urllib.request.urlopen(req, timeout=20) as res:
                remote = json.loads(res.read().decode('utf-8'))
            translated = str((remote.get('responseData') or {}).get('translatedText') or '').strip()
            if not translated:
                raise RuntimeError('Translation service returned no result')
            data = json.dumps({'translation': translated}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers(); self.wfile.write(data)
        except Exception as exc:
            data = json.dumps({'error': str(exc)}, ensure_ascii=False).encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers(); self.wfile.write(data)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f'QC Survey v292: http://localhost:{port}/index.html')
ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
