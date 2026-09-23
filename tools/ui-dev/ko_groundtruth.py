"""Independent ground truth for the ko charset of real localisation files.
Standalone: only the Python stdlib. Parsers follow the format specs (java.util.Properties.load, GNU gettext PO).
Usage: python ko_groundtruth.py  -> prints a report and writes ko_groundtruth.json next to this script.
"""
import json, os, re, sys, unicodedata, collections
sys.stdout.reconfigure(encoding='utf-8')
CORPUS = r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\l10n'
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- java.util.Properties (spec-faithful; file read as UTF-8 like libGDX I18NBundle) ----------
def parse_properties(text):
    out = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].rstrip('\r')
        i += 1
        s = line.lstrip(' \t\f')
        if not s or s[0] in '#!':
            continue
        # continuation: odd number of trailing backslashes
        while True:
            m = re.search(r'(\\*)$', s)
            if len(m.group(1)) % 2 == 1 and i <= len(lines):
                s = s[:-1] + (lines[i].rstrip('\r').lstrip(' \t\f') if i < len(lines) else '')
                i += 1
                if i > len(lines): break
            else:
                break
        # split key / value
        k = []; j = 0; n = len(s)
        while j < n:
            c = s[j]
            if c == '\\' and j + 1 < n:
                k.append(s[j:j+2]); j += 2; continue
            if c in '=: \t\f':
                break
            k.append(c); j += 1
        # skip whitespace, then one = or :, then whitespace
        while j < n and s[j] in ' \t\f': j += 1
        if j < n and s[j] in '=:': j += 1
        while j < n and s[j] in ' \t\f': j += 1
        out.append((unescape_prop(''.join(k)), unescape_prop(s[j:])))
    return out

def unescape_prop(s):
    r = []; j = 0; n = len(s)
    while j < n:
        c = s[j]
        if c == '\\' and j + 1 < n:
            d = s[j+1]
            if d == 'u' and j + 6 <= n:
                try:
                    r.append(chr(int(s[j+2:j+6], 16))); j += 6; continue
                except ValueError:
                    pass
            r.append({'t': '\t', 'n': '\n', 'r': '\r', 'f': '\f'}.get(d, d)); j += 2
        else:
            r.append(c); j += 1
    return ''.join(r)

# ---------- GNU gettext PO ----------
def po_unquote(s):
    s = s.strip()
    assert s.startswith('"') and s.endswith('"'), s
    s = s[1:-1]
    r = []; j = 0
    while j < len(s):
        c = s[j]
        if c == '\\' and j + 1 < len(s):
            d = s[j+1]
            r.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\', 'a': '\a', 'b': '\b', 'f': '\f', 'v': '\v'}.get(d, '\\' + d)); j += 2
        else:
            r.append(c); j += 1
    return ''.join(r)

def parse_po(text):
    entries = []; cur = {}; last = None; fuzzy = False; obsolete = False
    def flush():
        nonlocal cur, fuzzy
        if 'msgid' in cur:
            cur['fuzzy'] = fuzzy
            entries.append(cur)
        cur = {}; fuzzy = False
    for raw in text.split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#~'):
            continue  # obsolete
        if line.startswith('#,') and 'fuzzy' in line:
            if 'msgstr' in ''.join(cur.keys()): flush()
            fuzzy = True; continue
        if line.startswith('#') or not line.strip():
            if any(k.startswith('msgstr') for k in cur): flush()
            continue
        m = re.match(r'(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")\s*$', line)
        if m:
            key = m.group(1)
            if key in ('msgctxt', 'msgid') and any(k.startswith('msgstr') for k in cur): flush()
            cur[key] = po_unquote(m.group(2)); last = key
        elif line.lstrip().startswith('"') and last:
            cur[last] += po_unquote(line)
    flush()
    return entries

# ---------- classification ----------
def is_hangul_syllable(c): return 0xAC00 <= ord(c) <= 0xD7A3
def is_hangul_jamo(c): o = ord(c); return 0x1100 <= o <= 0x11FF or 0x3130 <= o <= 0x318F or 0xA960 <= o <= 0xA97F or 0xD7B0 <= o <= 0xD7FF
def is_han(c): o = ord(c); return 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0xF900 <= o <= 0xFAFF or 0x20000 <= o <= 0x3134F
def is_kana(c): o = ord(c); return 0x3040 <= o <= 0x30FF or 0x31F0 <= o <= 0x31FF or 0xFF66 <= o <= 0xFF9F

