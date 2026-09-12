import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
import {shortChange,expenseDefaults,editHint} from './defaults.mjs';
const now=new Date('2026-09-12T21:10:00Z'); // Moscow already September 13.
let calls=0;
const base={kind:'expense',title:'Пятёрочка',amount:5000};
async function run(text,raw=base,extras={}){return prepareDraft({text,apiKey:'fake',now,defaultCurrency:'KZT',fetchImpl:async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});},...extras});}
let r=await run('Пятёрочка, пять тысяч');assert.equal(r.proposal.currency,'KZT');assert.equal(r.proposal.date,'2026-09-13');assert.equal(r.needsClarification,false);
r=await run('Пятёрочка 5000',{...base,currency:'RUB'});assert.equal(r.proposal.currency,'KZT');
r=await run('Пятёрочка вчера 5000 рублей',{...base,date:'2026-09-12',currency:'RUB'});assert.equal(r.proposal.currency,'RUB');assert.equal(r.proposal.date,'2026-09-12');
const pending=r.proposal;const before=calls;
r=await run('пять тысяч',base,{pending:{...pending,amount:400}});assert.equal(r.proposal.amount,5000);assert.equal(r.proposal.title,pending.title);assert.equal(r.proposal.currency,'RUB');
r=await run('вчера',base,{pending});assert.equal(r.proposal.date,'2026-09-12');
r=await run('рубли',base,{pending:{...pending,currency:'KZT'}});assert.equal(r.proposal.currency,'RUB');assert.equal(calls,before);
r=await run('Кофе 200',{kind:'expense',title:'Кофе',amount:200},{pending});assert.equal(r.proposal.currency,'KZT');assert.equal(r.proposal.title,'Кофе');
r=await run('Встреча с Анной',{kind:'event',title:'Встреча с Анной'});assert.equal(r.proposal.date,undefined);assert.equal(r.needsClarification,true);
r=await run('Идея отпуска',{kind:'note',title:'Идея отпуска'});assert.deepEqual(r.proposal,{kind:'note',title:'Идея отпуска'});
assert.equal(expenseDefaults(base,{today:'2026-09-13',defaultCurrency:'RUB',text:'Пятёрочка в пятницу 5000 евро'}).date,undefined);
assert.equal(expenseDefaults(base,{today:'2026-09-13',defaultCurrency:'RUB',text:'Пятёрочка 5000 евро'}).currency,undefined);
assert.ok(!editHint(base).includes('адрес'));assert.ok(editHint({kind:'note'}).includes('текст'));
console.log('PASS currency preference/override, Moscow date, short replies preserve record, new expense isolation, event/note behavior, unresolved explicit values');
