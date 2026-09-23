#!/usr/bin/env python3
"""Fixtures and fontTools reference dumps for the Studio UI font parser (src/game/ui/font/opentype.js).

  python tools/ui-font-fixtures.py            regenerate tests/fixtures/ui/fonts/* (fonts + *.ref.json)
  python tools/ui-font-fixtures.py dump FONT [--index N] [--gids 0-99] [--codepoints 32-126,0xAC00-0xAC10]
        [--kern-codepoints 32-126] [--location wght=400,wdth=90 [--instancer]]
        print a reference JSON for any local font to stdout (used by the corpus-only checks in
        tests/studio-ui-font.test.mjs). With --location the outlines/advances come from
        glyphSet(location=…) (unrounded); add --instancer for varLib.instancer on a gid-preserving subset.

Everything written into tests/fixtures/ui/fonts is CC0 (Kenney fonts, from the local corpus at
$NERULIO_CORPUS, default C:/Users/2009s/nerulio-asset-corpus) or generated from CC0 outlines here:

  KenneyFuture.ttf KenneyPixel.ttf KenneyMiniSquareMono.ttf   copies (CC0, LICENSE-kenney.txt)
  kenney-mini.woff        WOFF 1.0 of KenneyMiniSquareMono (zlib tables)
  kenney-pair.ttc         TrueType collection: kenney-composites.ttf + kenney-var.ttf
  kenney-future-cff.otf   name-keyed CFF from Kenney Future: width/no-width charstrings, stem hints,
                          hintmask/cntrmask (1 and 2 mask bytes, implicit vstems, masks inside
                          subroutines), >1240 local subrs (bias 1131) + global subrs (bias 107), nested
                          subr calls, a seac 'Aacute', GPOS kern (PairPos 1 + 2, two lookups, one of them
                          through Extension lookups, DFLT/latn/hang)
  kenney-future-cid.otf   the same outlines CID-keyed: 2 Font DICTs whose local subrs differ, FDSelect 3
  kenney-composites.ttf   composite glyphs (scale, x/y scale, 2x2, nested, byte/word args, point-matched
                          anchors), an all-off-curve contour, a one-point contour, an lsb≠xMin glyph, and a
                          legacy 'kern' format 0 table (no GPOS)
  kenney-var.ttf          variable TrueType: wght 100–900 (default 400) + wdth 75–100, avar, gvar (shared
                          tuples, intermediate regions, sparse points → IUP, composites, phantom points),
                          HVAR, GPOS kern whose values vary (GDEF VariationIndex)
  tables.ref.json         cmap subtables in formats 0/4/6/12/13 (+ symbol, + preference) and a name table
                          with Mac Roman / Windows / Unicode records, compiled and decoded by fontTools
  guards-cff.otf guards-glyf.ttf   recursion traps (self-calling subr, 10^9 subr fan-out, self-referencing
                          composite, 20-level composite chain) for the parser's guards; no references

Reference dumps come from fontTools only (never from the parser under test): getBestCmap, hmtx, a
BasePen that decomposes components and splits TrueType quadratic strings into single segments with
the implied on-curve midpoints (fontTools' own BasePen.qCurveTo), BoundsPen tight bounds,
glyphSet(location=…) unrounded variable outlines/advances, varLib.instancer static instances, and a
straightforward GPOS pair flattener (first applying subtable per lookup, as HarfBuzz does).
"""
import io, json, os, shutil, sys
from pathlib import Path

# Byte-for-byte reproducible output: fontTools stamps head.created/modified from this when set.
os.environ.setdefault('SOURCE_DATE_EPOCH', '1767225600')  # 2026-01-01T00:00:00Z

from fontTools.ttLib import TTFont, TTCollection, newTable
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'fixtures' / 'ui' / 'fonts'
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))
KENNEY = CORPUS / 'fonts' / 'kenney-fonts'


# ---------------------------------------------------------------- reference dumping

class FlatPen(BasePen):
    """Records M/L/Q/C/Z with components decomposed and quadratic strings split (BasePen does both)."""
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.cmds = []
    def _moveTo(self, p): self.cmds.append(['M', *p])
    def _lineTo(self, p): self.cmds.append(['L', *p])
    def _qCurveToOne(self, a, b): self.cmds.append(['Q', *a, *b])
    def _curveToOne(self, a, b, c): self.cmds.append(['C', *a, *b, *c])
    def _closePath(self): self.cmds.append(['Z'])
    def _endPath(self): self.cmds.append(['Z'])


def num(v):
    v = float(v)
    return int(v) if v.is_integer() else v


def enc(cmds):
    """Compact path string: 'M512 384L512 512Q…Z'. Numbers are Python reprs (shortest round-trip), so
    JavaScript's Number() reads back the identical double."""
    return ''.join(c[0] + ' '.join(repr(v) for v in c[1:]) for c in cmds)


def outline(glyphSet, name):
    pen = FlatPen(glyphSet)
    try:
        glyphSet[name].draw(pen)
    except AttributeError:
        # point-matched components (no x/y) are beyond fontTools' pen protocol: draw the points
        # glyf.getCoordinates() assembles for them as one simple glyph instead
        from fontTools.ttLib.tables._g_l_y_f import Glyph
        glyf = glyphSet.glyfTable
        coords, ends, flags = glyf[name].getCoordinates(glyf)
        g = Glyph()
        g.numberOfContours, g.coordinates, g.endPtsOfContours, g.flags = len(ends), coords, list(ends), flags
        pen = FlatPen(glyphSet)
        g.draw(pen, glyf)
        cmds = [[c[0], *map(num, c[1:])] for c in pen.cmds]
        bp = BoundsPen(glyphSet)
        g.draw(bp, glyf)
        return cmds, (list(map(num, bp.bounds)) if bp.bounds else None)
    cmds = [[c[0], *map(num, c[1:])] for c in pen.cmds]
    bp = BoundsPen(glyphSet)
    glyphSet[name].draw(bp)
    return cmds, (list(map(num, bp.bounds)) if bp.bounds else None)


