const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const themes=['light','dark','berry','graphite','blue','forest'];
const base=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
function open(theme,saved){return new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/index.html?initial-icon-theme='+theme,beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});if(saved)w.localStorage.setItem('tochka-dnya-v3',saved);}});}
for(const theme of themes){
 const d=open(theme);try{
  const w=d.window;assert.equal(w.document.documentElement.dataset.theme,theme,'новый запуск получает выбранную тему');
  w.eval("S.settings.onboarded=1;renderAll();goScreen('s-more');foldOpen['more-set']=true;renderMore();");
  const preview=w.document.querySelector('.app-icon-preview img');assert(preview,'есть предпросмотр ярлыка');
  assert.equal(preview.getAttribute('src'),'theme-icons/'+theme+'-180.png');
  assert.equal(w.document.querySelector('.app-icon-preview a').getAttribute('href'),'install-icon-'+theme+'.html');
  assert.equal(w.document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),preview.getAttribute('src'));
  assert.equal(w.document.querySelector('link[rel="manifest"]').getAttribute('href'),'manifest-icon-'+theme+'.webmanifest');
 }finally{d.window.close();}
 const m=JSON.parse(fs.readFileSync('manifest-icon-'+theme+'.webmanifest','utf8'));
 assert.equal(m.id,base.id,'идентичность приложения не меняется');assert.equal(m.scope,base.scope);
 assert.equal(m.start_url,'./index.html?initial-icon-theme='+theme);
 const page=fs.readFileSync('install-icon-'+theme+'.html','utf8');
 assert(page.includes('theme-icons/'+theme+'-180.png'));assert(page.includes('manifest-icon-'+theme+'.webmanifest'));
 assert(page.includes('Safari')&&page.includes('На экран Домой')&&page.includes('Chrome'));
 assert(page.includes('Не удаляйте старый ярлык'),'пользователь сохраняет доступ к прежним записям');
 const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const installed of [false,true]){let destination=null;vm.runInNewContext(script,{navigator:{standalone:installed},window:{matchMedia:()=>({matches:false})},location:{replace:x=>destination=x}});assert.equal(destination,installed?'./index.html?initial-icon-theme='+theme:null,'новый ярлык открывает приложение; браузер показывает инструкцию');}
 for(const size of [180,192,512]){const png=fs.readFileSync('theme-icons/'+theme+'-'+size+'.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
}
const stored={settings:{onboarded:1,name:'Инна',theme:'forest'},notes:[{id:'keep',date:'2026-10-14',kind:'note',text:'Сохранить записи'}]};
const existing=open('graphite',JSON.stringify(stored));try{assert.equal(existing.window.document.documentElement.dataset.theme,'forest','ссылка не сбрасывает тему действующего пользователя');assert.equal(existing.window.eval('S.notes[0].text'),'Сохранить записи');}finally{existing.window.close();}
(async()=>{
 const handlers={},puts=[],matches=[];
 const context={URL,console,self:{location:{origin:'https://test.invalid'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>({put:(key)=>puts.push(key)}),match:async key=>{matches.push(key);return 'cached';}},fetch:async()=>({ok:true,clone:()=>({})})};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
 for(const theme of themes){
  const event={request:{method:'GET',mode:'navigate',url:'https://test.invalid/install-icon-'+theme+'.html'},respondWith(p){this.response=p;}};
  handlers.fetch(event);await event.response;assert.equal(puts.at(-1),'./install-icon-'+theme+'.html','страница установки не подменяет офлайн-копию приложения');
  context.fetch=async()=>{throw new Error('offline');};handlers.fetch(event);await event.response;assert.equal(matches.at(-1),'./install-icon-'+theme+'.html');context.fetch=async()=>({ok:true,clone:()=>({})});
 }
 console.log('PASS: six themed icons and install pages; stable app identity; existing records retained; offline app cache protected');
})().catch(e=>{console.error(e);process.exitCode=1;});
