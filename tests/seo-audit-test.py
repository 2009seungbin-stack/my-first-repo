import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('seo_audit', Path(__file__).resolve().parents[1] / 'tools/audit-seo.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AuditTest(unittest.TestCase):
    def test_valid_site_then_broken_canonical_link_and_noindex(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            origin = 'https://example.test'
            urls = {lang: origin + '/' + lang + '/' for lang in ['en', 'ko', 'ja']}
            urls['x-default'] = urls['en']
            ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
            (root / 'sitemap.xml').write_text(f'<sitemapindex xmlns="{ns}"><sitemap><loc>{origin}/sitemap-tools.xml</loc></sitemap></sitemapindex>')
            (root / 'sitemap-tools.xml').write_text(f'<urlset xmlns="{ns}">' + ''.join(f'<url><loc>{u}</loc></url>' for u in list(urls.values())[:3]) + '</urlset>')
            for lang in ['en', 'ko', 'ja']:
                directory = root / lang
                directory.mkdir()
                html = '<title>Tool</title><meta name="description" content="Do a task"><h1>Tool</h1>'
                html += f'<link rel="canonical" href="{urls[lang]}"><base href="/"><a href="en/">Home</a>'
                html += ''.join(f'<link rel="alternate" hreflang="{l}" href="{u}">' for l, u in urls.items())
                (directory / 'index.html').write_text(html)
            self.assertEqual(module.audit(root)['errors'], [])
            file = root / 'ko/index.html'
            file.write_text(file.read_text().replace('rel="canonical"', 'rel="wrong"') + '<a href="missing/">Broken</a><meta name="robots" content="noindex">')
            errors = '\n'.join(module.audit(root)['errors'])
            for expected in ['canonical differs', 'broken internal link', 'noindex in sitemap']:
                self.assertIn(expected, errors)

if __name__ == '__main__':
    unittest.main()