def gpos_kern_lookups(font):
    if 'GPOS' not in font:
        return None
    gpos = font['GPOS'].table
    feats = set()
    for sr in gpos.ScriptList.ScriptRecord:
        s = sr.Script
        systems = ([s.DefaultLangSys] if s.DefaultLangSys else []) + [r.LangSys for r in s.LangSysRecord]
        for ls in systems:
            idx = list(ls.FeatureIndex) + ([ls.ReqFeatureIndex] if ls.ReqFeatureIndex != 0xFFFF else [])
            for i in idx:
                if gpos.FeatureList.FeatureRecord[i].FeatureTag == 'kern':
                    feats.add(i)
    if not feats:
        return None
    order = sorted({li for i in feats for li in gpos.FeatureList.FeatureRecord[i].Feature.LookupListIndex})
    lookups = []
    for li in order:
        subs = []
        for st in gpos.LookupList.Lookup[li].SubTable:
            if gpos.LookupList.Lookup[li].LookupType == 9:
                if st.ExtensionLookupType != 2:
                    continue
                st = st.ExtSubTable
            elif gpos.LookupList.Lookup[li].LookupType != 2:
                continue
            if st.Format == 1:
                cov = {g: i for i, g in enumerate(st.Coverage.glyphs)}
                rows = [{r.SecondGlyph: r for r in ps.PairValueRecord} for ps in st.PairSet]
                subs.append(('1', cov, rows))
            else:
                cov = set(st.Coverage.glyphs)
                subs.append(('2', cov, st))
        if subs:
            lookups.append(subs)
    return lookups


def xadv(v):
    return (getattr(v, 'XAdvance', 0) or 0) if v is not None else 0


def pair_value(lookups, l, r):
    total = 0
    for subs in lookups:
        for kind, cov, data in subs:
            if kind == '1':
                if l not in cov:
                    continue
                rec = data[cov[l]].get(r)
                if rec is None:
                    continue
                total += xadv(rec.Value1)
                break
            if l not in cov:
                continue
            c1 = data.ClassDef1.classDefs.get(l, 0) if data.ClassDef1 else 0
            c2 = data.ClassDef2.classDefs.get(r, 0) if data.ClassDef2 else 0
            if c1 < len(data.Class1Record) and c2 < len(data.Class1Record[c1].Class2Record):
                total += xadv(data.Class1Record[c1].Class2Record[c2].Value1)
            break
    return total


def kern_pairs(font, gids):
    order = font.getGlyphOrder()
    names = [order[g] for g in gids]
    lookups = gpos_kern_lookups(font)
    out = []
    if lookups is not None:
        for l in names:
            for r in names:
                v = pair_value(lookups, l, r)
                if v:
                    out.append([font.getGlyphID(l), font.getGlyphID(r), num(v)])
    elif 'kern' in font:
        table = {}
        for st in font['kern'].kernTables:
            if getattr(st, 'format', None) != 0 or not (st.coverage & 1) or (st.coverage & 6):
                continue
            for (l, r), v in st.kernTable.items():
                table[(l, r)] = table.get((l, r), 0) + v
        want = set(names)
        for (l, r), v in table.items():
            if v and l in want and r in want:
                out.append([font.getGlyphID(l), font.getGlyphID(r), v])
    return sorted(out)


def meta(font):
    name = font['name']
    def n(i):  # Windows English first (fontTools' getDebugName takes whichever English record comes first)
        r = name.getName(i, 3, 1, 0x409) or name.getName(i, 3, 10, 0x409)
        return r.toUnicode() if r else (name.getDebugName(i) or '')
    os2 = font.get('OS/2')
    return {
        'unitsPerEm': font['head'].unitsPerEm, 'numGlyphs': font['maxp'].numGlyphs,
        'hhea': [font['hhea'].ascent, font['hhea'].descent, font['hhea'].lineGap],
        'os2': None if os2 is None else {
            'typoAscender': os2.sTypoAscender, 'typoDescender': os2.sTypoDescender, 'typoLineGap': os2.sTypoLineGap,
            'winAscent': os2.usWinAscent, 'winDescent': os2.usWinDescent, 'fsSelection': os2.fsSelection,
            'xHeight': getattr(os2, 'sxHeight', None) if os2.version >= 2 else None,
            'capHeight': getattr(os2, 'sCapHeight', None) if os2.version >= 2 else None},
        'family': n(16) or n(1), 'subfamily': n(17) or n(2), 'fullName': n(4), 'version': n(5),
        'copyright': n(0), 'licenseText': n(13),
        'axes': [{'tag': a.axisTag, 'min': a.minValue, 'default': a.defaultValue, 'max': a.maxValue,
                  'name': name.getDebugName(a.axisNameID)} for a in font['fvar'].axes] if 'fvar' in font else [],
        'instances': [{'name': name.getDebugName(i.subfamilyNameID), 'coords': i.coordinates}
                      for i in font['fvar'].instances] if 'fvar' in font else [],
    }