def stats(values, label):
    cnt = collections.Counter()
    for v in values: cnt.update(v)
    chars = set(cnt)
    ws = {c for c in chars if c.isspace() or unicodedata.category(c) in ('Cc', 'Cf')}
    printable = chars - ws
    return {
        'label': label,
        'strings': len(values),
        'nonempty_strings': sum(1 for v in values if v.strip()),
        'strings_with_hangul': sum(1 for v in values if any(is_hangul_syllable(c) for c in v)),
        'total_chars': sum(cnt.values()),
        'unique_chars_all': len(chars),
        'unique_chars_excl_whitespace_control': len(printable),
        'whitespace_control_chars': sorted('U+%04X' % ord(c) for c in ws),
        'unique_hangul_syllables': sum(1 for c in chars if is_hangul_syllable(c)),
        'unique_hangul_jamo': sum(1 for c in chars if is_hangul_jamo(c)),
        'unique_han': sum(1 for c in chars if is_han(c)),
        'unique_kana': sum(1 for c in chars if is_kana(c)),
        'han_chars': ''.join(sorted(c for c in chars if is_han(c))),
        'kana_chars': ''.join(sorted(c for c in chars if is_kana(c))),
        'unique_ascii_printable': sum(1 for c in chars if 0x21 <= ord(c) <= 0x7E),
        'unique_private_use': sum(1 for c in chars if 0xE000 <= ord(c) <= 0xF8FF),
        'private_use_codepoints': ' '.join('U+%04X' % ord(c) for c in sorted(chars) if 0xE000 <= ord(c) <= 0xF8FF),
        'unique_other_non_ascii_non_hangul_non_cjk': ''.join(sorted(c for c in printable if ord(c) > 0x7E and not (0xE000 <= ord(c) <= 0xF8FF) and not (is_hangul_syllable(c) or is_hangul_jamo(c) or is_han(c) or is_kana(c)))),
        'top50': [[c, n, 'U+%04X' % ord(c)] for c, n in cnt.most_common(50)],
        'charset_sorted': ''.join(sorted(printable)),
    }

def load(p): return open(os.path.join(CORPUS, p), encoding='utf-8').read()

results = {}
# MAIN: Mindustry bundle_ko.properties
kv = parse_properties(load(r'mindustry\bundle_ko.properties'))
keys = [k for k, _ in kv]
vals = [v for _, v in kv]
main = stats(vals, 'Mindustry core/assets/bundles/bundle_ko.properties (all values, raw incl. [color] markup and {n} placeholders)')
main['duplicate_keys'] = len(keys) - len(set(keys))
main['unique_keys'] = len(set(keys))
en = parse_properties(load(r'mindustry\bundle.properties'))
en_keys = {k for k, _ in en}
main['english_bundle_keys'] = len(en_keys)
main['ko_keys_present_in_english'] = len(set(keys) & en_keys)
# values identical to English (untranslated)
en_map = dict(en)
main['values_identical_to_english'] = sum(1 for k, v in kv if en_map.get(k) == v)
results['main'] = main
# markup-stripped variant: Mindustry colour tags [name] / [#hex] / []
tag = re.compile(r'\[(?:#?[A-Za-z0-9_]*)\]')
results['main_markup_stripped'] = stats([tag.sub('', v) for v in vals], 'Mindustry bundle_ko values with [colour] tags removed')

# Others (for cross-checks)
sp = []
for f in ('ui', 'items', 'actors', 'windows'):
    sp += [v for _, v in parse_properties(load(r'shattered-pd\%s_ko.properties' % f))]
results['shattered_pd_4files'] = stats(sp, 'Shattered PD ui/items/actors/windows _ko.properties')
po = parse_po(load(r'supertux\ko.po'))
results['supertux_po'] = stats([e.get('msgstr', '') or '\n'.join(v for k, v in e.items() if k.startswith('msgstr[')) for e in po if e.get('msgid')], 'SuperTux data/locale/ko.po msgstr (header excluded, fuzzy included)')
results['supertux_po']['fuzzy'] = sum(1 for e in po if e['fuzzy'] and e.get('msgid'))
results['supertux_po']['untranslated_empty'] = sum(1 for e in po if e.get('msgid') and not any(v for k, v in e.items() if k.startswith('msgstr')))
po2 = parse_po(load(r'pixelorama\ko_KR.po'))
results['pixelorama_po'] = stats([e.get('msgstr', '') for e in po2 if e.get('msgid')], 'Pixelorama Translations/ko_KR.po msgstr')
results['pixelorama_po']['untranslated_empty'] = sum(1 for e in po2 if e.get('msgid') and not e.get('msgstr'))

for k in results:
    results[k].pop('charset_sorted', None) if k != 'main' else None
json.dump(results, open(os.path.join(HERE, 'ko_groundtruth.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(HERE, 'mindustry_ko_charset.txt'), 'w', encoding='utf-8').write(results['main']['charset_sorted'])
for k, r in results.items():
    print('==', k, '|', r['label'])
    for f in ('strings', 'nonempty_strings', 'strings_with_hangul', 'unique_keys', 'duplicate_keys', 'english_bundle_keys', 'values_identical_to_english', 'total_chars', 'unique_chars_all', 'unique_chars_excl_whitespace_control', 'whitespace_control_chars', 'unique_hangul_syllables', 'unique_hangul_jamo', 'unique_han', 'unique_kana', 'han_chars', 'kana_chars', 'unique_ascii_printable', 'unique_private_use', 'private_use_codepoints', 'unique_other_non_ascii_non_hangul_non_cjk', 'fuzzy', 'untranslated_empty'):
        if f in r: print('  %s: %s' % (f, r[f]))
    print('  top50:', ' '.join('%s:%d' % (repr(c)[1:-1] if c.isspace() else c, n) for c, n, _ in r['top50']))
