(function(){
'use strict';
const prefix='tochka-owner-pilot-backup-v1:';
function status(text){const el=document.getElementById('pilot-status');if(el)el.textContent=text;}
window.pilotGate=async function(user,client,current){
 document.getElementById('pilot-backup').hidden=true;
 status('Проверяем доступ и сохраняем резервную копию…');
 try{
 const {data,error}=await client.auth.getSession();
 if(error||data?.session?.user?.id!==user.id||!current())throw Error('Сеанс изменился. Войдите заново.');
 const response=await fetch(SUPABASE_URL+'/functions/v1/tochka-assistant-calendar',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:'Bearer '+data.session.access_token,'content-type':'application/json'},body:JSON.stringify({action:'list'}),signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok)throw Error(response.status===403?'Эта проверка доступна только владельцу.':'Не удалось проверить доступ. Обновите страницу позже.');
 const row=await client.from('user_app_data').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
 if(row.error||!row.data?.payload)throw Error('Облачные данные не получены. Запуск остановлен.');
 if(!current())throw Error('Сеанс изменился. Войдите заново.');
 const backup={format:'tochka-owner-pilot-backup-v1',user_id:user.id,captured_at:new Date().toISOString(),updated_at:row.data.updated_at,payload:row.data.payload};
 const raw=JSON.stringify(backup),key=prefix+user.id;
 if(!localStorage.getItem(key+':first'))localStorage.setItem(key+':first',raw);
 localStorage.setItem(key+':latest',raw);
 if(localStorage.getItem(key+':latest')!==raw)throw Error('Не удалось проверить резервную копию.');
 const first=JSON.parse(localStorage.getItem(key+':first'));
 if(first.user_id!==user.id||!first.payload)throw Error('Резервная копия повреждена.');
 if(!current())throw Error('Сеанс изменился. Войдите заново.');
 status('Копия облачных данных сохранена на этом устройстве. Подключаем синхронизацию…');
 document.getElementById('pilot-backup').hidden=false;
 document.getElementById('pilot-backup').onclick=()=>{
 if(!current())return;
 const url=URL.createObjectURL(new Blob([localStorage.getItem(key+':first')],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='tochka-before-assistant.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 }catch(e){if(!current())throw e;status((e?.name==='QuotaExceededError'?'Недостаточно места для резервной копии.':e.message||'Не удалось создать резервную копию.')+' Синхронизация не запущена.');throw e;}
};
function syncStatus(state,error){
 if(state==='synced')status('Копия сохранена. Облако подключено — можно добавлять встречу помощника.');
 if(state==='error'){
  const known=['Некорректная структура копии','Запись без корректной даты: exp','Запись без корректной даты: inc','Запись без корректной даты: ev','Запись без корректной даты: notes','Некорректный или повторный номер записи','Некорректная сумма','Некорректное событие','Некорректная заметка','Некорректные отметки удаления','Некорректная история добавлений помощника','Некорректные настройки','Некорректные отметки календаря'];
  let detail=known.includes(error)?error:'Не удалось завершить подключение к облаку';
  if(/row-level security|permission denied/i.test(error||''))detail='Сервер отклонил доступ к данным';
  if(/failed to fetch|network/i.test(error||''))detail='Нет связи с сервером';
  status('Подключение остановлено: '+detail+'. Пришлите снимок этого сообщения. Пока не добавляйте записи.');
 }
}
document.addEventListener('DOMContentLoaded',()=>{
 const original=window.setCloudState;
 if(typeof original!=='function')return;
 window.setCloudState=function(state,error){original(state,error);syncStatus(state,error);};
 syncStatus(cloudState,cloudError);
});
})();
