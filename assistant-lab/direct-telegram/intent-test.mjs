import assert from 'node:assert/strict';
import {normalizeIntentEnvelope,clarificationResult} from './intent.mjs';
import {prepareDraft} from './deepseek.mjs';
import {SYSTEM_PROMPT} from './proposal.mjs';
import {SEMANTIC_CORPUS} from './semantic-corpus.mjs';

const event={kind:'event',title:'Зайти в аптеку',time:'19:00'};
assert.deepEqual(normalizeIntentEnvelope({mode:'create',intent:'event',confidence:'high',proposal:event}).proposal,event);
assert.throws(()=>normalizeIntentEnvelope({mode:'create',intent:'expense',confidence:'high',proposal:event}));
assert.throws(()=>normalizeIntentEnvelope({mode:'amend',intent:'event',confidence:'high',proposal:event}));
assert.throws(()=>normalizeIntentEnvelope({mode:'create',intent:'event',confidence:'low',proposal:event,ambiguity:'event_or_expense'}));
const unclear=normalizeIntentEnvelope({mode:'unclear',intent:'unclear',confidence:'low',proposal:null,ambiguity:'event_or_expense'});
assert.equal(clarificationResult(unclear).proposal,null);assert.match(clarificationResult(unclear).text,/напоминание.*расход/);
const reminderDetails=normalizeIntentEnvelope({mode:'unclear',intent:'unclear',confidence:'low',proposal:null,ambiguity:'reminder_details'});
assert.equal(clarificationResult(reminderDetails).proposal,null);
assert.match(clarificationResult(reminderDetails).text,/понял, что это напоминание/i);
assert.match(clarificationResult(reminderDetails).text,/когда напомнить.*что именно/isu);

const ambiguousFetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({mode:'unclear',intent:'unclear',confidence:'low',proposal:null,ambiguity:'event_or_expense'})}}]});
const result=await prepareDraft({text:'Аптека 19.00',apiKey:'fake',now:new Date('2026-09-14T12:00:00Z'),fetchImpl:ambiguousFetch});
assert.equal(result.proposal,null);assert.equal(result.needsClarification,true);assert.match(result.text,/ничего не сохранено/i);

for(const phrase of ['зайти в аптеку в 19:00','позвонить маме завтра','врач во вторник в десять'])assert.ok(SYSTEM_PROMPT.includes(phrase));
assert.match(SYSTEM_PROMPT,/по смыслу всей фразы/);assert.match(SYSTEM_PROMPT,/Не маскируй непонимание под заметку/);
assert.match(SYSTEM_PROMPT,/тип записи уже известен/);
assert.match(SYSTEM_PROMPT,/через 15 минут.*reminder_details/su);
assert.equal(SEMANTIC_CORPUS.length,30);assert.equal(new Set(SEMANTIC_CORPUS.map(({text})=>text)).size,SEMANTIC_CORPUS.length);
const matrixNow=new Date('2026-09-12T21:10:00Z');
for(const row of SEMANTIC_CORPUS){
 let calls=0;
 const fetchImpl=async()=>{
  calls++;
  const envelope=row.unclear
   ?{mode:'unclear',intent:'unclear',confidence:'low',proposal:null,ambiguity:row.unclear}
   :{mode:'create',intent:row.proposal.kind,confidence:'high',proposal:row.proposal};
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(envelope)}}]});
 };
 const parsed=await prepareDraft({text:row.text,apiKey:'fake',now:matrixNow,defaultCurrency:'RUB',fetchImpl});
 assert.equal(calls,row.route==='model'?1:0,`${row.text}: неверный маршрут`);
 if(row.unclear){assert.equal(parsed.proposal,null,row.text);assert.equal(parsed.needsClarification,true,row.text);}
 else assert.deepEqual(parsed.proposal,row.proposal,row.text);
}

console.log('PASS semantic envelope, confidence gate, specific clarification, whole-phrase contract and acceptance corpus');
