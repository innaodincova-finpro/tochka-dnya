import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
import {inferCategory,validateProposal} from './proposal.mjs';
import {card} from './conversation.mjs';
const opts={now:new Date('2026-09-13T05:00:00Z'),defaultCurrency:'RUB',fetchImpl:()=>{throw Error('Unexpected network');}};
for(const text of ['Пятёрочка 5000','Пятерочка, пять тысяч','Продукты Магнит 1298']){
 const {proposal}=await prepareDraft({...opts,text});assert.equal(proposal.category,'Продукты');assert.match(card(proposal,1).text,/Категория: Продукты/);assert.equal(card(proposal,1).reply_markup.inline_keyboard[0][0].callback_data,'save:1');
}
const {proposal}=await prepareDraft({...opts,text:'Покупка 5000'});
assert.equal(proposal.category,undefined);assert.match(card(proposal,1).text,/Уточните категорию/);assert(!JSON.stringify(card(proposal,1)).includes('save:'));
const changed=await prepareDraft({...opts,text:'Одежда',pending:proposal});assert.equal(changed.proposal.category,'Одежда');assert.equal(changed.proposal.amount,5000);
assert.equal(inferCategory('Кофе и продукты'),undefined);assert.equal(inferCategory('Ozon'),undefined);
assert.throws(()=>validateProposal({...proposal,category:'Несуществующая'}));
console.log('PASS automatic category, preview, ambiguity, explicit category reply, no AI, invalid category rejection');
