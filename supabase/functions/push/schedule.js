export function localParts(ms, zone) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,second:p.second};
}
export function zonedTime(date,time,zone){
 const target=Date.parse(date+'T'+time+':00Z');let ms=target;
 for(let i=0;i<4;i++){const p=localParts(ms,zone);const seen=Date.parse(p.date+'T'+p.time+':'+p.second+'Z');if(seen===target)return ms;ms+=target-seen;}
 const p=localParts(ms,zone);return p.date===date&&p.time===time?ms:NaN;
}
export function occurs(e,date){
 if(!e.date||date<e.date)return false;
 if(e.date===date)return true;
 if(e.repeat==='year')return e.date.slice(5)===date.slice(5);
 if(e.repeat==='month')return e.date.slice(8)===date.slice(8);
 if(e.repeat==='week')return (Date.parse(date+'T12:00Z')-Date.parse(e.date+'T12:00Z'))%(7*86400000)===0;
 return false;
}
export function dueEvents(payload,zone,now){
 const out=[];
 const hours=payload?.settings?.reminderMode==='three-and-hour'?[3,1]:[1];
 for(const hoursBefore of hours){
 const offset=hoursBefore*3600000;
 const dates=new Set([localParts(now+offset,zone).date,localParts(now+offset-300000,zone).date]);
 for(const e of payload?.ev||[]){
  if(!e.id||!/^\d{2}:\d{2}$/.test(e.time||''))continue;
  for(const date of dates){
   if(!occurs(e,date)||(payload?.day?.[date]?.done||[]).includes(e.id))continue;
   const at=zonedTime(date,e.time,zone),due=at-offset;
   // Keep the existing one-hour key so upgrading cannot repeat an accepted reminder.
   const key='event:'+e.id+':'+date+':'+e.time+(hoursBefore===1?'':':3h');
   if(now>=due&&now<due+300000)out.push({key,title:String(e.title||'Встреча').slice(0,100),body:(hoursBefore===3?'Через 3 часа, в ':'Через час, в ')+e.time,at});
  }
 }
 }
 return out;
}
export function validSubscription(s){
 try{const u=new URL(s.endpoint);const host=u.hostname;
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&s.endpoint.length<2048&&
   (host==='web.push.apple.com'||host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.notify.windows.com'))&&
   /^[A-Za-z0-9_-]{87}=?$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys?.auth||'');
 }catch{return false;}
}
