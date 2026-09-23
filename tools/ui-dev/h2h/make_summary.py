import json, os, glob, sys
sys.stdout.reconfigure(encoding='utf-8')
H = os.path.dirname(os.path.abspath(__file__))
out = {'generated': '2026-09-24', 'note': 'quality = tools/font-quality.py (ink pixels); x1 for bitmap, x4/x8 for SDF', 'tools': {}}
for tool in ('msdf-atlas-gen', 'bmfont', 'hiero', 'snowb'):
    runs = {}
    rp = os.path.join(H, tool, 'runs.json')
    rj = {r['name']: r for r in json.load(open(rp, encoding='utf-8'))} if os.path.exists(rp) else {}
    for q in sorted(glob.glob(os.path.join(H, tool, 'q_*.json'))):
        d = json.load(open(q, encoding='utf-8'))
        name = os.path.basename(q)[2:-5]
        qq = {k: ({kk: v[kk] for kk in ('mean_abs_err', 'p95_abs_err', 'wrong_pct', 'glyphs')} if v else None) for k, v in d.get('quality', {}).items()}
        runs[name] = {'quality': qq, 'atlas': d.get('atlas'), 'charset': {k: v for k, v in (d.get('charset') or {}).items() if not k.endswith('_chars')},
                      'registration': d.get('registration'), 'degrade': d.get('degrade'), 'field': d.get('field')}
    for n, r in rj.items():
        runs.setdefault(n, {})['run'] = {k: r.get(k) for k in ('cmd', 'rc', 'seconds', 'steps', 'step_count', 'files', 'zip_files', 'error', 'kernings', 'pages',
                                                              'seconds_to_render_default', 'seconds_to_render_mode', 'seconds_export', 'packed_after_default', 'packed_after_mode', 'export_types_offered') if r.get(k) is not None}
    out['tools'][tool] = runs
json.dump(out, open(os.path.join(H, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(json.dumps(out)))
