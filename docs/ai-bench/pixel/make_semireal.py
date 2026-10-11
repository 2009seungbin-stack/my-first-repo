"""Semi-real AI pixel art WITH truth: real CC0 1x pixel art (the 13 src1x crops of the earlier pixel benchmark) is
enlarged with nearest neighbour to ~1024 px on a plain backdrop and then re-drawn by an actual image model
(SDXL base 1.0 + the pixel-art-xl LoRA, img2img). The model re-paints every pseudo-pixel (soft and uneven edges,
per-cell colour noise, drifting cell sizes, invented detail at higher strength) the way generated "pixel art" looks,
while the layout stays the 1x source's, so the source is the truth for grid size and colours.
Usage (CUDA venv with diffusers): python make_semireal.py <src1x-dir> <out-data-dir> <sdxl-dir> <vae-dir> <lora-dir>
Writes <out>/cases/<id>.png, <out>/truth/<id>.png and <out>/cases.json in the docs/pixel-bench case format
(kind 'ai-img2img'). Seeds, prompts and strengths are recorded per case."""
import sys,json,random
from pathlib import Path
import numpy as np,torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline,AutoencoderKL
src,out,sdxl,vae_dir,lora=[Path(p) for p in sys.argv[1:6]];(out/'cases').mkdir(parents=True,exist_ok=True);(out/'truth').mkdir(exist_ok=True)
SUBJECT={'cave47':'cave tiles','kpp_chars':'platformer characters','kpp_tiles':'platformer tiles','micro_rogue':'tiny roguelike sprites','ninja_run':'ninja running animation frames',
 'old_hero':'retro hero sprites','onebit':'one-bit dungeon tiles','rogue_chars':'roguelike characters','rpg_sheet':'rpg sprite sheet','samurai':'samurai sprites',
 'sprite_boy':'boy character sprites','sumo_hulk_rows':'sumo wrestler sprites','tiny_dungeon':'dungeon tiles and heroes'}
BACKDROPS=[(232,228,220),(255,255,255),(40,44,52),(214,232,246)]
vae=AutoencoderKL.from_pretrained(vae_dir,torch_dtype=torch.float16)
pipe=StableDiffusionXLImg2ImgPipeline.from_pretrained(sdxl,vae=vae,torch_dtype=torch.float16,variant='fp16',use_safetensors=True).to('cuda')
pipe.load_lora_weights(str(lora),weight_name=next(p.name for p in lora.glob('*.safetensors')));pipe.set_progress_bar_config(disable=True)
cases=[];rng=random.Random(20261011)
for f in sorted(src.glob('*.png')):
    name=f.stem;im=Image.open(f).convert('RGBA');w,h=im.size
    for k,strength in enumerate((0.35,0.5)):
        s=max(6,min(16,1024//max(w,h)));bd=BACKDROPS[(len(cases))%len(BACKDROPS)]
        flat=Image.new('RGBA',im.size,bd+(255,));flat.alpha_composite(im)
        # a fractional factor gives cells of uneven width (s and s+1), as generated pseudo-pixels have
        sf=s*rng.uniform(.95,1.05);bw,bh=round(w*sf),round(h*sf);big=flat.convert('RGB').resize((bw,bh),Image.NEAREST)
        # SDXL works on multiples of 8: pad with the backdrop (the truth canvas grows by whole cells)
        W8,H8=-(-bw//8)*8,-(-bh//8)*8;canvas=Image.new('RGB',(W8,H8),bd);canvas.paste(big,(0,0))
        seed=rng.randrange(1<<31);g=torch.Generator('cuda').manual_seed(seed)
        prompt=f'pixel art, {SUBJECT.get(name,name)}, game sprites, flat colors, plain background';neg='blurry, photo, 3d render, gradient, text, watermark'
        res=pipe(prompt=prompt,negative_prompt=neg,image=canvas,strength=strength,guidance_scale=6.0,num_inference_steps=30,generator=g).images[0]
        cid=f'{name}__sdxl{int(strength*100)}';res.save(out/'cases'/f'{cid}.png');flat.save(out/'truth'/f'{cid}.png')  # truth = the 1x picture as shown (sprites on the backdrop)
        a=np.asarray(flat);cols=len({tuple(p[:3]) for p in a.reshape(-1,4)})
        cases.append({'id':cid,'path':f'cases/{cid}.png','source1x':f'truth/{cid}.png','sourceName':name,'kind':'ai-img2img','tags':['sdxl-img2img'],
          'scaleX':bw/w,'scaleY':bh/h,'phaseX':0.0,'phaseY':0.0,'width':W8,'height':H8,'width1x':w,'height1x':h,'colours1x':cols,
          'transparent':False,'truthTransparent':False,'background':list(bd),
          'notes':f'SDXL base 1.0 fp16 + nerijs/pixel-art-xl LoRA img2img, strength {strength}, cfg 6, 30 steps, seed {seed}, prompt "{prompt}", negative "{neg}"; input = 1x source on {bd} enlarged {bw}x{bh} nearest (x{sf:.3f}) (padded to a multiple of 8 with the backdrop)'})
        print(cid,res.size,flush=True)
(out/'cases.json').write_text(json.dumps({'cases':cases},indent=1))
