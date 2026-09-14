export async function reminderCommand(text,s,uid,chat){
 if(typeof text!=='string')return false;
 const t=text.trim().toLowerCase();
 const mode=({'/reminders':'status','напоминания':'status','/reminders_on':'on','включи напоминания':'on','/reminders_off':'off','отключи напоминания':'off'})[t];
 if(!mode)return false;
 const path='tochka_telegram_reminder_config?id=eq.1&owner_id=eq.'+encodeURIComponent(uid);
 const row=(await s.db(path+'&select=enabled'))[0];
 if(!row){await s.tg('sendMessage',{chat_id:chat,text:'Напоминания в Telegram пока не настроены для этого аккаунта.'});return true;}
 let enabled=row.enabled;
 if(mode!=='status'){
  enabled=mode==='on';
  const changed=await s.db(path,'PATCH',{enabled});
  if(!changed.length)throw new Error('reminder_state_changed');
 }
 await s.tg('sendMessage',{chat_id:chat,text:enabled?'Напоминания в Telegram включены: за час до встреч, по московскому времени. Приложение можно закрыть. Отключить: «Отключи напоминания».':'Напоминания в Telegram отключены. Включить: «Включи напоминания».'});
 return true;
}
