import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
import {shortChange,proposalDefaults,editHint,hasDateMention} from './defaults.mjs';
const now=new Date('2026-09-12T21:10:00Z'); // Moscow already September 13.
let calls=0;
const base={kind:'expense',title:'Пятёрочка',amount:5000};
async function run(text,raw=base,extras={}){return prepareDraft({text,apiKey:'fake',now,defaultCurrency:'KZT',fetchImpl:async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({mode:'create',intent:raw.kind,confidence:'high',proposal:raw})}}]});},...extras});}
let r=await run('Пятёрочка, пять тысяч');assert.equal(r.proposal.currency,'KZT');assert.equal(r.proposal.date,'2026-09-13');assert.equal(r.needsClarification,false);
r=await run('Пятёрочка 5000',{...base,currency:'RUB'});assert.equal(r.proposal.currency,'KZT');
r=await run('Пятёрочка вчера 5000 рублей',{...base,date:'2026-09-12',currency:'RUB'});assert.equal(r.proposal.currency,'RUB');assert.equal(r.proposal.date,'2026-09-12');
const pending=r.proposal;const before=calls;
r=await run('пять тысяч',base,{pending:{...pending,amount:400}});assert.equal(r.proposal.amount,5000);assert.equal(r.proposal.title,pending.title);assert.equal(r.proposal.currency,'RUB');
r=await run('вчера',base,{pending});assert.equal(r.proposal.date,'2026-09-12');
r=await run('рубли',base,{pending:{...pending,currency:'KZT'}});assert.equal(r.proposal.currency,'RUB');assert.equal(calls,before);
r=await run('Кофе 200',{kind:'expense',title:'Кофе',amount:200},{pending});assert.equal(r.proposal.currency,'KZT');assert.equal(r.proposal.title,'Кофе');
r=await run('Встреча с Анной',{kind:'event',title:'Встреча с Анной'});assert.equal(r.proposal.date,'2026-09-13');assert.equal(r.needsClarification,true);
r=await run('Встреча с Анной в 15:00',{kind:'event',title:'Встреча с Анной',time:'15:00'});assert.equal(r.proposal.date,'2026-09-13');assert.equal(r.needsClarification,false);
r=await run('Встреча с Анной завтра в 15:00',{kind:'event',title:'Встреча с Анной',date:'2026-09-14',time:'15:00'});assert.equal(r.proposal.date,'2026-09-14');
const pharmacy={kind:'event',title:'Зайти в аптеку',time:'19:00'};const beforeDateChange=calls;
r=await run('14 сентября',base,{pending:pharmacy});assert.deepEqual(r.proposal,{...pharmacy,date:'2026-09-14'});assert.equal(calls,beforeDateChange);
r=await run('29.02.2025',base,{pending:pharmacy});assert.notEqual(r.proposal.date,'2025-02-29');
r=await run('Идея отпуска',{kind:'note',title:'Идея отпуска'});assert.deepEqual(r.proposal,{kind:'note',title:'Идея отпуска'});
assert.equal(proposalDefaults(base,{today:'2026-09-13',defaultCurrency:'RUB',text:'Пятёрочка в пятницу 5000 евро'}).date,undefined);
assert.equal(proposalDefaults(base,{today:'2026-09-13',defaultCurrency:'RUB',text:'Пятёрочка 5000 евро'}).currency,undefined);
assert.equal(hasDateMention('Купить майонез 250'),false);
assert.equal(proposalDefaults({...base,title:'Майонез'},{today:'2026-09-13',defaultCurrency:'RUB',text:'Майонез 250'}).date,'2026-09-13');
assert.ok(!editHint(base).includes('адрес'));assert.ok(editHint({kind:'note'}).includes('текст'));
console.log('PASS default-today contract, explicit dates, mayonnaise boundary, currency preference/override, short replies, event/note behavior');
