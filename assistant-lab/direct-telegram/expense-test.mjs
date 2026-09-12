import assert from 'node:assert/strict';
import {normalizeModelProposal,validateProposal} from './proposal.mjs';
import {prepareDraft} from './deepseek.mjs';
import {card} from './conversation.mjs';
const raw={kind:'expense',title:'Продукты',date:'2026-09-12',amount:'5000',currency:'руб.',place:'Пятёрочка',time:''};
const p=normalizeModelProposal(raw);assert.equal(p.amount,5000);assert.equal(p.currency,'RUB');assert.ok(p.title.includes('Пятёрочка'));assert.equal(p.time,undefined);assert.ok(card(p,Date.now()).reply_markup.inline_keyboard[0][0].callback_data.startsWith('save:'));
assert.throws(()=>validateProposal(raw));
for(const bad of [{...raw,amount:'пять тысяч'},{...raw,date:'2026-02-30'},{...raw,amount:-10},{...raw,time:'10:00'},{...raw,unexpected:'data'}])assert.throws(()=>normalizeModelProposal(bad));
for(const text of ['Сегодня продукты Пятёрочка магазин 5000 руб.','Магазин Пятёрочка продукты сегодня 5000 руб.']){
 const r=await prepareDraft({text,apiKey:'fake',now:new Date('2026-09-12T19:55:00Z'),fetchImpl:async(u,o)=>{const b=JSON.parse(o.body);assert.ok(b.messages[0].content.includes('2026-09-12'));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});}});
 assert.equal(r.proposal.kind,'expense');assert.equal(r.needsClarification,false);
}
assert.deepEqual(normalizeModelProposal({kind:'note',title:'Идея',date:null}),{kind:'note',title:'Идея'});
assert.equal(normalizeModelProposal({kind:'expense',title:'Продукты',amount:5000}).currency,undefined);
console.log('PASS formatting normalization, expense pipeline with mocked provider, no invented fields, strict invalid data rejection');
