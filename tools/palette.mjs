// Samples the transparent logo: premultiplied resize, k-means on opaque pixels, snapped to real pixel coordinates.
import sharp from 'sharp';import fs from 'fs';
const SRC='brand/LOGO AXINETIC PNG...png';
const N=500;
const {data}=await sharp(SRC).ensureAlpha().resize(N,N,{kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
const px=[];for(let i=0;i<data.length;i+=4)if(data[i+3]>=250)px.push([data[i],data[i+1],data[i+2],(i/4)%N,Math.floor(i/4/N)]);
const K=10;let cen=[];const sorted=[...px].sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));
for(let k=0;k<K;k++)cen.push(sorted[Math.floor(sorted.length*(k+.5)/K)].slice(0,3));
const asg=new Array(px.length);
for(let it=0;it<40;it++){const s=cen.map(()=>[0,0,0,0]);px.forEach((p,j)=>{let bi=0,bd=1e9;cen.forEach((c,i)=>{const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;bi=i}});asg[j]=bi;s[bi][0]+=p[0];s[bi][1]+=p[1];s[bi][2]+=p[2];s[bi][3]++});cen=s.map((x,i)=>x[3]?[x[0]/x[3],x[1]/x[3],x[2]/x[3]]:cen[i])}
const hex=p=>'#'+p.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
const out=cen.map((c,i)=>{let best=null,bd=1e9;px.forEach((p,j)=>{if(asg[j]!==i)return;const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;best=p}});return{hex:hex(best),x:best[3],y:best[4],n:asg.filter(a=>a===i).length}}).sort((a,b)=>b.n-a.n);
// ground colour: dominant pixel of the opaque-black backdrop, from the flat PNG
const bg=await sharp('brand/LOGO AXINETIC PNG.png').removeAlpha().extract({left:20,top:20,width:300,height:300}).raw().toBuffer();
const cnt={};for(let i=0;i<bg.length;i+=3){const k=hex([bg[i],bg[i+1],bg[i+2]]);cnt[k]=(cnt[k]||0)+1}
const ground=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
fs.writeFileSync('tools/palette.json',JSON.stringify({source:SRC,resize:'lanczos3 (libvips premultiplies alpha internally on resize) '+N,clusters:out,ground:{hex:ground[0],n:ground[1]}},null,1));
console.log(JSON.stringify({clusters:out,ground},null,1));
