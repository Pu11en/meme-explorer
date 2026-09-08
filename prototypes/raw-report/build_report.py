"""Assemble an offline HTML design prototype. No source corpus is modified."""
import json
import gzip
import base64
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / 'data.json').read_text())
assert len(data['coins']) == 592
assert sum(bool(c['launch_at']) for c in data['coins']) == 592
assert all(c['origin'] == 'pump' for c in data['coins'])
embedded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
embedded = base64.b64encode(gzip.compress(embedded.encode('utf-8'), compresslevel=9, mtime=0)).decode('ascii')
html = (root / 'template.html').read_text()
html = html.replace('/*__STYLE__*/', (root / 'style.css').read_text())
html = html.replace('/*__DATA__*/', embedded)
html = html.replace('/*__SCRIPT__*/', (root / 'app.js').read_text())
assert '/*__' not in html
output = root / 'raw-recordings-preview.html'
output.write_text(html, encoding='utf-8')
print(f'{output}: {output.stat().st_size:,} bytes; {len(data["coins"]):,} coins; 3 layouts')
