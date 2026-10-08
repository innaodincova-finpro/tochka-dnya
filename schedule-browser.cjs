const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=__dirname,mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(()=>{if(!localStorage.getItem('tochka-dnya-v3'))localStorage.setItem('tochka-dnya-v3',JSON.stringify({settings:{onboarded:1,hi:1},ev:[{id:'private-1',title:'Личная встреча',date:'2026-10-08',time:'09:00'}],notes:[],exp:[],inc:[],day:{},del:[]}));});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/');await page.locator('#tab-cal').click();await page.getByRole('tab',{name:'Учебный',exact:true}).click();await page.getByRole('button',{name:'Загрузить расписание',exact:true}).click();
  await page.locator('#schedule-name').fill('Проверка расписания');await page.locator('#schedule-text').fill('Практическое занятие по дисциплине Русский язык и культура речи  08.10.2026 14:20 — 15:40');await page.getByRole('button',{name:'Проверить',exact:true}).click();await page.getByText('Новых: 1',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>S.ev.length),1);await page.screenshot({path:'schedule-preview-mobile.png'});
  await page.getByRole('button',{name:'Сохранить выбранное',exact:true}).click();await page.getByRole('heading',{name:'Добавлено на устройстве'}).waitFor();assert.equal(await page.evaluate(()=>S.ev.length),2);await page.getByRole('button',{name:'Открыть календарь'}).click();
  await page.evaluate(()=>openDay('2026-10-08'));await page.getByText('14:20–15:40',{exact:true}).waitFor();await page.screenshot({path:'schedule-day-mobile.png'});await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Загрузить расписание',exact:true}).click();await page.locator('#schedule-name').fill('Проверка расписания');await page.locator('#schedule-text').fill('Практическое занятие по дисциплине Русский язык и культура речи  08.10.2026 14:20 — 15:40');await page.getByRole('button',{name:'Проверить',exact:true}).click();await page.getByText('Уже есть: 1',{exact:false}).waitFor();await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await page.evaluate(()=>S.ev.length),2);
  await page.getByRole('tab',{name:'Личный',exact:true}).click();assert.equal(await page.evaluate(()=>calendarEntries('2026-10-08').length),1);await page.getByRole('tab',{name:'Все',exact:true}).click();assert.equal(await page.evaluate(()=>calendarEntries('2026-10-08').length),2);
  // On reload all modules are in the offline shell; local data remains intact.
  await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#tab-cal').click();await page.getByRole('button',{name:'Загрузить расписание',exact:true}).click();await page.locator('#schedule-name').waitFor();assert.equal(await page.evaluate(()=>S.ev.length),2);assert.deepEqual(errors,[]);
  console.log('PASS: real mobile Chromium import, atomic save, complete times, repeat/cancel, separate/all calendars and offline reload.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
