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

const ambiguousFetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({mode:'unclear',intent:'unclear',confidence:'low',proposal:null,ambiguity:'event_or_expense'})}}]});
const result=await prepareDraft({text:'Аптека 19.00',apiKey:'fake',now:new Date('2026-09-14T12:00:00Z'),fetchImpl:ambiguousFetch});
assert.equal(result.proposal,null);assert.equal(result.needsClarification,true);assert.match(result.text,/ничего не сохранено/i);

for(const phrase of ['зайти в аптеку в 19:00','позвонить маме завтра','врач во вторник в десять'])assert.ok(SYSTEM_PROMPT.includes(phrase));
assert.match(SYSTEM_PROMPT,/по смыслу всей фразы/);assert.match(SYSTEM_PROMPT,/Не маскируй непонимание под заметку/);
assert.ok(SEMANTIC_CORPUS.length>=30);assert.equal(new Set(SEMANTIC_CORPUS.map(([text])=>text)).size,SEMANTIC_CORPUS.length);
assert.deepEqual([...new Set(SEMANTIC_CORPUS.map(([,intent])=>intent))].sort(),['event','expense','note','unclear']);

console.log('PASS semantic envelope, confidence gate, specific clarification, whole-phrase contract and acceptance corpus');
