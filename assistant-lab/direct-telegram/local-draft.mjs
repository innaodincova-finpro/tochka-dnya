import {simpleAmount, currencyWord, hasDateMention} from './defaults.mjs';
import {validateProposal} from './proposal.mjs';

// Conservative fast path. Ambiguous requests continue through the existing model.
export function localDraft(text,today){
 const t=text.trim();
 const recurring=recurringDraft(t,today);if(recurring)return recurring;
 const note=/^(?:заметка\s*:|запиши\s+(?:идею|заметку)\s*:?)\s*(.+)$/isu.exec(t);
 if(note)return validateProposal({kind:'note',title:note[1].trim()});
 if(/(?:кажд(?:ый|ую|ое|ого|ые)|ежедневно|еженедельно|ежемесячно|ежегодно|по будням|по выходным)/iu.test(t))return null;
 if(hasDateMention(t)||/\d\s*[:/]\s*\d|(?:встреч|врач|стоматолог|напомни|перенеси|измени|исправь|доход|зарплат|получил|вернул|возврат|план|задач|замет|иде[яю])/iu.test(t))return null;
 // Require a letter-only description followed by one unambiguous positive amount.
 for(const separator of t.matchAll(/[,\s]+/gu)){
 const title=t.slice(0,separator.index).trim();
 if(!/^[\p{L}][\p{L} .«»()\-]*$/u.test(title))continue;
 let amountText=t.slice(separator.index+separator[0].length).replace(/[.!]$/,''),currency;
 const tail=/^(.*?)\s+(\S+)$/u.exec(amountText);
 if(tail&&currencyWord(tail[2])){currency=currencyWord(tail[2]);amountText=tail[1];}
 const amount=simpleAmount(amountText);
 if(!amount||amount>1e9||Math.abs(amount*100-Math.round(amount*100))>0.00001)continue;
 // Do not reinterpret a second operation or a range as a single purchase.
 if(/(?:^|\s)(?:и|или|от|до|за|на)(?:\s|$)/iu.test(title))return null;
 return validateProposal({kind:'expense',title,amount,...(currency?{currency}:{})});
 }
 return null;
}

export function recurringDraft(text,today){
 const t=text.trim().replace(/ё/g,'е');
 const month=/^(?:напомни\s+)?каждого\s+([1-9]|[12]\d|3[01])(?:-го)?\s+числа\s+(.+)$/iu.exec(t);
 const week=/^(?:напомни\s+)?(?:каждый|каждую|каждое)\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)\s+(.+)$/iu.exec(t);
 const year=/^(?:напомни\s+)?каждый\s+год\s+(0?[1-9]|[12]\d|3[01])[.](0?[1-9]|1[0-2])\s+(.+)$/iu.exec(t);
 if(!month&&!week&&!year)return null;
 const rest=month?month[2]:week?week[2]:year[3];
 const time=/\s+в\s+([01]?\d|2[0-3]):([0-5]\d)[.!]?$/u.exec(rest);
 const title=(time?rest.slice(0,time.index):rest).trim();
 if(!title||/\b\d{1,2}:\d{2}\b/u.test(title))throw new Error('recurrence_format');
 const start=new Date(today+'T12:00Z');let date;
 if(week){
  const weekdays={понедельник:1,вторник:2,среду:3,четверг:4,пятницу:5,субботу:6,воскресенье:0};
  start.setUTCDate(start.getUTCDate()+(weekdays[week[1].toLowerCase()]-start.getUTCDay()+7)%7);
  date=start.toISOString().slice(0,10);
 }else{
  for(let i=0;i<(month?24:9);i++){
   const day=Number(month?month[1]:year[1]),mn=month?start.getUTCMonth()+i:Number(year[2])-1;
   const d=new Date(Date.UTC(start.getUTCFullYear()+(year?i:0),mn,day,12));
   if(d.getUTCDate()===day&&(!year||d.getUTCMonth()===mn)&&d.toISOString().slice(0,10)>=today){date=d.toISOString().slice(0,10);break;}
  }
 }
 if(!date)throw new Error('recurrence_format');
 return validateProposal({kind:'event',title,date,repeat:month?'month':week?'week':'year',...(time?{time:time[1].padStart(2,'0')+':'+time[2]}:{})});
}
