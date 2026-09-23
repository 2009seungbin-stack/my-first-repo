import sys
from fontTools.ttLib import TTFont
sys.stdout.reconfigure(encoding='utf-8')
for p in sys.argv[1:]:
    f = TTFont(p, lazy=True)
    tabs = sorted(f.keys())
    kern = 'kern' in f
    kp = 0
    if kern:
        for st in f['kern'].kernTables:
            kp += len(getattr(st, 'kernTable', {}) or {})
    gpos_kern = False
    pairs = 0
    if 'GPOS' in f:
        g = f['GPOS'].table
        feats = {fr.FeatureTag for fr in g.FeatureList.FeatureRecord} if g.FeatureList else set()
        gpos_kern = 'kern' in feats
        for fr in g.FeatureList.FeatureRecord:
            if fr.FeatureTag != 'kern': continue
            for li in fr.Feature.LookupListIndex:
                lk = g.LookupList.Lookup[li]
                for st in lk.SubTable:
                    if lk.LookupType == 9: st = st.ExtSubTable
                    if getattr(st, 'LookupType', lk.LookupType) != 2: continue
                    if st.Format == 1:
                        pairs += sum(len(ps.PairValueRecord) for ps in st.PairSet)
                    else:
                        pairs += -1  # class-based; counted as present
    os2 = f['OS/2']; hh = f['hhea']
    print(p.split('\\')[-1], 'upem', f['head'].unitsPerEm, 'glyphs', f['maxp'].numGlyphs, 'cmap', len(f.getBestCmap()), 'kern-table', kern, kp,
          'GPOS-kern', gpos_kern, 'pairfmt1', pairs, 'win', os2.usWinAscent, os2.usWinDescent, 'hhea', hh.ascent, hh.descent, 'typo', os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap, 'glyf' if 'glyf' in f else 'CFF')
