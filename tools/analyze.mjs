import sharp from 'sharp';import fs from 'fs';
const files=fs.readdirSync('brand').map(f=>'brand/'+f).concat(fs.readdirSync('reference').map(f=>'reference/'+f));
const report={};
for(const f of files){
  const b=fs.readFileSync(f);const isPng=b.slice(1,4).toString()==='PNG';
  const r={bytes:b.length};
  if(isPng){r.ihdr={w:b.readUInt32BE(16),h:b.readUInt32BE(20),bitDepth:b[24],colourType:b[25]};}
  const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  r.dim=[info.width,info.height];
  const hist=new Array(8).fill(0);let blackTransparent=0;
  for(let i=0;i<data.length;i+=4){const a=data[i+3];hist[a>>5]++;if(a<255&&data[i]+data[i+1]+data[i+2]===0)blackTransparent++;}
  r.alphaHist8=hist;r.pureBlackTransparent=blackTransparent;
  report[f]=r;
}
// k-means on the brand PNG (pre-dither crop of the logo), snapped to real pixels
const f='brand/LOGO AXINETIC PNG.png';
const {data,info}=await sharp(f).ensureAlpha().resize(256,256,{kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
const px=[];for(let i=0;i<data.length;i+=4){if(data[i+3]>0)px.push([data[i],data[i+1],data[i+2],(i/4)%256,Math.floor(i/4/256)]);}
let K=8,cen=[];for(let k=0;k<K;k++)cen.push(px[Math.floor(px.length*(k+.5)/K)].slice(0,3));
for(let it=0;it<25;it++){const s=cen.map(()=>[0,0,0,0]);for(const p of px){let bi=0,bd=1e9;cen.forEach((c,i)=>{const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;bi=i}});s[bi][0]+=p[0];s[bi][1]+=p[1];s[bi][2]+=p[2];s[bi][3]++}cen=s.map((x,i)=>x[3]?[x[0]/x[3],x[1]/x[3],x[2]/x[3]]:cen[i])}
const hex=p=>'#'+p.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
report.palette=cen.map(c=>{let best=null,bd=1e9;for(const p of px){const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;best=p}}return {hex:hex(best),x:best[3],y:best[4],count:px.filter(p=>1).length&&0}});
fs.writeFileSync('tools/asset-report.json',JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
