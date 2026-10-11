"""Markdown table of score_matte.py results: python table.py <out-dir> <group> <model> [...]"""
import sys,json
from pathlib import Path
out,g=Path(sys.argv[1]),sys.argv[2]
cols=['n','iou','mae','edge','thin','halo','recomp','islands','iou<0.9']
print('| tool | '+' | '.join(cols)+' |');print('|'+'---|'*(len(cols)+1))
for m in sys.argv[3:]:
    p=out/m/'scores.json'
    if not p.exists():print(f'| {m} | (missing) |');continue
    a=json.loads(p.read_text())['aggregate'].get(g,{})
    print(f'| {m} | '+' | '.join(('%.4f'%a[c] if c=='iou' else '%.3g'%a[c] if isinstance(a.get(c),float) else str(a.get(c,'-'))) for c in cols)+' |')
