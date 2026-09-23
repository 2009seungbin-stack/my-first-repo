"""Cross-check tools/ninepatch-check.py against Android's own aapt2 (build-tools 37.0.0).
aapt2 compile turns a .9.png into a .flat whose embedded PNG carries an npTc chunk (divs + padding) and
npOl (optical/layout insets). We parse those and compare with the independent reader."""
import subprocess, sys, os, struct, json, tempfile, glob, importlib.util
sys.stdout.reconfigure(encoding='utf-8')
AAPT2 = r'C:\Users\2009s\AppData\Local\Android\Sdk\build-tools\37.0.0\aapt2.exe'
spec = importlib.util.spec_from_file_location('npc', r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tools\ninepatch-check.py')
npc = importlib.util.module_from_spec(spec); spec.loader.exec_module(npc)

def png_chunks(b):
    i = b.find(b'\x89PNG\r\n\x1a\n')
    out = {}
    if i < 0: return out
    i += 8
    while i + 8 <= len(b):
        n, t = struct.unpack('>I4s', b[i:i + 8])
        out[t.decode('latin1')] = b[i + 8:i + 8 + n]
        i += 12 + n
        if t == b'IEND': break
    return out

def aapt2(path):
    tmp = tempfile.mkdtemp()
    # aapt2 needs a res/drawable/<name>.9.png path
    rd = os.path.join(tmp, 'res', 'drawable'); os.makedirs(rd)
    name = 'x_' + ''.join(c if c.isalnum() else '_' for c in os.path.basename(path).lower().replace('.9.png', '')) + '.9.png'
    dst = os.path.join(rd, name)
    open(dst, 'wb').write(open(path, 'rb').read())
    out = os.path.join(tmp, 'out'); os.makedirs(out)
    r = subprocess.run([AAPT2, 'compile', dst, '-o', out], capture_output=True, text=True)
    res = {'rc': r.returncode, 'msg': (r.stdout + r.stderr).strip()[-600:]}
    flats = glob.glob(os.path.join(out, '*.flat'))
    if r.returncode == 0 and flats:
        ch = png_chunks(open(flats[0], 'rb').read())
        if 'npTc' in ch:
            d = ch['npTc']
            nx, ny, nc = d[1], d[2], d[3]
            pl, pr, pt, pb = struct.unpack('>4i', d[12:28])
            xs = list(struct.unpack('>%di' % nx, d[32:32 + 4 * nx]))
            ys = list(struct.unpack('>%di' % ny, d[32 + 4 * nx:32 + 4 * (nx + ny)]))
            res['stretch_x'] = [xs[i:i + 2] for i in range(0, len(xs), 2)]
            res['stretch_y'] = [ys[i:i + 2] for i in range(0, len(ys), 2)]
            res['padding'] = {'left': pl, 'right': pr, 'top': pt, 'bottom': pb}
        if 'npLb' in ch:  # layout (optical) bounds, host (little-endian) order
            l, t, r_, b_ = struct.unpack('<4i', ch['npLb'][:16])
            res['layout_bounds'] = {'left': l, 'top': t, 'right': r_, 'bottom': b_}
        if 'npOl' in ch:  # outline insets computed from alpha (not from frame marks)
            res['outline_insets_ltrb'] = list(struct.unpack('<4i', ch['npOl'][:16]))
        res['chunks'] = sorted(ch)
    return res

files = sys.argv[1:]
rows = []
for f in files:
    mine = npc.check(f)
    ref = aapt2(f)
    agree = None
    if ref['rc'] == 0 and 'stretch_x' in ref:
        agree = (ref['stretch_x'] == mine.get('stretch_x') and ref['stretch_y'] == mine.get('stretch_y') and ref['padding'] == mine.get('content_padding')
                 and (ref.get('layout_bounds') or None) == (mine.get('layout_bounds') or None))
    valid_agree = (ref['rc'] == 0) == bool(mine.get('valid'))
    rows.append({'file': f, 'aapt2': ref, 'ninepatch_check': {k: mine.get(k) for k in ('valid', 'errors', 'stretch_x', 'stretch_y', 'content_padding', 'layout_bounds', 'bad_patches')},
                 'geometry_agrees': agree, 'validity_agrees': valid_agree})
    print(os.path.basename(f), '| aapt2 rc', ref['rc'], '| mine valid', mine.get('valid'), '| geometry agrees', agree, '| validity agrees', valid_agree)
    if agree is False:
        print('   aapt2:', {k: ref.get(k) for k in ('stretch_x', 'stretch_y', 'padding', 'layout_bounds')})
        print('   mine :', {k: mine.get(k) for k in ('stretch_x', 'stretch_y', 'content_padding', 'layout_bounds')})
    if ref['rc']: print('   aapt2 says:', ref['msg'][-300:])
out = os.environ.get('XCHECK_OUT')
if out: json.dump(rows, open(out, 'w'), indent=1)
