import json, urllib.request, time
from pathlib import Path
OUT=Path('C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-texture/ambientcg')  # same folder layout: one dir per set
H={'User-Agent':'Mozilla/5.0 nerulio-corpus'}
get=lambda u:urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=120).read()
assets=json.loads(get('https://api.polyhaven.com/assets?t=textures'))
ids=sorted(assets,key=lambda k:-assets[k].get('download_count',0))[:40:4]
done=[]
for i in ids:
    try:
        f=json.loads(get(f'https://api.polyhaven.com/files/{i}'))
        d=OUT/('polyhaven_'+i);d.mkdir(parents=True,exist_ok=True)
        for key,name in [('nor_gl','nor_gl'),('nor_dx','nor_dx')]:
            url=f[key]['1k']['png']['url'];(d/f'{i}_{name}_1k.png').write_bytes(get(url))
        done.append(i);print('ok',i,flush=True)
    except Exception as e:print('fail',i,e,flush=True)
    time.sleep(.5)
src=OUT.parent/'SOURCES.md'
src.write_text(src.read_text(encoding='utf-8')+'\nPoly Haven (CC0-1.0, https://polyhaven.com/license), 1k PNG nor_gl / nor_dx from https://api.polyhaven.com/files/<id>:\n\n'+'\n'.join(f'- {i}: https://polyhaven.com/a/{i}' for i in done)+'\n',encoding='utf-8')
print('done',len(done))
