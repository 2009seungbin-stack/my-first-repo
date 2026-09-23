"""Run the engine checks over every bundle corpus_tiles.mjs wrote.

    python tools/engine-verify/tile/run_all.py <out dir> [--engines godot,tiled,ldtk,unity] [--only substr]

Writes <out>/engines.json and prints one line per asset and engine.
"""
from __future__ import annotations
import json, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def main():
    out = Path(sys.argv[1])
    engines = sys.argv[sys.argv.index('--engines') + 1].split(',') if '--engines' in sys.argv else ['godot', 'tiled', 'ldtk', 'unity']
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else ''
    results = json.loads((out / 'engines.json').read_text(encoding='utf-8')) if (out / 'engines.json').exists() else {}
    for d in sorted(p for p in out.iterdir() if p.is_dir() and (p / 'model.json').exists()):
        if only and only not in d.name:
            continue
        res = results.setdefault(d.name, {})
        if 'godot' in engines and (d / 'godot-job.json').exists():
            import godot_tile
            job = json.loads((d / 'godot-job.json').read_text(encoding='utf-8'))
            t0 = time.time()
            rep = godot_tile.run(d / 'godot', job, d / '_godot')
            r = godot_tile.judge(job, rep)
            r['seconds'] = round(time.time() - t0, 1)
            res['godot'] = r
            cases = ', '.join(f"{c['name']} {c.get('match_studio')}/{c.get('cells')}" + (f" (truth {c['truth_right']}/{c['truth_cells']})" if 'truth_cells' in c else '') for c in r['cases'])
            print(f"{d.name}: godot {'PASS' if r['pass'] else 'FAIL'} — {cases} {r['errors'] or ''}", flush=True)
        if 'tiled' in engines and (d / 'tiled').exists():
            import tiled_check
            res['tiled'] = tiled_check.check(d)
            print(f"{d.name}: tiled {res['tiled'].get('verdict')} — {res['tiled'].get('summary')}", flush=True)
        if 'ldtk' in engines and (d / 'ldtk').exists():
            import ldtk_check
            res['ldtk'] = ldtk_check.check(d)
            print(f"{d.name}: ldtk {res['ldtk'].get('verdict')} — {res['ldtk'].get('summary')}", flush=True)
        if 'unity' in engines and (d / 'unity').exists():
            import unity_tile
            res['unity'] = unity_tile.check(d)
            print(f"{d.name}: unity {res['unity'].get('verdict')} — {res['unity'].get('summary')}", flush=True)
        (out / 'engines.json').write_text(json.dumps(results, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
