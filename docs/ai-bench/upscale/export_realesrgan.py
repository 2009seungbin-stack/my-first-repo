"""Export Real-ESRGAN weights (BSD-3-Clause, xinntao/Real-ESRGAN releases) to ONNX with dynamic H/W.
Architectures re-declared from basicsr/realesrgan (BSD-3). Usage: python export_realesrgan.py <dir-with-.pth>"""
import sys,torch,torch.nn as nn,torch.nn.functional as F
from pathlib import Path
class SRVGGNetCompact(nn.Module):
    def __init__(s,num_in_ch=3,num_out_ch=3,num_feat=64,num_conv=16,upscale=4):
        super().__init__();s.upscale=upscale;s.body=nn.ModuleList([nn.Conv2d(num_in_ch,num_feat,3,1,1),nn.PReLU(num_parameters=num_feat)])
        for _ in range(num_conv):s.body.append(nn.Conv2d(num_feat,num_feat,3,1,1));s.body.append(nn.PReLU(num_parameters=num_feat))
        s.body.append(nn.Conv2d(num_feat,num_out_ch*upscale*upscale,3,1,1));s.upsampler=nn.PixelShuffle(upscale)
    def forward(s,x):
        out=x
        for m in s.body:out=m(out)
        return s.upsampler(out)+F.interpolate(x,scale_factor=s.upscale,mode='nearest')
class RDB(nn.Module):
    def __init__(s,nf=64,gc=32):
        super().__init__();s.conv1=nn.Conv2d(nf,gc,3,1,1);s.conv2=nn.Conv2d(nf+gc,gc,3,1,1);s.conv3=nn.Conv2d(nf+2*gc,gc,3,1,1);s.conv4=nn.Conv2d(nf+3*gc,gc,3,1,1);s.conv5=nn.Conv2d(nf+4*gc,nf,3,1,1);s.l=nn.LeakyReLU(.2,True)
    def forward(s,x):
        x1=s.l(s.conv1(x));x2=s.l(s.conv2(torch.cat((x,x1),1)));x3=s.l(s.conv3(torch.cat((x,x1,x2),1)));x4=s.l(s.conv4(torch.cat((x,x1,x2,x3),1)));x5=s.conv5(torch.cat((x,x1,x2,x3,x4),1))
        return x5*.2+x
class RRDB(nn.Module):
    def __init__(s,nf,gc=32):super().__init__();s.rdb1=RDB(nf,gc);s.rdb2=RDB(nf,gc);s.rdb3=RDB(nf,gc)
    def forward(s,x):return s.rdb3(s.rdb2(s.rdb1(x)))*.2+x
class RRDBNet(nn.Module):
    def __init__(s,num_in_ch=3,num_out_ch=3,scale=4,num_feat=64,num_block=23,num_grow_ch=32):
        super().__init__();s.scale=scale;inch=num_in_ch*(16 if scale==1 else 4 if scale==2 else 1)
        s.conv_first=nn.Conv2d(inch,num_feat,3,1,1);s.body=nn.Sequential(*[RRDB(num_feat,num_grow_ch) for _ in range(num_block)]);s.conv_body=nn.Conv2d(num_feat,num_feat,3,1,1)
        s.conv_up1=nn.Conv2d(num_feat,num_feat,3,1,1);s.conv_up2=nn.Conv2d(num_feat,num_feat,3,1,1);s.conv_hr=nn.Conv2d(num_feat,num_feat,3,1,1);s.conv_last=nn.Conv2d(num_feat,num_out_ch,3,1,1);s.l=nn.LeakyReLU(.2,True)
    def forward(s,x):
        if s.scale==2:x=F.pixel_unshuffle(x,2)
        f=s.conv_first(x);f=f+s.conv_body(s.body(f))
        f=s.l(s.conv_up1(F.interpolate(f,scale_factor=2,mode='nearest')));f=s.l(s.conv_up2(F.interpolate(f,scale_factor=2,mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))
MODELS={'realesr-general-x4v3':lambda:SRVGGNetCompact(num_conv=32),'realesr-general-wdn-x4v3':lambda:SRVGGNetCompact(num_conv=32),
 'realesr-animevideov3':lambda:SRVGGNetCompact(num_conv=16),'RealESRGAN_x4plus_anime_6B':lambda:RRDBNet(num_block=6),
 'RealESRGAN_x4plus':lambda:RRDBNet(),'RealESRGAN_x2plus':lambda:RRDBNet(scale=2)}
d=Path(sys.argv[1])
for name,mk in MODELS.items():
    p=d/f'{name}.pth'
    if not p.exists():continue
    m=mk();sd=torch.load(p,map_location='cpu',weights_only=True);sd=sd.get('params_ema',sd.get('params',sd));m.load_state_dict(sd,strict=True);m.eval()
    x=torch.rand(1,3,64,64)
    torch.onnx.export(m,x,str(d/f'{name}.onnx'),input_names=['input'],output_names=['output'],dynamic_axes={'input':{2:'h',3:'w'},'output':{2:'H',3:'W'}},opset_version=17,dynamo=False)
    print(name,'ok',(d/f'{name}.onnx').stat().st_size)
# Real-ESRGAN's own CLI runs realesr-general-x4v3 with --denoise_strength 0.5 by default: the weights are
# interpolated with realesr-general-wdn-x4v3 (deep network interpolation). Export that mix too (dni0.5).
a,b=d/'realesr-general-x4v3.pth',d/'realesr-general-wdn-x4v3.pth'
if a.exists() and b.exists():
    for s in (0.5,0.75):
        sa=torch.load(a,map_location='cpu',weights_only=True);sb=torch.load(b,map_location='cpu',weights_only=True)
        sa=sa.get('params',sa);sb=sb.get('params',sb);m=SRVGGNetCompact(num_conv=32)
        m.load_state_dict({k:s*sa[k]+(1-s)*sb[k] for k in sa});m.eval();n=f'realesr-general-x4v3-dni{s}'
        torch.onnx.export(m,torch.rand(1,3,64,64),str(d/f'{n}.onnx'),input_names=['input'],output_names=['output'],dynamic_axes={'input':{2:'h',3:'w'},'output':{2:'H',3:'W'}},opset_version=17,dynamo=False);print(n,'ok')
