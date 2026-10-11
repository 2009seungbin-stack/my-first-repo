"""CC0 AI-generated pixel art from OpenGameArt (each page states the AI tool; licence field = CC0), plus the 7 real AI
pixel images already in the earlier pixel benchmark (_adhoc/nerulio-studio-pixel/ai_real, CC0, SOURCES.md there).
Usage: python fetch_oga.py <corpus-dir>  -> images/oga-*.{png,jpg} and _src/oga-picked.json"""
import sys,json,hashlib,shutil,time
from pathlib import Path
import requests
ROOT=Path(sys.argv[1]);IMG=ROOT/'images';SRC=ROOT/'_src';UA={'User-Agent':'Mozilla/5.0 nerulio-ai-bench/1.0'}
F='https://opengameart.org/sites/default/files/'
PAGES={ # page: (tool stated on the page, files)
 'chests-2':('Stable Diffusion 1.5 + ControlNet',['00004-417937976.png','00006-417937978.png','00008-417937980.png','00017-1135435582.png']),
 'loot-eggs':('Stable Diffusion 1.5 + ControlNet',['00003-579304203.png','00004-579304204.png','00006-3610808481.png','00006-4126445768.png']),
 'eve-64x64':('Gemini Flash 2',['eve-going-down_0.png','eve-going-right.png','eve-going-up_0.png']),
 'adams-pack-64x64':('Gemini Flash 2',['adam-sleeping.png','adam-thinking.png','adam.png']),
 'samson-man-bible':('Gemini Flash 2',['samson.png']),
 '25-portrait-pixel-art-pack1':('AI image generator (page: "generates pictures with an AI")',['25_portrait_pixel_art_pack1_preview.png']),
}
out=[];k=0
for page,(tool,files) in PAGES.items():
    for f in files:
        r=requests.get(F+f,headers=UA,timeout=120);r.raise_for_status();k+=1;rid=f'oga-{k:02d}';ext=f.rsplit('.',1)[1]
        (IMG/f'{rid}.{ext}').write_bytes(r.content)
        out.append({'id':rid,'file':f'{rid}.{ext}','kind_hint':'pixel','source':f'OpenGameArt: {page} ({tool})','url':'https://opengameart.org/content/'+page,'download':F+f,
                    'license':'CC0-1.0','sha256':hashlib.sha256(r.content).hexdigest()});time.sleep(.5)
AI=Path('C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-pixel/ai_real')
for name,tool,page in [('horror_monster.jpg','ClipDrop Stable Doodle','pixel-art-creatures-from-clipdrop-stable-doodle'),('gosoythoth.png','GPT-4 image output','gosoythoth-mimic'),
                       ('guns.jpg','Nano Banana 2 based, manually cleaned','13-pixel-guns'),('bones.jpg','Nano Banana 2 based, manually cleaned','15-pixel-bones-and-skeletons'),
                       ('asteroid_and_spacejunks.jpg','Nano Banana 2 based, manually cleaned','12-pixel-asteroids-and-space-junks'),('turret.jpg','Nano Banana 2 based, manually cleaned','13-pixel-turrets')]:
    k+=1;rid=f'oga-{k:02d}';ext=name.rsplit('.',1)[1];shutil.copy(AI/name,IMG/f'{rid}.{ext}');data=(IMG/f'{rid}.{ext}').read_bytes()
    out.append({'id':rid,'file':f'{rid}.{ext}','kind_hint':'pixel','source':f'OpenGameArt: {page} ({tool})','url':'https://opengameart.org/content/'+page,'license':'CC0-1.0','sha256':hashlib.sha256(data).hexdigest()})
(SRC/'oga-picked.json').write_text(json.dumps(out,indent=1));print(len(out))
