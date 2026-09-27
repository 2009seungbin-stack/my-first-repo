"""Audit the built, indexable HTML, without network access or third-party packages.

Run after a build with SITE_URL set. This verifies crawl prerequisites, not rankings.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
import json
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def attrs(self, tag, **match):
        return [a for t, a in self.tags if t == tag and
                all(a.get(k) == v for k, v in match.items())]


def audit(dist):
    errors, pages = [], {}
    index = ET.parse(dist / 'sitemap.xml')
    maps = [urlparse(n.text).path.rsplit('/', 1)[-1]
            for n in index.findall('s:sitemap/s:loc', NS)]
    for name in maps:
        if name == 'sitemap-images.xml':
            continue
        for node in ET.parse(dist / name).findall('s:url/s:loc', NS):
            url = node.text
            file = dist / unquote(urlparse(url).path).lstrip('/') / 'index.html'
            if not file.is_file():
                errors.append(f'{url}: missing HTML')
                continue
            if url in pages:
                errors.append(f'{url}: duplicate sitemap URL')
            pages[url] = Page(file.read_text(encoding='utf-8'))
    if not pages:
        errors.append('No indexable pages; build with SITE_URL set')
    link_count = 0
    for url, page in pages.items():
        def require(ok, issue):
            if not ok:
                errors.append(f'{url}: {issue}')
        require(len(page.attrs('title')) == 1, 'expected one title')
        require(len(page.attrs('h1')) == 1, 'expected one H1')
        description = page.attrs('meta', name='description')
        require(len(description) == 1 and bool(description[0].get('content', '').strip()),
                'missing/duplicate description')
        require([a.get('href') for a in page.attrs('link', rel='canonical')] == [url],
                'canonical differs from sitemap URL')
        require(not any('noindex' in a.get('content', '').lower()
                        for a in page.attrs('meta', name='robots')), 'noindex in sitemap')
        alternates = {a.get('hreflang'): a.get('href') for a in
                      page.attrs('link', rel='alternate') if 'hreflang' in a}
        require(set(alternates) == {'en', 'ko', 'ja', 'x-default'}, 'incomplete hreflang')
        for locale, target in alternates.items():
            other = pages.get(target)
            require(other is not None, f'{locale} alternate absent from sitemap: {target}')
            if other:
                back = {a.get('hreflang'): a.get('href') for a in
                        other.attrs('link', rel='alternate') if 'hreflang' in a}
                require(back == alternates, f'nonreciprocal {locale} alternate')
        base = urljoin(url, next(iter(page.attrs('base')), {}).get('href', url))
        for a in page.attrs('a'):
            href = a.get('href', '')
            target = urlparse(urljoin(base, href))
            if not href or target.netloc != urlparse(url).netloc:
                continue
            link_count += 1
            local = dist / unquote(target.path).lstrip('/')
            require(local.is_file() or (local / 'index.html').is_file(),
                    f'broken internal link: {href}')
        require(all('alt' in a for a in page.attrs('img')), 'image without alt attribute')
    return {'pages': len(pages), 'internal_links': link_count, 'errors': errors}


if __name__ == '__main__':
    result = audit(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist')
    output = ROOT / 'test-results' / 'seo-audit.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(bool(result['errors']))
