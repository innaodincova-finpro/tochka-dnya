const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const root=__dirname;
let revision=1;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  if(file.includes('..')){res.writeHead(400);return res.end();}
  const full=path.join(root,file);
  if(!fs.existsSync(full)||!fs.statSync(full).isFile()){res.writeHead(404);return res.end();}
  let body=fs.readFileSync(full);
  if(file==='sw.js'&&revision===2)body=Buffer.from(body.toString().replace(/const CACHE = '[^']+'/,"const CACHE = 'tochka-dnya-offline-acceptance-v2'"));
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  res.end(body);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  let page=await context.newPage();
  try{
    await page.goto(origin+'/',{waitUntil:'networkidle'});
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload({waitUntil:'networkidle'});
    assert(await page.evaluate(()=>!!navigator.serviceWorker.controller),'page must be controlled by the service worker');

    await page.getByPlaceholder('Например: Анастасия').fill('Офлайн-тест');
    await page.getByRole('button',{name:'Начать'}).click();
    await page.getByRole('tab',{name:'Заметки'}).click();
    await page.getByRole('tab',{name:'Заметки'}).nth(1).click();
    await page.getByText('Новая заметка',{exact:true}).click();

    await context.setOffline(true);
    assert.equal(await page.evaluate(()=>navigator.onLine),false);
    await page.getByPlaceholder('Например: рецепт, адрес, мысль').fill('Запись создана без интернета');
    await page.getByRole('button',{name:'Сохранить'}).click();
    assert.equal(await page.locator('body').getByText('Запись создана без интернета',{exact:true}).count(),1);

    await page.close();
    page=await context.newPage();
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('tab',{name:'Заметки'}).click();
    await page.getByRole('tab',{name:'Заметки'}).nth(1).click();
    assert.equal(await page.locator('body').getByText('Запись создана без интернета',{exact:true}).count(),1);

    await context.setOffline(false);
    revision=2;
    await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await page.waitForTimeout(1000);
    const reg=await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>({waiting:!!r.waiting,active:r.active&&r.active.state})));
    if(reg.waiting)await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.waiting.postMessage({type:'SKIP_WAITING'})));
    await page.reload({waitUntil:'networkidle'});
    await page.waitForTimeout(500);
    const keys=await page.evaluate(()=>caches.keys());
    assert(keys.includes('tochka-dnya-offline-acceptance-v2'),'new cache must activate');
    assert(!keys.some(k=>k.startsWith('tochka-dnya-')&&k!=='tochka-dnya-offline-acceptance-v2'&&k!=='tochka-dnya-fonts-v1'),'old app cache must be removed');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tochka-dnya-v3')).notes.some(n=>n.text==='Запись создана без интернета')),true);

    console.log('PASS real Chromium: cached launch offline, offline note, reopen, network recovery, cache upgrade, data retained');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
