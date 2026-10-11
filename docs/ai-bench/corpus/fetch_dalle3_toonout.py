"""(a) DALL-E 3 outputs from ProGamerGov/synthetic-dataset-1m-dalle3-high-quality-captions (MIT): streams the
head of shard 0 and keeps 30 images (1024 px class) spread over subjects; (b) the ToonOut test split
(CC-BY 4.0, Muratori/Seytre/Aubourg, Kartoon AI): AI-generated anime images with hand-annotated alpha.
Usage: python fetch_dalle3_toonout.py <corpus-dir>"""
import sys,json,hashlib,tarfile,io,re,random
from pathlib import Path
import requests
ROOT=Path(sys.argv[1]);SRC=ROOT/'_src';IMG=ROOT/'images';TRUTH=ROOT/'truth';[p.mkdir(exist_ok=True,parents=True) for p in (SRC,IMG,TRUTH)]
UA={'User-Agent':'nerulio-ai-bench/1.0'}
out=[]
# (a) DALL-E 3 -------------------------------------------------------------
D3='https://huggingface.co/datasets/ProGamerGov/synthetic-dataset-1m-dalle3-high-quality-captions/resolve/main/data/data-000000.tar'
if '--skip-dalle' not in sys.argv:
    r=requests.get(D3,stream=True,headers=UA,timeout=120);r.raise_for_status();r.raw.decode_content=True
    items={};seen=0
    with tarfile.open(fileobj=r.raw,mode='r|') as tf:
        for m in tf:
            if not m.isfile():continue
            key,ext=m.name.rsplit('.',1);data=tf.extractfile(m).read();items.setdefault(key,{})[ext]=data
            if 'json' in items[key] and any(e in items[key] for e in ('jpg','jpeg','png','webp')):seen+=1
            if seen>=240:break
    r.close()
    rows=[]
    for key,v in items.items():
        if 'json' not in v:continue
        meta=json.loads(v['json']);ext=next((e for e in ('png','jpg','jpeg','webp') if e in v),None)
        if not ext:continue
        rows.append((key,meta,ext,v[ext]))
    rng=random.Random(20261011);rng.shuffle(rows);k=0
    BAD=re.compile(r'nude|naked|sexy|lingerie|blood|gore|gun|weapon|trump|biden|celebrity|logo',re.I)
    for key,meta,ext,data in rows:
        cap=(meta.get('short_caption') or '')+' '+(meta.get('original_prompt') or '')
        if BAD.search(cap) or min(meta.get('width',0),meta.get('height',0))<900:continue
        k+=1;rid=f'd3-{k:02d}';fn=f'{rid}.{"jpg" if ext=="jpeg" else ext}';(IMG/fn).write_bytes(data)
        out.append({'id':rid,'file':fn,'kind_hint':'dalle3','source':'ProGamerGov synthetic-dataset-1m-dalle3-high-quality-captions (DALL-E 3 outputs)','url':D3+'#'+key,
          'license':'MIT (dataset licence)','prompt':(meta.get('original_prompt') or meta.get('short_caption') or '')[:600],'width':meta.get('width'),'height':meta.get('height'),'sha256':hashlib.sha256(data).hexdigest()})
        if k>=30:break
    print('dalle3',k,flush=True)
# (b) ToonOut test split ---------------------------------------------------
TO='https://huggingface.co/datasets/joelseytre/toonout/resolve/main/data/test_generations_{}.tar'
PARTS=['20250515_action','20250516_items','20250520_emotion','20250520_factory_images','20250520_pose','20250520_ref_images']
if '--skip-toonout' not in sys.argv:
    k=0
    for part in PARTS:
        r=requests.get(TO.format(part),headers=UA,timeout=600);r.raise_for_status()
        tf=tarfile.open(fileobj=io.BytesIO(r.content));names=[m.name for m in tf.getmembers() if m.isfile() and not Path(m.name).name.startswith('._')]
        if part==PARTS[0]:print(names[:12],flush=True)
        groups={}
        for n in names:
            stem=Path(n).stem;groups.setdefault(stem,[]).append(n)
        # rgb lives under .../im/<stem>.png, truth under .../gt/<stem>.png (layout printed above)
        ims=sorted(n for n in names if '/im/' in n);rng=random.Random(part);rng.shuffle(ims)
        for n in ims[:10]:
            stem=Path(n).stem;gt=next((g for g in names if '/gt/' in g and Path(g).stem==stem),None)
            if not gt:continue
            k+=1;rid=f'toon-{k:02d}';data=tf.extractfile(n).read();g=tf.extractfile(gt).read()
            (IMG/f'{rid}.png').write_bytes(data);(TRUTH/f'{rid}.png').write_bytes(g)
            out.append({'id':rid,'file':f'{rid}.png','kind_hint':'anime-toonout:'+part,'source':'ToonOut dataset test split (Kartoon AI generations)','url':TO.format(part)+'#'+n,
              'license':'CC-BY-4.0 (Muratori, Seytre, Aubourg — ToonOut, arXiv:2509.06839)','sha256':hashlib.sha256(data).hexdigest(),
              'truth':{'file':f'truth/{rid}.png','method':'ToonOut human-annotated alpha (dataset gt/)','sha256':hashlib.sha256(g).hexdigest()}})
        print(part,k,flush=True)
old=json.loads((SRC/'dalle3-toonout-picked.json').read_text('utf-8')) if (SRC/'dalle3-toonout-picked.json').exists() else []
keep=[o for o in old if not any(o['id']==n['id'] for n in out)]
(SRC/'dalle3-toonout-picked.json').write_text(json.dumps(keep+out,indent=1,ensure_ascii=False),encoding='utf-8')
