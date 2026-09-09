const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/',pretendToBeVisual:true,beforeParse(w){w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});}});
const w=dom.window;const run=s=>w.eval(s);let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('OK '+m);};
async function main(){
 await new Promise(r=>setTimeout(r,180));
 run(`clearTimeout(cloudTimer);S=blank();S.settings.onboarded=1;S.settings.cloudOwner='A';cloudUser={id:'A'};cloudReady=true;cloudBase=cloneState(S);globalThis.db={payload:cloneState(S),updated_at:'2026-01-01T00:00:00Z'};globalThis.writes=0;globalThis.readFail=false;globalThis.race=false;
 const persist=(row,mode)=>{const filters={};return {eq(k,v){filters[k]=v;return this;},async select(){
  if(globalThis.delayWrite)await new Promise(resolve=>{globalThis.finishWrite=resolve;});
  if(globalThis.race){globalThis.race=false;db.payload.notes.push({id:'race',text:'с другого устройства',date:today()});db.updated_at='2026-02-01T00:00:00Z';}
  if(mode==='insert'&&db)return {error:{code:'23505'}};
  if(mode==='update'&&filters.updated_at!==db.updated_at)return {data:[]};
  writes++;db={payload:cloneState(row.payload),updated_at:row.updated_at};return {data:[{updated_at:row.updated_at}]};}};};
 cloudClient={rpc:async()=>({data:true}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>readFail?{error:new Error('сбой чтения')}:{data:cloneState(db)}})}),update:r=>persist(r,'update'),insert:r=>persist(r,'insert')})};`);
 run(`db.payload.notes.push({id:'remote',text:'Облако',date:today()});S.notes.push({id:'local',text:'Телефон',date:today()});`);
 await run('pushCloud()');
 ok(run("db.payload.notes.length===2&&S.notes.length===2&&cloudState==='synced'"),'новые записи двух устройств сохраняются вместе');
 run(`S.notes.push({id:'next',text:'ещё',date:today()});race=true;`);await run('pushCloud()');
 ok(run("db.payload.notes.some(n=>n.id==='race')&&db.payload.notes.some(n=>n.id==='next')"),'изменение между чтением и записью вызывает повтор без потери данных');
 run(`S.notes.find(n=>n.id==='local').text='правка телефона';db.payload.notes.find(n=>n.id==='local').text='правка облака';globalThis.beforeWrites=writes;`);await run('pushCloud()');
 ok(run("writes===beforeWrites&&!!cloudConflict&&cloudState==='error'"),'одновременная правка одного поля останавливает запись');
 run("resolveCloudConflict('remote');clearTimeout(cloudTimer);");await run('pushCloud()');
 ok(run("db.payload.notes.find(n=>n.id==='local').text==='правка облака'&&!cloudConflict"),'выбор облачной версии завершает конфликт');
 ok(run("Object.keys(localStorage).some(k=>k.includes(':conflict:A:'))"),'обе версии сохранены перед разрешением конфликта');
 run(`db.payload.notes.push({id:'remote-during',text:'новое облачное',date:today()});S.notes.push({id:'pending',text:'перед запросом',date:today()});delayWrite=true;globalThis.promise=pushCloud();`);
 await new Promise(r=>setTimeout(r,10));run(`S.notes.push({id:'during',text:'во время запроса',date:today()});delayWrite=false;finishWrite();`);await run('promise');run('clearTimeout(cloudTimer)');await run('pushCloud()');
 ok(run("db.payload.notes.some(n=>n.id==='during')&&db.payload.notes.some(n=>n.id==='remote-during')"),'правка во время отправки не заменяется старым снимком');
 run(`globalThis.b=cloneState(S);globalThis.l=cloneState(S);globalThis.r=cloneState(S);l.notes=l.notes.filter(n=>n.id!=='local');l.del.push({id:'local',at:new Date().toISOString()});r.notes.find(n=>n.id==='local').text='правка после удаления';`);
 ok(run("mergeThree(b,l,r,'remote').notes.some(n=>n.id==='local')"),'выбор правки вместо одновременного удаления восстанавливает запись');
 run(`readFail=true;globalThis.beforeWrites=writes;`);await run("connectCloudUser({id:'B'})");await run('pushCloud()');
 ok(run("writes===beforeWrites&&!cloudReady&&S.settings.cloudOwner==='A'"),'сбой входного чтения Б не отправляет записи А');
 run(`readFail=false;db={payload:blank(),updated_at:'2026-03-01T00:00:00Z'};`);await run("connectCloudUser({id:'B'})");
 ok(run("S.settings.cloudOwner==='B'&&db.payload.notes.length===0&&JSON.parse(localStorage.getItem(KEY+':account:A')).notes.length>0"),'успешная смена аккаунта изолирует записи и сохраняет предыдущие');
 run('clearTimeout(cloudTimer);delete S.settings.feedKey;');
 run("openSheet('feed')");
 ok(run("!S.settings.feedKey&&!document.querySelector('#sheet-in a[href^=\"webcal:\"]')"),'открытие формы не создаёт неподтверждённую ссылку');
 run('readFail=true');await run('prepareFeed()');
 ok(run('!feedReady()'),'ошибка сохранения не разрешает подписку');
 run('readFail=false;clearTimeout(cloudTimer)');await run('prepareFeed()');
 ok(run('feedReady()&&db.payload.settings.feedKey===S.settings.feedKey'),'подписка доступна после подтверждения облаком');
 run('resetFeed()');
 ok(run('!feedReady()'),'смена ссылки требует нового сохранения');
 run('clearTimeout(cloudTimer);cloudReady=false;cloudUser=null;');
 for(const raw of [{exp:[{id:'bad',sum:100}]},{exp:[{id:'bad',sum:100,date:'2026-02-31'}]},{notes:[{id:'bad',date:'2026-09-07',items:[null]}]}]){
  let failed=false;try{w.normalize(raw);}catch{failed=true;}ok(failed,'некорректная запись отвергается до замены данных');
 }
 run(`S=blank();S.settings.onboarded=1;S.settings.hi=1;S.savedAt='2026-01-01T00:00:00Z';renderAll();saveQuiet();`);
 const snapshot=run('JSON.stringify(S)');
 for(let i=0;i<20;i++)w.dispatchEvent(new w.StorageEvent('storage',{key:run('KEY'),newValue:snapshot}));
 ok(run('JSON.stringify(S)')===snapshot,'повторные события вкладок не изменяют время и содержимое');
 run(`globalThis.password=null;cloudClient={auth:{updateUser:async data=>{password=data.password;return {};}}};openSheet('cloudPassword');document.getElementById('new-password').value='new-secure-password';document.getElementById('repeat-password').value='mismatch';`);await run('cloudSetPassword()');
 ok(run('password===null'),'разные пароли не отправляются');
 run("document.getElementById('repeat-password').value='new-secure-password'");await run('cloudSetPassword()');
 ok(run("password==='new-secure-password'"),'новый пароль отправляется и форма закрывается');
 run(`localStorage.setItem(KEY,'{"exp":[{"id":"broken"}]}');load();saveQuiet();save();`);
 ok(run("loadBlocked&&localStorage.getItem(KEY)==='{"+'"exp":[{"id":"broken"}]}'+"'"),'повреждённая локальная база остаётся в исходном виде');
 ok(fs.readFileSync('supabase/functions/kalendar/index.ts','utf8').includes('TRIGGER:-PT15H'),'напоминание без времени назначено за 15 часов');
 console.log('Регрессии: '+checks+' проверок пройдено.');
}
main().then(()=>dom.window.close()).catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

