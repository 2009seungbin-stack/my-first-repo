"""docs/pixel-bench/score.py with the extra case kind 'ai-img2img' (the SDXL re-drawn set) and scores written next to
the outputs: python score_px.py <tool> <out-dir> --data <data-dir> [--quiet]"""
import sys,os,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('score',str(Path(__file__).resolve().parents[2]/'pixel-bench'/'score.py'));S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
S.KINDS=S.KINDS+['ai-img2img'];S.HERE=os.environ.get('PX_SCORES',str(Path(sys.argv[2]).resolve().parent))
S.main()
