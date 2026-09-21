/** 8x8-window luminance SSIM and RGB PSNR. Not a learned perceptual score. */
export function imageMetrics(reference,actual,w,h) {
 if(reference.length!==w*h*4||actual.length!==reference.length||!w||!h)throw Error('Metric dimensions differ');
 let error=0,alphaError=0,ssim=0,windows=0;
 const luma=(d,i)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
 for(let i=0;i<reference.length;i+=4){for(let k=0;k<3;k++)error+=(reference[i+k]-actual[i+k])**2;alphaError+=(reference[i+3]-actual[i+3])**2;}
 for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){
  let a=0,b=0,aa=0,bb=0,ab=0,n=0;
  for(let yy=y;yy<Math.min(y+8,h);yy++)for(let xx=x;xx<Math.min(x+8,w);xx++){
   const i=(yy*w+xx)*4,u=luma(reference,i),v=luma(actual,i);a+=u;b+=v;aa+=u*u;bb+=v*v;ab+=u*v;n++;
  }
  const ma=a/n,mb=b/n,va=Math.max(0,aa/n-ma*ma),vb=Math.max(0,bb/n-mb*mb),cov=ab/n-ma*mb;
  ssim+=((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225));windows++;
 }
 const mse=error/(w*h*3);
 return {ssim:ssim/windows,psnr:mse===0?null:10*Math.log10(255**2/mse),mse,alphaRMSE:Math.sqrt(alphaError/(w*h)),exact:mse===0&&alphaError===0};
}
