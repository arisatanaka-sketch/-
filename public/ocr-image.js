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
  let minX=source.width,minY=source.height,maxX=-1,maxY=-1;
  for(let i=0;i<pixels.data.length;i+=4){
    const ink=isTelopInk(pixels.data[i],pixels.data[i+1],pixels.data[i+2],mode);
    if(ink){const pixel=i/4,x=pixel%source.width,y=Math.floor(pixel/source.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink?0:255;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,padding,padding);
  if(maxX>=minX&&maxY>=minY){
    const width=maxX-minX+1,height=maxY-minY+1;
    const trimmed=document.createElement('canvas');trimmed.width=width+padding*2;trimmed.height=height+padding*2;
    const trimmedCtx=trimmed.getContext('2d');trimmedCtx.fillStyle='#fff';trimmedCtx.fillRect(0,0,trimmed.width,trimmed.height);
    trimmedCtx.drawImage(output,minX+padding,minY+padding,width,height,padding,padding,width,height);
    return trimmed;
  }
  return output;
}
