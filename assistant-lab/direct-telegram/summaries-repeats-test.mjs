import assert from 'node:assert/strict';
import {readIntent,readAnswer} from './read-queries.mjs';
import {prepareDraft} from './deepseek.mjs';
import {card} from './conversation.mjs';
const now=new Date('2026-09-13T07:00Z');
const payload={ev:[],notes:[],exp:[{id:'a',date:'2026-09-13',sum:0.1,cur:'RUB',cat:'Продукты'},{id:'b',date:'2026-09-07',sum:0.2,cur:'RUB',cat:'Продукты'},{id:'c',date:'2026-09-13',sum:900,cur:'KZT',cat:'Продукты'},{id:'d',date:'2026-09-06',sum:99,cur:'RUB'},{id:'e',date:'2026-09-13',sum:800,cur:'RUB'}],del:[{id:'e'}]};
const before=JSON.stringify(payload);
let a=readAnswer(readIntent('Сколько потратила на продукты за неделю?'),payload,now);
assert.match(a,/0,30 RUB/);assert.match(a,/900,00 KZT/);assert.match(a,/Операций: 3/);assert.ok(!a.includes('99,00'));
assert.match(readAnswer(readIntent('Расходы за вчера'),payload,now),/Расходов нет/);
assert.match(readAnswer(readIntent('Расходы за 2026-02-30 по 2026-03-02'),payload,now),/Проверьте даты/);
assert.match(readAnswer(readIntent('Расходы на неизвестное за месяц'),payload,now),/Не узнаю категорию/);
assert.equal(JSON.stringify(payload),before);
const fetchImpl=()=>{throw new Error('AI forbidden');};
const draft=await prepareDraft({text:'Каждого 10-го числа оплатить интернет',now,fetchImpl});
assert.equal(draft.proposal.date,'2026-10-10');assert.equal(draft.proposal.repeat,'month');
assert.equal(card(draft.proposal,1).reply_markup.inline_keyboard.length,1);
const timed=await prepareDraft({text:'в 9:00',pending:draft.proposal,now,fetchImpl});
assert.equal(timed.proposal.time,'09:00');assert.equal(timed.proposal.repeat,'month');
assert.equal(card(timed.proposal,2).reply_markup.inline_keyboard[0][0].text,'Сохранить');
const last=await prepareDraft({text:'Каждого 31 числа проверить счёт в 18:00',now:new Date('2026-02-01T10:00Z'),fetchImpl});
assert.equal(last.proposal.date,'2026-03-31');assert.match(card(last.proposal,3).text,/пропущен/);
console.log('PASS currency separation, cents, period edges, deleted rows, invalid dates, no data mutation, monthly next occurrence, clarification preserves repeat, confirmation required, short months');

for(const [text,date,repeat] of [
 ['Каждый понедельник зарядка в 09:00','2026-09-14','week'],
 ['Каждое воскресенье проверить план в 18:00','2026-09-13','week'],
 ['Каждый год 12.09 поздравить Ольгу в 09:00','2027-09-12','year'],
 ['Каждый год 29.02 проверить документы в 09:00','2028-02-29','year']
]){
 const r=await prepareDraft({text,now,fetchImpl});assert.equal(r.proposal.date,date);assert.equal(r.proposal.repeat,repeat);
 assert.match(card(r.proposal,1).text,/Повтор:/);
 if(date.endsWith('02-29'))assert.match(card(r.proposal,1).text,/високосные/);
}
for(const text of ['Каждый год 31.02 проверить счёт в 09:00','Каждый день зарядка в 09:00','Ежедневно кофе 500','Каждый понедельник зарядка в 25:00'])await assert.rejects(prepareDraft({text,now,fetchImpl}),/recurrence_format/);
const weekly=await prepareDraft({text:'Каждую пятницу уборка',now,fetchImpl});
const amended=await prepareDraft({text:'18:00',pending:weekly.proposal,now,fetchImpl});assert.equal(amended.proposal.repeat,'week');assert.equal(amended.proposal.date,'2026-09-18');
console.log('PASS weekly weekdays, annual rollover/leap date, invalid recurrence rejected without AI, weekly clarification preserves series');
