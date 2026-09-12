const BASE='https://dcpthwmuiodrjepifzsd.supabase.co';
const KEY='sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt';
const $=id=>document.getElementById(id);
let token=null,draft=null,busy=false;
const messages={draft_changed:'Черновик изменился. Нажмите «Обновить», проверьте новый вариант и сохраните его.',draft_expired:'Срок черновика истёк. Отправьте новое сообщение боту и нажмите «Обновить».',disabled:'Помощник отключён. Включите его на странице настройки.',incomplete:'Сначала уточните недостающие сведения в Telegram.',owner_only:'Эта страница доступна только владельцу.',sign_in_required:'Сеанс завершён. Войдите снова.',invalid_request:'Не удалось проверить черновик. Нажмите «Обновить».',invalid_or_unavailable:'Не удалось связаться с сервером. Повторите попытку.',storage_unavailable:'Не удалось связаться с сервером. Повторите попытку.'};
function status(text){$('status').textContent=text;}
function display(p){return [({event:'Встреча',expense:'Расход',note:'Заметка'})[p.kind],p.title,p.date&&'Дата: '+p.date.split('-').reverse().join('.'),p.time&&'Время: '+p.time,p.place&&'Место: '+p.place,p.amount!==undefined&&'Сумма: '+p.amount+' '+(p.currency||'')].filter(x=>x!==false&&x!==undefined&&x!==null).join('\n');}
function controls(){for(const id of ['enter','refresh','logout'])$(id).disabled=busy;$('save').disabled=busy||!draft?.complete||draft.saved;}
function signout(){token=null;draft=null;$('workspace').hidden=true;$('login').hidden=false;$('records').replaceChildren();$('preview').textContent='';$('password').value='';}
async function api(action,extra={}){
 const r=await fetch(BASE+'/functions/v1/tochka-assistant-sandbox',{method:'POST',headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(20000),redirect:'error'});
 const d=await r.json();if(!r.ok){if(r.status===401){signout();throw Error(messages.sign_in_required);}throw Error(messages[d.error]||messages.invalid_or_unavailable);}return d;
}
async function reload(){
 const d=await api('status');draft=d.draft;
 if(draft)draft.saved=d.records.some(x=>Date.parse(x.source_version)===Date.parse(draft.version));
 $('preview').textContent=draft?display(draft.proposal)+(draft.saved?'\n\nУже сохранено в тестовую версию.':!draft.complete?'\n\nУточните недостающие сведения в Telegram.':''):'Свежего черновика нет. Отправьте боту встречу, расход или заметку. Черновик доступен для сохранения 30 минут.';
 $('records').replaceChildren();
 if(!d.records.length){const li=document.createElement('li');li.textContent='Пока нет сохранённых записей.';$('records').append(li);}
 for(const record of d.records){const li=document.createElement('li'),pre=document.createElement('pre');pre.textContent=display(record.proposal);li.append(pre);$('records').append(li);}
 controls();
}
async function run(fn){if(busy)return;busy=true;controls();status('Подождите…');try{await fn();}catch(e){status(e.message==='Failed to fetch'?'Нет связи с сервером. Повторите попытку.':e.message||messages.invalid_or_unavailable);}finally{busy=false;controls();}}
$('form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const password=$('password').value;$('password').value='';
 const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password}),signal:AbortSignal.timeout(20000),redirect:'error'});
 const d=await r.json();if(!r.ok||!d.access_token)throw Error('Не удалось войти. Проверьте почту и пароль «Точки дня».');
 token=d.access_token;try{await reload();}catch(e){signout();throw e;}
 $('login').hidden=true;$('workspace').hidden=false;status('Можно проверить и сохранить черновик.');
 });});
$('refresh').addEventListener('click',()=>run(async()=>{await reload();status('Список обновлён.');}));
$('save').addEventListener('click',()=>{if(!draft?.complete||draft.saved)return;const selected=structuredClone(draft);run(async()=>{
 const d=await api('confirm',{version:selected.version,proposal:selected.proposal});
 draft.saved=true;status(d.duplicate?'Этот черновик уже сохранён. Второй записи не создано.':'Сохранено в тестовую версию.');
 try{await reload();}catch{status('Запись сохранена. Обновить список пока не удалось — нажмите «Обновить».');}
 });});
$('logout').addEventListener('click',()=>{signout();status('Вы вышли.');controls();});
