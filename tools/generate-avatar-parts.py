"""Derive UI thumbnails and a provenance ledger from the self-authored pixel renderer."""
import base64
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/avatar-parts'
OUT.mkdir(parents=True,exist_ok=True)
source=ROOT/'src/avatar/render.js'
catalog=ROOT/'src/avatar/catalog.js'
assert subprocess.run(['git','diff','--quiet','HEAD','--','src/avatar/render.js','src/avatar/catalog.js'],cwd=ROOT).returncode==0,'Commit the renderer and catalog before generating a provenance URL'
commit=subprocess.check_output(['git','log','-1','--format=%H','--','src/avatar/render.js'],cwd=ROOT,text=True).strip()
source_url=f'https://github.com/2009seungbin-stack/my-first-repo/blob/{commit}/src/avatar/render.js'
code="""import {PARTS} from './src/avatar/catalog.js';import {renderLogical} from './src/avatar/render.js';
const list=Object.entries(PARTS).flatMap(([category,parts])=>parts.map(([id])=>({category,id,data:Buffer.from(renderLogical({[category]:id}).data).toString('base64')})));
console.log(JSON.stringify(list));
"""
items=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True))
records=[]
for item in items:
    filename=f"{item['category']}-{item['id']}.png"
    image=Image.frombytes('RGBA',(16,16),base64.b64decode(item['data']))
    image.resize((64,64),Image.Resampling.NEAREST).save(OUT/filename,optimize=True)
    records.append({'category':item['category'],'id':item['id'],'preview':filename,'sha256':hashlib.sha256((OUT/filename).read_bytes()).hexdigest(),'artist':'Nerulio original pixel art authored for this project','sourceUrl':source_url,'license':'CC0-1.0','licenseUrl':'https://creativecommons.org/publicdomain/zero/1.0/','authoredDate':'2026-09-28'})
manifest={'sourceRenderer':str(source.relative_to(ROOT)).replace('\\','/'),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'catalogSha256':hashlib.sha256(catalog.read_bytes()).hexdigest(),'logicalGrid':[16,16],'previewSize':[64,64],'scaling':'nearest integer 4x','parts':records}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Wrote {len(records)} original CC0 part previews and manifest')
