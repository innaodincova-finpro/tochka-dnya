import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProposal,formatProposal} from './proposal.mjs';
test('meeting preview is explicit and does not claim a write',()=>{
 const r=formatProposal({kind:'event',title:'Врач',date:'2026-09-14',time:'10:15',place:'Клиника'});
 assert.match(r.text,/14\.09\.2026/);assert.match(r.text,/10:15/);assert.match(r.text,/ничего не сохранено/);assert.equal(r.needsClarification,false);
});
test('missing date/time are requested, never inferred',()=>{
 const r=formatProposal({kind:'event',title:'Встреча'});assert.equal(r.needsClarification,true);assert.match(r.text,/Уточните дату, время/);
});
test('expense requires currency as well as amount and date',()=>{
 assert.match(formatProposal({kind:'expense',title:'Кофе',amount:250,date:'2026-09-12'}).text,/Уточните валюту/);
});
test('invalid dates, times and amounts rejected',()=>{
 for(const extra of [{date:'2026-02-30'},{time:'24:00'},{time:'7'}]) assert.throws(()=>validateProposal({kind:'event',title:'X',...extra}));
 for(const amount of [-1,0,NaN,Infinity,'250',1.001]) assert.throws(()=>validateProposal({kind:'expense',title:'X',amount}));
});
test('model cannot inject write/delete/owner fields',()=>{
 for(const field of ['owner','user_id','delete','tools','__proto__']) {
  const p=JSON.parse('{"kind":"note","title":"X","'+field+'":"x"}'); assert.throws(()=>validateProposal(p));
 }
});
test('type-specific fields, huge output and controls rejected',()=>{
 for(const p of [{kind:'note',title:'X',amount:1},{kind:'note',title:'x'.repeat(1501)},{kind:'note',title:'x\u0000'}]) assert.throws(()=>validateProposal(p));
});
test('multiline note remains intact and input is unchanged',()=>{
 const p={kind:'note',title:'Список\n1. Хлеб\n2. Молоко'};const before=JSON.stringify(p);
 assert.match(formatProposal(p).text,/Список\n1\. Хлеб\n2\. Молоко/);assert.equal(JSON.stringify(p),before);
});
