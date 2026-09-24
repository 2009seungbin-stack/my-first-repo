"""Validate a built sitemap set against the official XML schemas and Google's limits.

    SITE_URL=https://nerulio.pages.dev/ node tools/build.mjs
    python tools/validate-sitemaps.py [dist]

Schemas (downloaded once into a cache folder, never committed — Google's image schema is not openly
licensed): sitemaps.org sitemap.xsd and siteindex.xsd, Google's sitemap-image/1.1 schema, and the
W3C XHTML 1.0 Strict schema (+ xml.xsd) for the xhtml:link hreflang alternates, because sitemap.xsd
validates foreign elements strictly. Needs lxml (`pip install lxml`); CI runs the schema-free
structural checks in tests/sitemap.test.mjs instead.

Also checked: robots.txt names the index; every sitemap the index lists exists; ≤50,000 URLs and
≤50 MB per file; every <loc> is on the site and unique across files; every hreflang set is complete
(ko, en, ja, x-default), contains the page itself and is reciprocal (each alternate's own set is the
same); no <lastmod> is in the future."""
import os, re, sys, tempfile, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from lxml import etree

DIST = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist')
CACHE = Path(tempfile.gettempdir()) / 'nerulio-sitemap-xsd'
SCHEMAS = {
    'sitemap.xsd': 'https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd',
    'siteindex.xsd': 'https://www.sitemaps.org/schemas/sitemap/0.9/siteindex.xsd',
    'sitemap-image.xsd': 'https://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd',
    'xhtml1-strict.xsd': 'https://www.w3.org/2002/08/xhtml/xhtml1-strict.xsd',
    'xml.xsd': 'https://www.w3.org/2001/xml.xsd',
}
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'x': 'http://www.w3.org/1999/xhtml'}
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
failures = []


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))
    if not cond:
        failures.append(name)


def schema_files():
    CACHE.mkdir(exist_ok=True)
    for name, url in SCHEMAS.items():
        f = CACHE / name
        if not f.exists():
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (sitemap validation)'})
            f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    x = CACHE / 'xhtml1-strict.xsd'
    x.write_text(x.read_text(encoding='utf-8').replace('schemaLocation="http://www.w3.org/2001/xml.xsd"', 'schemaLocation="xml.xsd"'), encoding='utf-8')
    wrapper = CACHE / 'urlset-all.xsd'
    wrapper.write_text('<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">'
                       f'<xs:import namespace="{NS["s"]}" schemaLocation="sitemap.xsd"/>'
                       '<xs:import namespace="http://www.google.com/schemas/sitemap-image/1.1" schemaLocation="sitemap-image.xsd"/>'
                       f'<xs:import namespace="{NS["x"]}" schemaLocation="xhtml1-strict.xsd"/></xs:schema>', encoding='utf-8')
    return etree.XMLSchema(etree.parse(str(wrapper))), etree.XMLSchema(etree.parse(str(CACHE / 'siteindex.xsd')))


def when(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')) if 'T' in s else datetime.fromisoformat(s + 'T00:00:00+00:00')


urlset_schema, index_schema = schema_files()
robots = (DIST / 'robots.txt').read_text(encoding='utf-8')
index_url = re.search(r'^Sitemap: (\S+)$', robots, re.M)
check('robots.txt lists exactly one sitemap, the index', index_url and robots.count('Sitemap:') == 1 and index_url.group(1).endswith('/sitemap.xml'), robots)
site = index_url.group(1)[:-len('sitemap.xml')]
index = etree.parse(str(DIST / 'sitemap.xml'))
check('sitemap.xml is a valid sitemapindex (siteindex.xsd)', index_schema.validate(index), str(index_schema.error_log.last_error))
children = [loc.text for loc in index.findall('.//s:sitemap/s:loc', NS)]
check('the index lists the game, tools and images sitemaps', all(f'{site}sitemap-{k}.xml' in children for k in ['game', 'tools', 'images']), str(children))
now = datetime.now(timezone.utc)
seen, alternates = {}, {}
for url in children:
    name = url[len(site):]
    f = DIST / name
    check(f'{name} exists next to the index', f.exists())
    if not f.exists():
        continue
    doc = etree.parse(str(f))
    check(f'{name} is valid against sitemap.xsd (+ image and XHTML link schemas)', urlset_schema.validate(doc), str(urlset_schema.error_log.last_error))
    urls = doc.findall('s:url', NS)
    check(f'{name}: {len(urls)} URLs, {f.stat().st_size} bytes (limits 50,000 and 50 MB)', 0 < len(urls) <= 50000 and f.stat().st_size <= 50 * 1024 * 1024)
    lastmods = [u.findtext('s:lastmod', namespaces=NS) for u in urls]
    check(f'{name}: no <lastmod> in the future', all(when(d) <= now for d in lastmods if d), str([d for d in lastmods if d and when(d) > now][:3]))
    if name == 'sitemap-images.xml':
        continue
    for u in urls:
        loc = u.findtext('s:loc', namespaces=NS)
        if loc in seen:
            check(f'{loc} is listed once', False, f'also in {seen[loc]}')
        seen[loc] = name
        alternates[loc] = {l.get('hreflang'): l.get('href') for l in u.findall('x:link', NS)}
check('every page URL is on the site', all(l.startswith(site) for l in seen), str([l for l in seen if not l.startswith(site)][:3]))
bad = [loc for loc, alt in alternates.items() if set(alt) != {'ko', 'en', 'ja', 'x-default'} or loc not in alt.values()]
check(f'every hreflang set is complete (ko, en, ja, x-default) and names the page itself ({len(alternates)} pages)', not bad, str(bad[:3]))
bad = [loc for loc, alt in alternates.items() for l in ('ko', 'en', 'ja') if alternates.get(alt[l]) != alt]
check('hreflang is reciprocal: every alternate is listed with the same set', not bad, str(bad[:3]))
print('FAILED' if failures else 'ALL PASS', f'{len(seen)} page URLs in {len(children) - 1} page sitemaps + images')
sys.exit(1 if failures else 0)
