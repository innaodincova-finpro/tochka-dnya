import {normalizeModelProposal} from './proposal.mjs';

const AMBIGUITY_TEXT={
 event_or_expense:'Это действие по времени или уже совершённая покупка? Ответьте: «напоминание» или «расход».',
 multiple_requests:'В сообщении несколько заданий. Какое из них обработать первым?',
 new_or_amend:'Это новая запись или изменение показанного черновика?',
 intent:'Что создать: напоминание, расход или заметку?'
};
const fail=()=>{throw new Error('invalid_response');};

export function normalizeIntentEnvelope(raw,{pending=null}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail();
 const allowed=['mode','intent','confidence','proposal','ambiguity'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))fail();
 if(!['create','amend','unclear'].includes(raw.mode)||!['event','expense','note','unclear'].includes(raw.intent)||!['high','low'].includes(raw.confidence))fail();
 if(raw.mode==='unclear'||raw.intent==='unclear'||raw.confidence==='low'){
  if(raw.proposal!==undefined&&raw.proposal!==null)fail();
  if(!Object.hasOwn(AMBIGUITY_TEXT,raw.ambiguity))fail();
  return Object.freeze({mode:'unclear',intent:'unclear',confidence:'low',ambiguity:raw.ambiguity});
 }
 if(raw.ambiguity!==undefined&&raw.ambiguity!==null)fail();
 if(raw.mode==='amend'&&!pending)fail();
 const proposal=normalizeModelProposal(raw.proposal);
 if(proposal.kind!==raw.intent)fail();
 if(raw.mode==='amend'&&proposal.kind!==pending.kind)fail();
 return Object.freeze({mode:raw.mode,intent:raw.intent,confidence:'high',proposal});
}

export function clarificationResult(envelope){
 return {proposal:null,needsClarification:true,text:AMBIGUITY_TEXT[envelope.ambiguity]+'\nВ «Точку дня» ничего не сохранено.'};
}
