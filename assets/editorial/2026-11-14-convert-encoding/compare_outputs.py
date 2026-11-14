"""Read the packaged files, verify hashes and reproduce recorded pixel differences.
Requires Python 3 and Pillow; no network, account access or file writes.
"""
from pathlib import Path
from PIL import Image
import hashlib,json
HERE=Path(__file__).resolve().parent
data=json.loads((HERE/'measurements.json').read_text(encoding='utf-8'))
for item in [*data['fixtures'],*data['observations']]:
 name=item.get('file') or item['download']
 assert Path(name).name==name
 assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==item['sha256'],name
for row in data['observations']:
 with Image.open(HERE/row['comparedTo']) as a,Image.open(HERE/row['download']) as b:
  a.load();b.load();assert list(b.size)==row['dimensions']
  assert b.format=={'png':'PNG','webp':'WEBP','jpeg':'JPEG'}[row['format']]
  ap=list(a.convert('RGBA').getdata());bp=list(b.convert('RGBA').getdata())
 counts={
  'alphaChangedPixels':sum(x[3]!=y[3] for x,y in zip(ap,bp)),
  'visibleRgbChangedPixels':sum(x[:3]!=y[:3] for x,y in zip(ap,bp) if x[3]>0),
  'opaqueRgbChangedPixels':sum(x[:3]!=y[:3] for x,y in zip(ap,bp) if x[3]==255)}
 assert all(counts[k]==row[k] for k in counts),row['download']
 blob=(HERE/row['download']).read_bytes();types=[]
 if row['format']=='webp':
  assert blob[:4]==b'RIFF' and blob[8:12]==b'WEBP'
  at=12
  while at+8<=len(blob):
   types.append(blob[at:at+4].decode('ascii'));size=int.from_bytes(blob[at+4:at+8],'little');at+=8+size+(size%2)
  assert at==len(blob)
 assert types==row['webpChunks']
 print(row['download'],len(blob),counts,types)
print('Verified 16 downloaded outputs and two authored input files.')
