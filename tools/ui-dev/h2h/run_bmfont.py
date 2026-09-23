"""AngelCode BMFont 1.14b command-line runs: Galmuri11 12/24 px, Noto Sans KR 32 px, Kenney Future 32 px; 512x512 multi-page; kerning on."""
import subprocess, os, sys, time, json, glob, re
sys.stdout.reconfigure(encoding='utf-8')
EXE = r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\tools\bmfont\bmfont64.exe'
H2H = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(H2H, 'bmfont')
os.makedirs(OUT, exist_ok=True)
TEMPLATE = """# AngelCode Bitmap Font Generator configuration file
fileVersion=1

# font settings
fontName={name}
fontFile={file}
charSet=0
fontSize={size}
aa={aa}
scaleH=100
useSmoothing={smooth}
isBold=0
isItalic=0
useUnicode=1
disableBoxChars=1
outputInvalidCharGlyph=0
dontIncludeKerningPairs=0
useHinting=1
renderFromOutline=0
useClearType=1
autoFitNumPages=0
autoFitFontSizeMin=0
autoFitFontSizeMax=0

# character alignment
paddingDown=0
paddingUp=0
paddingRight=0
paddingLeft=0
spacingHoriz=1
spacingVert=1
useFixedHeight=0
forceZero=0
widthPaddingFactor=0.00

# output file
outWidth=512
outHeight=512
outBitDepth=32
fontDescFormat={fmt}
fourChnlPacked=0
textureFormat=png
textureCompression=0
alphaChnl=0
redChnl=4
greenChnl=4
blueChnl=4
invA=0
invR=0
invG=0
invB=0

# outline
outlineThickness=0

# selected chars
chars=32-126
"""
RUNS = [
 ('galmuri11_12px', 'Galmuri11 Regular', r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', -12, 'charset_ko_game_bom.txt'),
 ('galmuri11_24px', 'Galmuri11 Regular', r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', -24, 'charset_ko_game_bom.txt'),
 ('notosanskr_32px', 'Noto Sans KR', r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\fonts\NotoSansKR-Regular.otf', -32, 'charset_ko_game_bom.txt'),
 ('kenneyfuture_32px', 'Kenney Future', r'C:\Users\2009s\nerulio-asset-corpus\fonts\kenney-fonts\KenneyFuture.ttf', -32, 'charset_ascii.txt'),
 ('galmuri11_12px_nosmooth', 'Galmuri11 Regular', r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', -12, 'charset_ko_game_bom.txt', 0),
 ('galmuri11_24px_nosmooth', 'Galmuri11 Regular', r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', -24, 'charset_ko_game_bom.txt', 0),
]
only = sys.argv[1:]
res = []
for name, fam, file, size, cs, *sm in RUNS:
    smooth = sm[0] if sm else 1
    if only and name not in only: continue
    for old in glob.glob(os.path.join(OUT, name + '[._]*')): os.remove(old)
    cfg = os.path.join(OUT, name + '.bmfc')
    open(cfg, 'w', encoding='utf-8').write(TEMPLATE.format(name=fam, file=file, size=size, aa=1, smooth=smooth, fmt=0))
    cmd = [EXE, '-c', cfg, '-o', os.path.join(OUT, name + '.fnt'), '-t', os.path.join(H2H, cs)]
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    dt = time.time() - t
    files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(OUT, name + '*')))
    fnt = os.path.join(OUT, name + '.fnt')
    info = {}
    if os.path.exists(fnt):
        t_ = open(fnt, encoding='utf-8', errors='replace').read()
        info = {'chars': len(re.findall(r'^char ', t_, re.M)), 'kernings': len(re.findall(r'^kerning ', t_, re.M)),
                'pages': len(re.findall(r'^page ', t_, re.M)), 'head': t_.splitlines()[:3]}
    res.append({'name': name, 'cmd': subprocess.list2cmdline(cmd), 'rc': r.returncode, 'seconds': round(dt, 2), 'files': files, 'out': (r.stdout + r.stderr)[-400:], **info})
    print(name, r.returncode, round(dt, 2), info, files[:6], (r.stdout + r.stderr)[-200:])
p = os.path.join(OUT, 'runs.json')
old = [x for x in json.load(open(p))] if os.path.exists(p) and only else []
old = [x for x in old if x['name'] not in {r['name'] for r in res}]
json.dump(old + res, open(p, 'w'), indent=1, ensure_ascii=False)
