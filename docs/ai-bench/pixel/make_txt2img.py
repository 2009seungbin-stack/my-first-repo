"""Text-to-image AI "pixel art" generated for this benchmark (released CC0 with prompts): SDXL base 1.0 + the
pixel-art-xl LoRA (CreativeML OpenRAIL-M; its card: "downscale 8 times to get pixel perfect images"), 1024 x 1024.
There is no exact truth; the LoRA's nominal pseudo-pixel is 8 px, which the report uses as the expected grid after
checking a sample by eye. Usage: python make_txt2img.py <out-dir> <sdxl-dir> <vae-dir> <lora-dir>"""
import sys,json
from pathlib import Path
import torch
from diffusers import StableDiffusionXLPipeline,AutoencoderKL
out,sdxl,vae_dir,lora=[Path(p) for p in sys.argv[1:5]];out.mkdir(parents=True,exist_ok=True)
PROMPTS=['a cute corgi sticker, white background','a knight with a sword, game sprite, plain background','a red potion bottle item icon','a smiling girl with pink hair, portrait',
 'a treasure chest, game item, white background','a cozy cottage in a forest','a green slime monster, game sprite','a space ship, side view, black background',
 'a cat sitting, sticker, white background','a wizard casting a spell','a mushroom village at night','a robot mascot waving, white background',
 'a sword and shield icon set','a sunset over the ocean','a ramen bowl, food icon','a dragon flying over mountains',
 'a boy with a backpack, character sheet, white background','a cherry blossom tree','a frog wearing a hat, sticker','a city street with neon signs',
 'a golden coin and gem icons','a fox character, idle pose, plain background','a haunted castle','a bunny emoji with a heart, white background']
vae=AutoencoderKL.from_pretrained(vae_dir,torch_dtype=torch.float16)
pipe=StableDiffusionXLPipeline.from_pretrained(sdxl,vae=vae,torch_dtype=torch.float16,variant='fp16',use_safetensors=True).to('cuda')
pipe.load_lora_weights(str(lora),weight_name='pixel-art-xl.safetensors');pipe.set_progress_bar_config(disable=True)
rows=[]
for i,p in enumerate(PROMPTS):
    seed=1000+i;prompt=f'pixel art, {p}, simple, flat colors';neg='3d render, realistic, blurry, text, watermark'
    im=pipe(prompt=prompt,negative_prompt=neg,width=1024,height=1024,guidance_scale=6.0,num_inference_steps=30,generator=torch.Generator('cuda').manual_seed(seed)).images[0]
    rid=f'sdxlpx-{i+1:02d}';im.save(out/f'{rid}.png')
    rows.append({'id':rid,'file':f'{rid}.png','prompt':prompt,'negative':neg,'seed':seed,'model':'stabilityai/stable-diffusion-xl-base-1.0 fp16 + madebyollin/sdxl-vae-fp16-fix + nerijs/pixel-art-xl','steps':30,'cfg':6.0,'nominal_cell':8});print(rid,flush=True)
(out/'generated.json').write_text(json.dumps(rows,indent=1))
