"""Background-removal benchmark cases from ai-300/manifest.json.
Each case: id, input (corpus-relative image; transparent sources are flattened on white into
inputs/<id>.png so every tool sees the same sticker-sheet picture), truth, ignore, group:
 anime = ToonOut characters (human truth) · sheet = character/object on plain or white backdrop · scene = sheet cut-outs over real AI backdrops."""
import json
from pathlib import Path
from PIL import Image
def matte_cases(root):
    root=Path(root);man=json.loads((root/'manifest.json').read_text('utf-8'));out=[];(root/'inputs').mkdir(exist_ok=True)
    for r in man['items']:
        if 'matte' not in r['use']:continue
        t=r['truth'];inp=f"images/{r['file']}"
        if str(t.get('method','')).startswith('alpha'):
            p=root/'inputs'/f"{r['id']}.png"
            if not p.exists():
                im=Image.open(root/inp).convert('RGBA');w=Image.new('RGBA',im.size,(255,255,255,255));w.alpha_composite(im);w.convert('RGB').save(p)
            inp=f"inputs/{r['id']}.png"
        out.append({'id':r['id'],'input':inp,'truth':t['file'],'ignore':t.get('ignore'),'group':'anime' if r.get('matte_kind')=='anime' else 'sheet','method':t['method']})
    for c in man.get('composites',[]):out.append({'id':c['id'],'input':c['input'],'truth':c['truth'],'ignore':c.get('ignore'),'group':'scene','method':'composite'})
    return out