def dump(font, gids=None, kern_gids=None, locations=(), instancer_locations=()):
    """Reference JSON for one TTFont. gids=None → every glyph."""
    order = font.getGlyphOrder()
    if gids is None:
        gids = list(range(len(order)))
    gs = font.getGlyphSet()
    cmap = font.getBestCmap() or {}
    ref = {
        'meta': meta(font),
        'cmap': sorted([cp, font.getGlyphID(g)] for cp, g in cmap.items() if font.getGlyphID(g) != 0),
        'advances': [font['hmtx'][g][0] for g in order],
        'glyphs': {}, 'bounds': {},
    }
    for gid in gids:
        c, b = outline(gs, order[gid])
        ref['glyphs'][gid] = enc(c)
        ref['bounds'][gid] = b
    if kern_gids is not None:
        ref['kernGids'] = list(kern_gids)
        ref['kern'] = kern_pairs(font, kern_gids)
    ref['locations'] = []
    for loc in locations:
        vs = font.getGlyphSet(location=loc)
        entry = {'user': loc, 'source': 'glyphSet', 'normalized': [num(font.normalizeLocation(loc).get(a.axisTag, 0)) for a in font['fvar'].axes],
                 'advances': {}, 'glyphs': {}}
        for gid in gids:
            entry['glyphs'][gid] = enc(outline(vs, order[gid])[0])
            entry['advances'][gid] = num(vs[order[gid]].width)
        ref['locations'].append(entry)
    for loc in instancer_locations:
        from fontTools.varLib import instancer
        inst = instancer.instantiateVariableFont(TTFont(io.BytesIO(to_bytes(font))), dict(loc))
        inst = TTFont(io.BytesIO(to_bytes(inst)))
        igs = inst.getGlyphSet()
        entry = {'user': loc, 'source': 'instancer', 'advances': {}, 'glyphs': {}}
        for gid in gids:
            entry['glyphs'][gid] = enc(outline(igs, order[gid])[0])
            entry['advances'][gid] = inst['hmtx'][order[gid]][0]
        if kern_gids is not None:
            entry['kern'] = kern_pairs(inst, kern_gids)
        ref['locations'].append(entry)
    return ref


def to_bytes(font):
    b = io.BytesIO()
    font.save(b)
    return b.getvalue()


def write_json(path, data):
    path.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')


# ---------------------------------------------------------------- fixture builders

def kenney(name):
    p = KENNEY / name
    if not p.exists():
        sys.exit(f'missing {p}: set NERULIO_CORPUS to the asset corpus')
    return p


def tt_glyph(glyphSet, name):
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    pen = TTGlyphPen(glyphSet)
    glyphSet[name].draw(pen)
    return pen.glyph()


def build_cff(src, cid=False):
    """Kenney Future as CFF; deliberately exercises the charstring machinery (see module doc)."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.t2CharStringPen import T2CharStringPen
    from fontTools.misc.psCharStrings import T2CharString
    from fontTools.cffLib import SubrsIndex, GlobalSubrsIndex, FDArrayIndex, FontDict, PrivateDict, FDSelect

    order = src.getGlyphOrder()
    gs = src.getGlyphSet()
    hmtx = src['hmtx']
    widths = [hmtx[g][0] for g in order]
    default_width = max(set(widths), key=widths.count)
    programs = {}
    for i, g in enumerate(order):
        pen = T2CharStringPen(None, gs)
        gs[g].draw(pen)
        prog = pen.getCharString().program
        assert prog[-1] == 'endchar'
        programs[g] = prog[:-1]

    # split the drawing into operator groups
    def groups(prog):
        out, cur = [], []
        for tok in prog:
            cur.append(tok)
            if isinstance(tok, str):
                out.append(cur)
                cur = []
        assert not cur
        return out

    # The name-keyed font pads its local subrs past 1240 (bias 1131). The CID font gives each of its two
    # Font DICTs only the subrs its own glyphs call (fewer than 1240 each: bias 107), so the same local
    # index means different code in the two FDs — drawing with the wrong FD's subrs would show.
    PAD = 0 if cid else 1250
    fd_of = [(i // 7) % 2 if cid else 0 for i in range(len(order))]
    locals_ = [[['return']] * PAD, []]
    glob = []
    cur_fd = [0]

    def call_local(prog):
        local = locals_[cur_fd[0]]
        local.append(prog + ['return'])
        return ['LIDX', cur_fd[0], len(local) - 1, 'callsubr']

    def call_global(prog):
        glob.append(prog + ['return'])
        return ['GIDX', len(glob) - 1, 'callgsubr']

    final = {}
    for i, g in enumerate(order):
        cur_fd[0] = fd_of[i]
        gr = groups(programs[g])
        body = []
        width = [] if widths[i] == default_width else [widths[i]]
        hints = []
        kind = i % 5
        # Stem counts sit on the byte boundaries, so miscounting by one stem (or forgetting the implicit
        # vstem before a hintmask) changes the number of mask bytes skipped and garbles the outline.
        if kind == 0:   # 8 hstemhm + 1 implicit vstem before hintmask → 9 stems, 2 mask bytes
            hints = [0, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 'hstemhm', 100, 30, 'hintmask', bytes([0xFF, 0x00])]
        elif kind == 1:  # exactly 8 stems → 1 mask byte; another hintmask inside a subroutine below
            hints = [0, 10, 20, 10, 20, 10, 20, 10, 'hstemhm', 0, 10, 20, 10, 20, 10, 20, 10, 'vstemhm', 'hintmask', bytes([0xFF])]
        elif kind == 2:
            hints = [0, 50, 'hstem', 10, 50, 'vstem', 'cntrmask', bytes([0xC0])]
        elif kind == 3:
            hints = [5, 20, 'vstem']
        # (kind 4: no hints at all; a width then rides on the first moveto or on endchar)
        prog = width + hints
        for j, grp in enumerate(gr):
            if j % 3 == 0:
                body += grp
            elif j % 3 == 1:
                inner = grp + (['hintmask', bytes([0xF0])] if kind == 1 else [])
                body += call_local(inner)
            else:
                # nested: global subr that calls a local subr
                body += call_global(call_local(grp))
        final[g] = prog + body + ['endchar']

    # seac: Aacute = A + acute (Standard Encoding codes 65 and 194)
    if not cid and 'Aacute' in final and 'A' in final and 'acute' in final:
        ai = order.index('Aacute')
        w = [] if widths[ai] == default_width else [widths[ai]]
        final['Aacute'] = w + [60, 180, 65, 194, 'endchar']

    bias = lambda n: 107 if n < 1240 else 1131 if n < 33900 else 32768
    lbias, gbias = [bias(len(l)) for l in locals_], bias(len(glob))

    def fix(prog):
        out, k = [], 0
        while k < len(prog):
            if prog[k] == 'LIDX':
                out.append(prog[k + 2] - lbias[prog[k + 1]])
                k += 3
            elif prog[k] == 'GIDX':
                out.append(prog[k + 1] - gbias)
                k += 2
            else:
                out.append(prog[k])
                k += 1
        return out
    final = {g: fix(p) for g, p in final.items()}
    locals_ = [[fix(p) for p in l] for l in locals_]
    glob = [fix(p) for p in glob]

    # CID-keyed fonts name their glyphs cidNNNNN (the charset holds CIDs, not names)
    rn = {g: (g if not cid or i == 0 else f'cid{i:05d}') for i, g in enumerate(order)}
    fb = FontBuilder(src['head'].unitsPerEm, isTTF=False)
    fb.setupGlyphOrder([rn[g] for g in order])
    fb.setupCharacterMap({cp: rn[g] for cp, g in src.getBestCmap().items()})
    charstrings = {rn[g]: T2CharString(program=final[g]) for g in order}
    ps = 'KenneyFutureCFF' + ('CID' if cid else '')
    fb.setupCFF(ps, {'FullName': 'Kenney Future CFF test', 'FamilyName': 'Kenney Future CFF'}, charstrings,
                {'defaultWidthX': default_width, 'nominalWidthX': 0})
    fb.setupHorizontalMetrics({rn[g]: hmtx[g] for g in order})
    fb.setupHorizontalHeader(ascent=src['hhea'].ascent, descent=src['hhea'].descent)
    fb.setupNameTable({'familyName': 'Kenney Future CFF test', 'styleName': 'Regular',
                       'copyright': 'Generated from Kenney Future (CC0) by tools/ui-font-fixtures.py',
                       'licenseDescription': 'CC0 1.0 Universal (public domain)'})
    fb.setupOS2(sTypoAscender=src['OS/2'].sTypoAscender, sTypoDescender=src['OS/2'].sTypoDescender,
                usWinAscent=src['OS/2'].usWinAscent, usWinDescent=src['OS/2'].usWinDescent, fsSelection=0x40)
    fb.setupPost()
    cff = fb.font['CFF '].cff
    td = cff.topDictIndex[0]
    priv = td.Private
    subrs = SubrsIndex()
    for p in locals_[0]:
        subrs.append(T2CharString(program=list(p)))
    gsubrs = GlobalSubrsIndex()
    for p in glob:
        gsubrs.append(T2CharString(program=list(p)))
    cff.GlobalSubrs = gsubrs
    td.GlobalSubrs = gsubrs
    priv.Subrs = subrs
    for g in order:
        cs = td.CharStrings[rn[g]]
        cs.private = priv
        cs.globalSubrs = gsubrs

    if cid:
        # Two Font DICTs; glyphs alternate between them in runs of 7 (FDSelect format 3).
        fdarray = FDArrayIndex()
        privs = []
        for k in range(2):
            fd = FontDict()
            fd.setCFF2(False)
            p = PrivateDict()
            p.defaultWidthX = default_width
            p.nominalWidthX = 0
            s = SubrsIndex()
            for q in locals_[k]:
                s.append(T2CharString(program=list(q)))
            p.Subrs = s
            fd.Private = p
            fd.FontName = f'{ps}-FD{k}'
            fdarray.append(fd)
            privs.append(p)
        td.FDArray = fdarray
        sel = FDSelect()
        sel.format = 3
        sel.gidArray = fd_of
        td.FDSelect = sel
        td.ROS = ('Adobe', 'Identity', 0)
        td.CIDCount = len(order)
        del td.Private
        if 'Private' in td.rawDict:
            del td.rawDict['Private']
        for i, g in enumerate(order):
            td.CharStrings[rn[g]].private = privs[fd_of[i]]
    font = TTFont(io.BytesIO(to_bytes(fb.font)))
    fea = """
