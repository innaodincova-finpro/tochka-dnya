import {validateProposal} from './proposal.mjs';
export function card(raw,version){
 const p=validateProposal(raw),missing=({event:['date','time'],expense:['date','amount','currency'],note:[]})[p.kind].filter(k=>p[k]===undefined);
 const fields={date:'дату',time:'время',amount:'сумму',currency:'валюту'};
 const lines=[p.title];
 if(p.date)lines.push(p.date.split('-').reverse().join('.'));
 if(p.time)lines.push(p.time+' (московское время)');
 if(p.place)lines.push(p.place);
 if(p.amount)lines.push(p.amount+' '+(p.currency||''));
 const unsupported=p.kind==='expense'&&p.currency&&!['RUB','AZN','KZT'].includes(p.currency);
 lines.push(missing.length?'Уточните '+missing.map(x=>fields[x]).join(' и ')+'.':unsupported?'Пока поддерживаются рубли, тенге и манаты. Уточните валюту.':'Сохранить в «Точку дня»?');
 const keyboard=[];
 if(!missing.length&&!unsupported)keyboard.push([{text:'Сохранить',callback_data:'save:'+version}]);
 keyboard.push([{text:'Изменить',callback_data:'edit:'+version},{text:'Отмена',callback_data:'cancel:'+version}]);
 return {text:lines.join('\n'),reply_markup:{inline_keyboard:keyboard}};
}
export const savedCard=kind=>({text:({event:'Встреча сохранена в «План». Напоминания — по вашим настройкам.',expense:'Расход сохранён в «Финансы».',note:'Заметка сохранена в «Заметки».'})[kind]||'Уже сохранено в «Точку дня».',reply_markup:{inline_keyboard:[[{text:'Открыть «Точку дня»',url:'https://innaodincova-finpro.github.io/tochka-dnya/'}]]}});
