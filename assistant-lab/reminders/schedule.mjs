// The bot and its event input currently use Moscow time. Independent of phone/VPN timezone.
export const ZONE='Europe/Moscow';
export const RECOVERY_WINDOW=6*60*60*1000;
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function candidates(payload,now=Date.now()){
 if(!Number.isFinite(now)||!Array.isArray(payload?.ev))return [];
 const result=[];
 const dates=new Set();
 for(let offset=0;offset<=RECOVERY_WINDOW+3600000;offset+=3600000)
  dates.add(new Date(now+3600000-offset+3*3600000).toISOString().slice(0,10));
 for(const e of payload.ev){
  if(!e||typeof e.id!=='string'||!e.id||!validDate(e.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time||''))continue;
  if((payload.del||[]).some(x=>x.id===e.id))continue;
  for(const occurrence of dates){
   if(occurrence<e.date)continue;
   const repeats=e.repeat==='year'?e.date.slice(5)===occurrence.slice(5):e.repeat==='month'?e.date.slice(8)===occurrence.slice(8):e.repeat==='week'?(Date.parse(occurrence)-Date.parse(e.date))%(7*86400000)===0:false;
   if(occurrence!==e.date&&!repeats)continue;
   if((payload.day?.[occurrence]?.done||[]).includes(e.id))continue;
   const at=Date.parse(occurrence+'T'+e.time+':00+03:00'),due=at-3600000;
   if(now<due||now>=due+RECOVERY_WINDOW)continue;
   result.push({event:e,occurrence,at,key:'event:'+e.id+':'+occurrence+':'+e.time+':1h:MSK'});
  }
 }
 return result;
}
export function reminderText(c,now=Date.now()){
 const minutes=Math.max(0,Math.ceil((c.at-now)/60000));
 const title=String(c.event.title||'Встреча').slice(0,1500);
 const place=String(c.event.address||'').trim().slice(0,300);
 const first=now>c.at?'Пропущенное напоминание — '+title:minutes===60?'Через час — '+title:'Через '+minutes+' мин. — '+title;
 return [first,c.occurrence.split('-').reverse().join('.')+', '+c.event.time+' (Москва)',...(place?[place]:[])].join('\n');
}
