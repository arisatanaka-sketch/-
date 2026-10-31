export function isTelopInk(r,g,b,mode) {
  if(mode==='white')return Math.min(r,g,b)>165 && Math.max(r,g,b)-Math.min(r,g,b)<65;
  if(mode==='yellow')return r>155 && g>85 && b<165 && r>g*.88 && g>b*1.15;
  if(mode==='gold')return r>180 && g>130 && b<180 && r>g*.85 && g>b*1.15;
  if(mode==='red')return r>130 && r>g*1.5 && r>b*1.35;
  return false;
}

export function prepareTelopCanvas(source,mode='original') {
  if(mode==='original')return source;
  const padding=24;
  const output=document.createElement('canvas');output.width=source.width+padding*2;output.height=source.height+padding*2;
  const ctx=output.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(source,padding,padding);
  const pixels=ctx.getImageData(padding,padding,source.width,source.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const ink=isTelopInk(pixels.data[i],pixels.data[i+1],pixels.data[i+2],mode);
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink?0:255;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,padding,padding);
  return output;
}
