"""Downloads ambientCG 1K-PNG materials (CC0) and keeps only NormalGL/NormalDX (+ Color) for the GL/DX
detection accuracy run. Target: C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-texture/ambientcg"""
import io, json, sys, urllib.request, zipfile, time
from pathlib import Path
OUT=Path('C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-texture/ambientcg')
IDS=sys.argv[1:] or ['Bricks105','Ground111','Wood095','Tiles141','Asphalt033','PavingStones151','Grass005','Rock064','Metal063','Gravel043','WoodFloor051','Metal049A','Concrete034','CorrugatedSteel009','Road007','Marble012','ScatteredLeaves009','Onyx015','Plaster001','Carpet016','Travertine009','PaintedPlaster017','Fabric062','Leather037','Planks037B','Rock058','RoofingTiles014A','Snow010A','Bark012','Tiles107']
rows=[]
for i in IDS:
    d=OUT/i
    if d.exists() and any(d.glob('*NormalDX*')):rows.append(i);continue
    url=f'https://ambientcg.com/get?file={i}_1K-PNG.zip'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 nerulio-corpus'})
        data=urllib.request.urlopen(req,timeout=120).read()
        z=zipfile.ZipFile(io.BytesIO(data));d.mkdir(parents=True,exist_ok=True)
        for n in z.namelist():
            if any(k in n for k in ['_NormalGL','_NormalDX','_Color']) and n.endswith('.png'):(d/Path(n).name).write_bytes(z.read(n))
        rows.append(i);print('ok',i,len(data)//1024,'KB',flush=True)
    except Exception as e:print('fail',i,e,flush=True)
    time.sleep(1)
(OUT.parent/'SOURCES.md').write_text('# ad-hoc CC0 assets for nerulio/studio-texture\n\nambientCG materials (CC0-1.0, https://docs.ambientcg.com/license/, author ambientCG / Lennart Demes), 1K-PNG zips from https://ambientcg.com/get?file=<ID>_1K-PNG.zip; only *_NormalGL, *_NormalDX and *_Color kept:\n\n'+'\n'.join(f'- {i}: https://ambientcg.com/view?id={i}' for i in rows)+'\n\nPoly Haven textures (CC0-1.0, https://polyhaven.com/license): see polyhaven/ if present.\n',encoding='utf-8')
print('done',len(rows))