languagesystem DFLT dflt;
languagesystem latn dflt;
languagesystem hang dflt;
@UC_ROUND = [O C G Q];
@LC = [a c e o];
@TALL = [T V W Y];
lookup PAIRS {
  pos A V -80;
  pos V A -80;
  pos T o -60;
  pos L T -70;
  pos A T 0;
  pos @TALL @LC -50;
  pos @UC_ROUND @TALL -20;
} PAIRS;
lookup EXTRA useExtension {
  pos A V -5;
  pos o @TALL -12;
  pos @LC @LC 3;
} EXTRA;
feature kern { lookup PAIRS; lookup EXTRA; } kern;
"""
    from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
    import re
    fea = re.sub(r'(?<![@\w])([A-Za-z]\w*)(?=[\s;\]])', lambda m: rn.get(m.group(1), m.group(1)), fea)
    addOpenTypeFeaturesFromString(font, fea)
    return TTFont(io.BytesIO(to_bytes(font)))


def build_composites(src):
    """Static TrueType with composite glyphs; outlines from Kenney Future (CC0)."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent, GlyphCoordinates
    from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
    gs = src.getGlyphSet()
    base = ['.notdef', 'space', 'A', 'O', 'o', 'acute', 'T']
    glyphs = {g: tt_glyph(gs, g) for g in base}
    hm = {g: src['hmtx'][g] for g in base}

    def comp(name, x=0, y=0, transform=None, first=None):
        c = GlyphComponent()
        c.glyphName = name
        c.flags = 0
        if first is None:
            c.x, c.y = x, y
        else:
            c.firstPt, c.secondPt = first
        if transform is not None:
            c.transform = transform
        return c

    def composite(*comps):
        g = Glyph()
        g.numberOfContours = -1
        g.components = list(comps)
        return g

    glyphs['Aacute'] = composite(comp('A'), comp('acute', 300, 200))                        # byte + word args
    glyphs['Oscaled'] = composite(comp('O', -20, -30, [[0.5, 0], [0, 0.5]]))              # WE_HAVE_A_SCALE
    glyphs['Oxy'] = composite(comp('o', 10, 0, [[1.5, 0], [0, 0.75]]))                    # X_AND_Y_SCALE
    glyphs['Orot'] = composite(comp('O', 600, 100, [[0.70710678, 0.70710678], [-0.70710678, 0.70710678]]))  # 2x2
    glyphs['nested'] = composite(comp('Aacute', 0, 0), comp('Oscaled', 700, -5))          # composite of composites
    glyphs['anchored'] = composite(comp('A'), comp('o', first=(3, 5)))                    # point matching
    ring = Glyph()                                                                        # all off-curve contour + a one-point contour
    ring.numberOfContours = 2
    ring.coordinates = GlyphCoordinates([(100, 300), (300, 500), (500, 300), (300, 100), (50, 50)])
    ring.endPtsOfContours = [3, 4]
    ring.flags = bytearray([0, 0, 0, 0, 1])
    ring.program = None
    from fontTools.ttLib.tables import ttProgram
    ring.program = ttProgram.Program()
    ring.program.fromBytecode(b'')
    glyphs['ring'] = ring
    shifted = tt_glyph(gs, 'T')
    glyphs['shifted'] = shifted
    order = base + ['Aacute', 'Oscaled', 'Oxy', 'Orot', 'nested', 'anchored', 'ring', 'shifted']
    fb = FontBuilder(src['head'].unitsPerEm, isTTF=True)
    fb.setupGlyphOrder(order)
    cmap = {0x20: 'space', 0x41: 'A', 0x4F: 'O', 0x6F: 'o', 0xB4: 'acute', 0x54: 'T', 0xC1: 'Aacute',
            0xE000: 'Oscaled', 0xE001: 'Oxy', 0xE002: 'Orot', 0xE003: 'nested', 0xE004: 'anchored', 0xE005: 'ring',
            0xE006: 'shifted', 0x1F600: 'ring'}
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    glyf = fb.font['glyf']
    for g in order:
        glyf[g].recalcBounds(glyf)
    metrics = {}
    for g in order:
        adv = hm.get(g, (900, 0))[0]
        lsb = getattr(glyf[g], 'xMin', 0)
        metrics[g] = (adv, lsb + (37 if g == 'shifted' else 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=896, descent=-256)
    fb.setupNameTable({'familyName': 'Kenney Composites test', 'styleName': 'Regular',
                       'copyright': 'Generated from Kenney Future (CC0) by tools/ui-font-fixtures.py'})
    fb.setupOS2(version=4, sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=50, usWinAscent=900, usWinDescent=260, fsSelection=0xC0)
    fb.setupPost()
    kern = newTable('kern')
    kern.version = 0
    st = KernTable_format_0()
    st.version, st.coverage, st.format = 0, 1, 0
    st.kernTable = {('A', 'T'): -90, ('T', 'o'): -40, ('Aacute', 'T'): -85, ('o', 'T'): -30, ('T', 'A'): 0}
    kern.kernTables = [st]
    fb.font['kern'] = kern
    return TTFont(io.BytesIO(to_bytes(fb.font)))


def build_variable(src):
    """Variable TrueType: masters derived from Kenney Future outlines (CC0)."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor, InstanceDescriptor
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
    from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
    from fontTools import varLib
    gs = src.getGlyphSet()
    base = ['.notdef', 'space', 'A', 'V', 'T', 'O', 'o', 'e', 'acute']
    default = {g: tt_glyph(gs, g) for g in base}
    glyf0 = src['glyf']

    def master(name, sx, sy, wobble, adv_scale, acute_dx, kern_scale):
        glyphs = {}
        for g in base:
            gl = default[g]
            new = Glyph()
            if gl.numberOfContours > 0:
                from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
                coords = []
                for i, (x, y) in enumerate(gl.coordinates):
                    # most glyphs scale linearly (varLib's IUP optimiser then drops most points: sparse
                    # deltas, shared point numbers); 'e' and 'T' also wobble irregularly (private points)
                    w = wobble if (g in ('e', 'T') and i % 4 == 1) else 0
                    coords.append((round(x * sx + w), round(y * sy - w)))
                new.coordinates = GlyphCoordinates(coords)
                new.endPtsOfContours = list(gl.endPtsOfContours)
                new.flags = bytearray(gl.flags)
                new.numberOfContours = gl.numberOfContours
                from fontTools.ttLib.tables import ttProgram
                new.program = ttProgram.Program()
                new.program.fromBytecode(b'')
            else:
                new.numberOfContours = 0
            glyphs[g] = new

        def comp(n, x, y, transform=None):
            c = GlyphComponent()
            c.glyphName, c.x, c.y, c.flags = n, x, y, 0
            if transform:
                c.transform = transform
            return c
        a = Glyph(); a.numberOfContours = -1
        a.components = [comp('A', 0, 0), comp('acute', 280 + acute_dx, 180)]
        glyphs['Aacute'] = a
        b = Glyph(); b.numberOfContours = -1
        b.components = [comp('o', 0, 0, [[0.5, 0], [0, 0.5]]), comp('Aacute', 400 + acute_dx, 0)]
        glyphs['small'] = b
        order = base + ['Aacute', 'small']
        fb = FontBuilder(1024, isTTF=True)
        fb.setupGlyphOrder(order)
        fb.setupCharacterMap({0x20: 'space', 0x41: 'A', 0x56: 'V', 0x54: 'T', 0x4F: 'O', 0x6F: 'o', 0x65: 'e',
                              0xB4: 'acute', 0xC1: 'Aacute', 0xE000: 'small'})
        fb.setupGlyf(glyphs)
        gl = fb.font['glyf']
        for g in order:
            gl[g].recalcBounds(gl)
        metrics = {}
        for g in order:
            adv = src['hmtx'][g][0] if g in base else src['hmtx']['A'][0] + 400
            metrics[g] = (round(adv * adv_scale), getattr(gl[g], 'xMin', 0))
        fb.setupHorizontalMetrics(metrics)
        fb.setupHorizontalHeader(ascent=896, descent=-256)
        fb.setupNameTable({'familyName': 'Kenney Var test', 'styleName': name,
                           'copyright': 'Generated from Kenney Future (CC0) by tools/ui-font-fixtures.py'})
        fb.setupOS2(sTypoAscender=896, sTypoDescender=-256, usWinAscent=896, usWinDescent=256)
        fb.setupPost()
        k = kern_scale
        addOpenTypeFeaturesFromString(fb.font, f"""
languagesystem DFLT dflt;
languagesystem latn dflt;
feature kern {{
  pos A V {round(-80 * k)};
  pos V A {round(-70 * k)};
  pos T o {round(-60 * k)};
  @R = [O o e];
  @L = [T V];
  pos @L @R {round(-30 * k)};
}} kern;
""")
        return TTFont(io.BytesIO(to_bytes(fb.font)))

    ds = DesignSpaceDocument()
    wght = AxisDescriptor()
    wght.tag, wght.name, wght.minimum, wght.default, wght.maximum = 'wght', 'Weight', 100, 400, 900
    wght.map = [(100, 100), (400, 400), (700, 550), (900, 900)]
    wdth = AxisDescriptor()
    wdth.tag, wdth.name, wdth.minimum, wdth.default, wdth.maximum = 'wdth', 'Width', 75, 100, 100
    ds.addAxis(wght)
    ds.addAxis(wdth)
    masters = [
        ('Regular', {'Weight': 400, 'Width': 100}, (1.0, 1.0, 0, 1.0, 0, 1.0)),
        ('Thin', {'Weight': 100, 'Width': 100}, (0.95, 1.0, 3, 0.96, -10, 0.8)),
        ('Black', {'Weight': 900, 'Width': 100}, (1.12, 1.02, -7, 1.1, 25, 1.4)),
        ('SemiBold', {'Weight': 650, 'Width': 100}, (1.07, 1.0, 5, 1.05, 12, 1.15)),   # intermediate master
        ('Condensed', {'Weight': 400, 'Width': 75}, (0.8, 1.0, 2, 0.82, -30, 0.9)),
        ('BlackCondensed', {'Weight': 900, 'Width': 75}, (0.9, 1.02, -4, 0.92, 5, 1.2)),
    ]
    for name, loc, params in masters:
        s = SourceDescriptor()
        s.font = master(name, *params)
        s.location = loc
        s.styleName = name
        s.familyName = 'Kenney Var test'
        ds.addSource(s)
    for name, loc in [('Thin', {'Weight': 100, 'Width': 100}), ('Regular', {'Weight': 400, 'Width': 100}),
                      ('Bold', {'Weight': 550, 'Width': 100}), ('Black', {'Weight': 900, 'Width': 100})]:
        inst = InstanceDescriptor()
        inst.styleName = name
        inst.familyName = 'Kenney Var test'
        inst.designLocation = loc
        ds.addInstance(inst)
    vf, _, _ = varLib.build(ds)
    return TTFont(io.BytesIO(to_bytes(vf)))



def build_guards():
    """Hostile-but-well-formed fonts for the recursion guards (no references: fontTools itself would
    recurse forever drawing them). Outlines are plain rectangles."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.misc.psCharStrings import T2CharString
    from fontTools.cffLib import SubrsIndex
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    # CFF: 'loop' calls a subroutine that calls itself; 'fan' fans out 10× per level for 9 levels
    order = ['.notdef', 'box', 'loop', 'fan']
    box = [100, 0, 'rmoveto', 300, 0, 'rlineto', 0, 400, 'rlineto', -300, 0, 'rlineto', 'endchar']
    progs = {'.notdef': ['endchar'], 'box': box, 'loop': [0 - 107, 'callsubr', 'endchar'], 'fan': [1 - 107, 'callsubr', 'endchar']}
    fb = FontBuilder(1000, isTTF=False)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x41: 'box', 0x42: 'loop', 0x43: 'fan'})
    fb.setupCFF('Guards', {'FullName': 'Guards'}, {g: T2CharString(program=p) for g, p in progs.items()}, {})
    fb.setupHorizontalMetrics({g: (500, 0) for g in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Guards', 'styleName': 'Regular'})
    fb.setupOS2()
    fb.setupPost()
    td = fb.font['CFF '].cff.topDictIndex[0]
    subrs = SubrsIndex()
    subrs.append(T2CharString(program=[0 - 107, 'callsubr', 'return']))              # 0: calls itself
    for level in range(9):                                                            # 1..9: each calls the next 10×
        subrs.append(T2CharString(program=[level + 2 - 107, 'callsubr'] * 10 + ['return']))
    subrs.append(T2CharString(program=[1, 1, 'rlineto', 'return']))                   # 10: leaf
    td.Private.Subrs = subrs
    for g in order:
        td.CharStrings[g].private = td.Private
    fb.font.recalcBBoxes = False
    fb.font.save(OUT / 'guards-cff.otf')
    # glyf: 'selfloop' uses itself as a component; 'deep0' nests 20 levels
    fb = FontBuilder(1000, isTTF=True)
    order = ['.notdef', 'box', 'selfloop'] + [f'deep{i}' for i in range(20)]
    pen = TTGlyphPen(None)
    pen.moveTo((100, 0)); pen.lineTo((400, 0)); pen.lineTo((400, 400)); pen.lineTo((100, 400)); pen.closePath()
    glyphs = {'.notdef': Glyph(), 'box': pen.glyph()}
    b = glyphs['box']
    b.xMin, b.yMin, b.xMax, b.yMax = 100, 0, 400, 400
    def composite(name):
        g = Glyph()
        g.numberOfContours = -1
        c = GlyphComponent()
        c.glyphName, c.x, c.y, c.flags = name, 0, 0, 0
        g.components = [c]
        g.xMin = g.yMin = g.xMax = g.yMax = 0
        return g
    glyphs['selfloop'] = composite('selfloop')
    for i in range(20):
        glyphs[f'deep{i}'] = composite(f'deep{i + 1}' if i < 19 else 'box')
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x41: 'box', 0x42: 'selfloop', 0x43: 'deep0', 0x44: 'deep5'})
    fb.setupGlyf(glyphs, calcGlyphBounds=False)
    fb.setupHorizontalMetrics({g: (500, 0) for g in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Guards', 'styleName': 'Regular'})
    fb.setupOS2()
    fb.setupPost()
    fb.setupMaxp()
    fb.font.recalcBBoxes = False
    fb.font.save(OUT / 'guards-glyf.ttf')


def build_tables_ref():
    """cmap subtables in every supported format and a name table, compiled by fontTools, with the
    mappings/strings fontTools decodes from them (tables.ref.json; no font file needed)."""
    from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
    from fontTools.ttLib.tables._n_a_m_e import NameRecord
    font = TTFont(OUT / 'kenney-composites.ttf')
    gid = font.getGlyphID

    def cmap_table(*subs):
        t = newTable('cmap')
        t.tableVersion = 0
        t.tables = []
        for fmt, pid, eid, mapping in subs:
            st = CmapSubtable.newSubtable(fmt)
            st.platformID, st.platEncID, st.language = pid, eid, 0
            st.cmap = dict(mapping)
            t.tables.append(st)
        data = t.compile(font)
        back = newTable('cmap')
        back.decompile(data, font)  # what fontTools reads back from the compiled bytes
        return data, back

    cases = []

    def case(label, subs, expect):
        data, back = cmap_table(*subs)
        chosen = {}
        for st in back.tables:
            if (st.platformID, st.platEncID) == expect:
                chosen = st.cmap
        m = {}
        for code, name in chosen.items():
            if gid(name) == 0:
                continue
            if expect == (1, 0):
                code = ord(bytes([code]).decode('mac_roman'))
            m[code] = gid(name)
            if expect == (3, 0) and 0xF020 <= code <= 0xF0FF:
                m.setdefault(code - 0xF000, gid(name))
        cases.append({'label': label, 'hex': data.hex(), 'numGlyphs': len(font.getGlyphOrder()),
                      'map': sorted([k, v] for k, v in m.items())})

    case('format 0 (1,0) Mac Roman', [(0, 1, 0, {0x41: 'A', 0x8E: 'Aacute', 0xDB: 'O', 0xA9: 'T', 0xF0: 'o', 0x20: 'space'})], (1, 0))
    case('format 4 (3,1) deltas and range offsets', [(4, 3, 1, {0x41: 'A', 0x42: 'T', 0x43: 'O', 0x44: 'o', 0x45: 'A', 0x100: 'acute',
                                                                0x101: 'Oxy', 0x102: 'space', 0xFFFD: 'space', 0x3000: 'ring'})], (3, 1))
    case('format 6 (3,1) trimmed array', [(6, 3, 1, {0x30: 'A', 0x31: 'T', 0x33: 'O', 0x38: 'o'})], (3, 1))
    case('format 12 (3,10) groups', [(12, 3, 10, {0x41: 'A', 0x1F600: 'ring', **{0x10000 + i: n for i, n in enumerate(['A', 'O', 'o', 'T', 'acute'])}})], (3, 10))
    case('format 13 (0,6) many-to-one', [(13, 0, 6, {**{c: 'space' for c in range(0x2000, 0x200B)}, **{c: 'O' for c in range(0x1F000, 0x1F010)}, 0x41: 'A'})], (0, 6))
    case('format 4 (3,0) symbol, mirrored to U+0020-00FF', [(4, 3, 0, {0xF041: 'A', 0xF054: 'T', 0xF0B4: 'acute'})], (3, 0))
    case('(3,10) wins over (3,1)', [(4, 3, 1, {0x41: 'A', 0x42: 'O'}), (12, 3, 10, {0x41: 'T', 0x1F600: 'ring'})], (3, 10))

    name = newTable('name')
    name.names = []
    def rec(nid, pid, eid, lang, text):
        r = NameRecord()
        r.nameID, r.platformID, r.platEncID, r.langID = nid, pid, eid, lang
        r.string = text.encode('mac_roman') if pid == 1 else text.encode('utf_16_be')
        name.names.append(r)
    rec(1, 1, 0, 0, 'Café ©™ ¿')               # only a Mac Roman record
    rec(2, 3, 1, 0x412, '보통')                 # Windows Korean …
    rec(2, 3, 1, 0x409, 'Regular')              # … loses to Windows English
    rec(4, 1, 0, 0, 'mac full name')            # Mac …
    rec(4, 0, 3, 0, 'Unicode 𝔘 full name')      # … loses to Unicode platform
    rec(13, 3, 1, 0x409, 'CC0 licence text')
    data = name.compile(font)
    back = newTable('name')
    back.decompile(data, font)
    pick = lambda nid, pid, eid, lang: back.getName(nid, pid, eid, lang).toUnicode()
    names = {'hex': data.hex(), 'expect': {1: pick(1, 1, 0, 0), 2: pick(2, 3, 1, 0x409), 4: pick(4, 0, 3, 0), 13: pick(13, 3, 1, 0x409)}}
    write_json(OUT / 'tables.ref.json', {'macRoman': [ord(bytes([c]).decode('mac_roman')) for c in range(256)],
                                         'cmaps': cases, 'name': names})

def ascii_gids(font, extra=()):
    cmap = font.getBestCmap()
    return sorted({font.getGlyphID(cmap[c]) for c in list(range(32, 127)) + list(extra) if c in cmap})


def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CORPUS / 'licences' / 'kenney-fonts.txt', OUT / 'LICENSE-kenney.txt')
    ttfs = ['KenneyFuture.ttf', 'KenneyPixel.ttf', 'KenneyMiniSquareMono.ttf']
    for f in ttfs:
        shutil.copyfile(kenney(f), OUT / f)
        font = TTFont(OUT / f)
        write_json(OUT / (Path(f).stem + '.ref.json'), dump(font))
    # WOFF 1.0 of Mini Square Mono (reference = the TTF reference: same tables)
    w = TTFont(OUT / 'KenneyMiniSquareMono.ttf')
    w.flavor = 'woff'
    w.save(OUT / 'kenney-mini.woff')
    future = TTFont(kenney('KenneyFuture.ttf'))
    refs = {}
    for cid in (False, True):
        name = 'kenney-future-cid.otf' if cid else 'kenney-future-cff.otf'
        font = build_cff(future, cid=cid)
        font.save(OUT / name)
        font = TTFont(OUT / name)
        refs[cid] = dump(font, kern_gids=ascii_gids(font))
    # The CID font draws the same outlines; store only what differs from the name-keyed reference
    # (the seac glyph, which the CID font cannot use) so the fixture budget is not spent twice.
    a, b = refs[False], refs[True]
    same = [g for g in a['glyphs'] if a['glyphs'][g] == b['glyphs'][g] and a['bounds'][g] == b['bounds'][g]]
    assert len(same) >= len(a['glyphs']) - 1, 'CID and name-keyed CFF fixtures should draw the same outlines'
    b['glyphsSameAs'] = 'kenney-future-cff.ref.json'
    b['glyphs'] = {g: v for g, v in b['glyphs'].items() if g not in same}
    b['bounds'] = {g: v for g, v in b['bounds'].items() if g not in same}
    write_json(OUT / 'kenney-future-cff.ref.json', a)
    write_json(OUT / 'kenney-future-cid.ref.json', b)
    comp = build_composites(future)
    comp.save(OUT / 'kenney-composites.ttf')
    comp = TTFont(OUT / 'kenney-composites.ttf')
    ref = dump(comp, kern_gids=list(range(len(comp.getGlyphOrder()))))
    # point-matched components cannot be drawn by fontTools' pen protocol: reference the flattened points
    glyf = comp['glyf']
    coords, ends, flags = glyf['anchored'].getCoordinates(glyf)
    ref['anchoredPoints'] = {'xy': [num(v) for p in coords for v in p], 'ends': list(ends), 'on': [f & 1 for f in flags]}
    write_json(OUT / 'kenney-composites.ref.json', ref)
    var = build_variable(future)
    var.save(OUT / 'kenney-var.ttf')
    var = TTFont(OUT / 'kenney-var.ttf')
    locs = [{'wght': 100}, {'wght': 250}, {'wght': 700}, {'wght': 900}, {'wght': 650, 'wdth': 75}, {'wdth': 87.5},
            {'wght': 900, 'wdth': 75}]
    write_json(OUT / 'kenney-var.ref.json',
               dump(var, kern_gids=list(range(len(var.getGlyphOrder()))), locations=locs,
                    instancer_locations=[{'wght': 400}, {'wght': 700}, {'wght': 900, 'wdth': 80}]))
    build_guards()
    build_tables_ref()
    # TTC of the two small generated TrueType faces (references = their own .ref.json files)
    coll = TTCollection()
    coll.fonts = [TTFont(OUT / 'kenney-composites.ttf'), TTFont(OUT / 'kenney-var.ttf')]
    coll.save(OUT / 'kenney-pair.ttc', shareTables=True)
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f'wrote {len(list(OUT.iterdir()))} files, {total/1024:.1f} KB in {OUT.relative_to(ROOT)}')


