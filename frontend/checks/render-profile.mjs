import { chromium } from '@playwright/test';
import fs from 'node:fs';
const label=process.argv[2]||'sample';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.addInitScript(()=>{
  window.__renderProbe={raf:0,programs:0,draws:{heart:0,nebula:0,other:0}};
  const original=requestAnimationFrame;
  window.requestAnimationFrame=callback=>original.call(window,time=>{window.__renderProbe.raf++;callback(time);});
  const proto=WebGL2RenderingContext.prototype;
  const create=proto.createProgram;
  proto.createProgram=function(...args){window.__renderProbe.programs++;return create.apply(this,args);};
  for(const name of ['drawArrays','drawElements']){
    const draw=proto[name];
    proto[name]=function(...args){
      const kind=this.canvas.closest?.('.three-mount')?'heart':this.canvas.closest?.('.nebula-backdrop')?'nebula':'other';
      window.__renderProbe.draws[kind]++;return draw.apply(this,args);
    };
  }
});
await page.goto('http://127.0.0.1:5173/');
await page.getByRole('button',{name:'Skip intro',exact:true}).click();
await page.getByRole('button',{name:'Rotate heart',exact:true}).waitFor({timeout:40000});
await page.waitForFunction(()=>document.querySelector('.three-mount canvas')?.dataset.materialMode==='original',{},{timeout:40000});
await page.waitForTimeout(1200);
const get=()=>page.evaluate(()=>structuredClone(window.__renderProbe));
const first=await get();
await page.waitForTimeout(1500);
const idle=await get();
const programsBefore=idle.programs;
await page.locator('.sky-motion-control').click();
await page.waitForTimeout(80);
await page.locator('.sky-motion-control').click();
await page.waitForTimeout(250);
const programsAfter=(await get()).programs;
const scroll=await page.evaluate(()=>new Promise(resolve=>{
  const samples=[];let last=0,start=0;
  const initial=structuredClone(window.__renderProbe);
  function tick(t){
    if(!start)start=t;
    if(last)samples.push(t-last);last=t;
    const elapsed=t-start;
    window.scrollTo({top:1800*Math.min(1,elapsed/3000),behavior:'instant'});
    if(elapsed<3000)requestAnimationFrame(tick);
    else{
      const sorted=[...samples].sort((a,b)=>a-b);
      const p=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];
      resolve({frames:samples.length,durationMs:elapsed,medianMs:p(.5),p95Ms:p(.95),over50ms:samples.filter(n=>n>50).length,draws:{heart:window.__renderProbe.draws.heart-initial.draws.heart,nebula:window.__renderProbe.draws.nebula-initial.draws.nebula}});
    }
  }
  requestAnimationFrame(tick);
}));
const result={label,environment:'Headless Chromium; sandbox software WebGL; 1440x1000; not a real-device FPS guarantee',idle1500ms:{rafCallbacks:idle.raf-first.raf,heartDraws:idle.draws.heart-first.draws.heart,nebulaDraws:idle.draws.nebula-first.draws.nebula},programsCreatedByPauseResume:programsAfter-programsBefore,scroll};
fs.writeFileSync(`checks/render-profile-${label}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
