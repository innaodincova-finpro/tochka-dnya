import {validateProposal, CATEGORIES, inferCategory} from './proposal.mjs';
export function currencyWord(text){
 const t=text.trim().toLowerCase().replace(/[.!]$/,'');
 return ({руб:'RUB',рубли:'RUB',рублей:'RUB',рублях:'RUB',рубля:'RUB',рубль:'RUB',rub:'RUB','₽':'RUB',тенге:'KZT',kzt:'KZT','₸':'KZT',манат:'AZN',манаты:'AZN',манатов:'AZN',azn:'AZN',доллары:'USD',долларов:'USD',usd:'USD',евро:'EUR',eur:'EUR'})[t]||null;
}
export function simpleAmount(text){
 const t=text.trim().toLowerCase().replace(/[.!]$/,'');
 if(/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(t))return Number(t.replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
 const words={один:1,одна:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,сто:100,двести:200,триста:300,четыреста:400,пятьсот:500};
 const m=/^(.*?)\s+тысяч(?:а|и)?$/.exec(t);if(m){const n=words[m[1]]||(/^\d+$/.test(m[1])?Number(m[1]):0);if(n)return n*1000;}
 return words[t]||null;
}
function calendarDate(text,today){
 const t=text.trim().toLowerCase().replace(/\.$/,'').replace(/ё/g,'е');
 let day,month,year;
 const named=/^(?:на\s+)?([1-9]|[12]\d|3[01])(?:-го)?\s+(январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йя]|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)(?:\s+(\d{4}))?$/u.exec(t);
 const numeric=/^(?:на\s+)?([1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])(?:[./](\d{4}))?$/u.exec(t);
 if(named){
  day=Number(named[1]);year=Number(named[3]||today.slice(0,4));
  month=['январ','феврал','март','апрел','ма','июн','июл','август','сентябр','октябр','ноябр','декабр'].findIndex(stem=>named[2].startsWith(stem))+1;
 }else if(numeric){day=Number(numeric[1]);month=Number(numeric[2]);year=Number(numeric[3]||today.slice(0,4));}
 else return null;
 const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const d=new Date(date+'T12:00:00Z');
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===date?date:null;
}
export function shortChange(text,pending,today){
 if(!pending)return null;
 const t=text.trim().toLowerCase().replace(/[.!]$/,'');
 if(['сегодня','вчера','позавчера','завтра','послезавтра'].includes(t)&&pending.kind!=='note'){
  const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+({сегодня:0,вчера:-1,позавчера:-2,завтра:1,послезавтра:2})[t]);
  return validateProposal({...pending,date:d.toISOString().slice(0,10)});
 }
 if(pending.kind!=='note'){
  const date=calendarDate(text,today);
  if(date)return validateProposal({...pending,date});
 }
 if(pending.kind==='event'&&/^(?:в\s+)?([01]?\d|2[0-3]):[0-5]\d$/.test(t)){const time=t.replace(/^в\s+/,'').padStart(5,'0');return validateProposal({...pending,time});}
 if(pending.kind==='expense'){
  const category=CATEGORIES.find(c=>c.toLowerCase()===t.replace(/^категория\s*:?\s*/,''));
  if(category)return validateProposal({...pending,category});
  const currency=currencyWord(t);if(currency)return validateProposal({...pending,currency});
  const amount=simpleAmount(t);if(amount)return validateProposal({...pending,amount});
 }
 return null;
}
export function proposalDefaults(p,{today,defaultCurrency,text,inheritedCurrency,inheritedDate}){
 const r={...p};
 const dateMention=hasDateMention(text);
 // Product rule: an omitted date means today. Apply it after every parser so
 // the result cannot depend on how the model happens to interpret the phrase.
 if((r.kind==='event'||r.kind==='expense')&&!dateMention&&!r.date)r.date=inheritedDate||today;
 if((r.kind==='event'||r.kind==='expense')&&!r.date&&/сегодня/iu.test(text))r.date=today;
 if(r.kind!=='expense')return validateProposal(r);
 if(!r.category){const category=inferCategory(r.title);if(category)r.category=category;}
 // An unresolved explicit date/currency must not silently become today's/default values.
 const currencyMention=/(руб|₽|тенге|₸|манат|доллар|евро|юан|фунт|лир|дирхам|[€$£¥]|\b(?:RUB|KZT|AZN|USD|EUR|CNY|GBP|TRY|AED)\b)/iu.test(text);
 if(!currencyMention){
  const c=inheritedCurrency||defaultCurrency;
  if(['RUB','KZT','AZN','USD','EUR'].includes(c))r.currency=c;else delete r.currency;
 }
 return validateProposal(r);
}
export const expenseDefaults=proposalDefaults;
export function hasDateMention(text){
 // Standalone calendar words; decimal amounts such as 350.50 are not dates.
 return /(?:^|[^\p{L}])(?:сегодня|вчера|завтра|позавчера|послезавтра|понедельник\p{L}*|вторник\p{L}*|сред[ау]|четверг\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскресень\p{L}*|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йяе]|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*|недел\p{L}*|месяц\p{L}*)(?=$|[^\p{L}])/iu.test(text)
  || /(?:^|\s)(?:\d{4}-\d{2}-\d{2}|(?:0?[1-9]|[12]\d|3[01])[./](?:0?[1-9]|1[0-2])(?:[./]\d{2,4})?)(?=$|\s|[,!])/u.test(text);
}
export function editHint(p){
 return p?.kind==='expense'?'Напишите, что изменить: сумму, дату, валюту или название покупки. Можно коротко: «пять тысяч», «вчера», «рубли».':p?.kind==='note'?'Напишите: «Измени текст на …».':'Напишите, что изменить: дату, время, название или адрес встречи. Например: «Завтра в 19:00».';
}