# ---------------------------------------------------------------- ad-hoc dumps for corpus-only checks

def parse_ranges(s):
    out = []
    for part in s.split(','):
        if not part:
            continue
        if '-' in part[1:]:
            a, b = part.split('-', 1) if not part.startswith('-') else part[1:].split('-', 1)
            out += range(int(a, 0), int(b, 0) + 1)
        else:
            out.append(int(part, 0))
    return out


def parse_loc(s):
    return {k: float(v) for k, v in (p.split('=') for p in s.split(',') if p)} if s else None


def cli_dump(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('font')
    ap.add_argument('--index', type=int, default=0)
    ap.add_argument('--gids', default='')
    ap.add_argument('--codepoints', default='')
    ap.add_argument('--kern-codepoints', default='')
    ap.add_argument('--location', default='')
    ap.add_argument('--instancer', action='store_true', help='reference the location through varLib.instancer (on a gid-preserving subset)')
    a = ap.parse_args(argv)
    font = TTFont(a.font, fontNumber=a.index if a.font.lower().endswith(('.ttc', '.otc')) else -1)
    cmap = font.getBestCmap() or {}
    gids = parse_ranges(a.gids)
    for cp in parse_ranges(a.codepoints):
        if cp in cmap:
            gids.append(font.getGlyphID(cmap[cp]))
    gids = sorted(set(gids))
    kern_gids = sorted({font.getGlyphID(cmap[c]) for c in parse_ranges(a.kern_codepoints) if c in cmap}) if a.kern_codepoints else None
    loc = parse_loc(a.location)
    if loc and a.instancer:
        from fontTools import subset
        from fontTools.varLib import instancer
        order = font.getGlyphOrder()
        keep = sorted(set(gids) | set(kern_gids or []))
        opts = subset.Options()
        opts.retain_gids = True
        opts.notdef_outline = True
        opts.layout_features = ['kern']
        opts.name_IDs = ['*']
        sub = subset.Subsetter(opts)
        sub.populate(glyphs=[order[g] for g in keep])
        sub.subset(font)
        inst = instancer.instantiateVariableFont(font, loc)
        inst = TTFont(io.BytesIO(to_bytes(inst)))
        igs = inst.getGlyphSet()
        iorder = inst.getGlyphOrder()
        ref = {'glyphs': {}, 'advances': {}, 'user': loc, 'source': 'instancer'}
        for g in gids:
            ref['glyphs'][g] = enc(outline(igs, iorder[g])[0])
            ref['advances'][g] = inst['hmtx'][iorder[g]][0]
        if kern_gids is not None:
            ref['kernGids'] = kern_gids
            ref['kern'] = kern_pairs(inst, kern_gids)
        json.dump(ref, sys.stdout, separators=(',', ':'))
        return
    ref = dump(font, gids=gids, kern_gids=kern_gids, locations=[loc] if loc else ())
    ref['cmapCount'] = len(ref['cmap'])
    del ref['cmap']
    ref['advances'] = {g: ref['advances'][g] for g in gids}
    json.dump(ref, sys.stdout, separators=(',', ':'))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'dump':
        cli_dump(sys.argv[2:])
    else:
        generate()
