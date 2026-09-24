"""Validate the JSON-LD of built game pages with the Schema.org validator (validator.schema.org).

    SITE_URL=https://nerulio.pages.dev/ node tools/build.mjs
    python tools/validate-structured-data.py [dist] [--all]

Sends each page's HTML to https://validator.schema.org/validate (network; nothing else is sent) and
fails on any error or warning the validator reports for a type or property. Default: every game page
in English plus the hub in ko/en/ja; --all checks every game page in every language. The offline
checks (JSON-LD equals the visible FAQ and steps, required properties) are in tests/game-seo.test.mjs.
Google's Rich Results Test has no API; it is not run here."""
import json, re, subprocess, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = Path(next((a for a in sys.argv[1:] if not a.startswith('--')), ROOT / 'dist'))
ALL = '--all' in sys.argv
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
paths = json.loads(subprocess.run(['node', '--input-type=module', '-e', "import {sitemapGroups} from './tools/sitemaps.mjs';console.log(JSON.stringify(sitemapGroups().game.filter(Boolean)))"],
                                  cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)
pages = [f'{l}/{p}' for p in paths for l in (['ko', 'en', 'ja'] if ALL or p == 'game' else ['en'])]


def problems(node, out):
    if isinstance(node, dict):
        for k in ('errors', 'warnings'):
            for e in node.get(k) or []:
                out.append(e)
        for v in node.values():
            problems(v, out)
    elif isinstance(node, list):
        for v in node:
            problems(v, out)
    return out


bad, types = [], {}
for page in pages:
    html = (DIST / page / 'index.html').read_text(encoding='utf-8')
    # Only the JSON-LD blocks are sent (the validator rejects large bodies with HTTP 405).
    html = '<!doctype html><html><head>' + ''.join(re.findall(r'<script data-site-seo type="application/ld\+json">.*?</script>', html)) + '</head><body></body></html>'
    body = urllib.parse.urlencode({'html': html}).encode()
    for attempt in range(8):
        try:
            raw = urllib.request.urlopen(urllib.request.Request('https://validator.schema.org/validate', data=body, headers={'User-Agent': 'curl/8.5.0', 'Content-Type': 'application/x-www-form-urlencoded'}), timeout=60).read().decode('utf-8')
            break
        except Exception as e:  # rate limit or network: back off and retry
            if attempt == 7:
                raise
            time.sleep(30 * (attempt + 1))  # HTTP 429: the validator rate-limits
    data = json.loads(raw[raw.index('{'):])
    found = [t['value'] for g in data.get('tripleGroups', []) for n in g.get('nodes', []) for t in n.get('types', [])[:1]]
    for t in found:
        types[t] = types.get(t, 0) + 1
    p = problems(data.get('tripleGroups', []), []) + (data.get('errors') or [])
    if not p and (data.get('totalNumErrors') or data.get('totalNumWarnings')):
        p = [f"{data.get('totalNumErrors')} errors, {data.get('totalNumWarnings')} warnings"]
    print(('FAIL ' if p else 'PASS ') + page, ', '.join(found), json.dumps(p, ensure_ascii=False)[:300] if p else '')
    if p:
        bad.append(page)
    time.sleep(3)
print(f'{len(pages) - len(bad)}/{len(pages)} pages without errors or warnings; types seen: {types}')
sys.exit(1 if bad else 0)
