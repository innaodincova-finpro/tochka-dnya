import {shortChange,proposalDefaults} from './defaults.mjs';
import {localDraft} from './local-draft.mjs';
import {SYSTEM_PROMPT, validateProposal, formatProposal} from './proposal.mjs';
import {normalizeIntentEnvelope,clarificationResult} from './intent.mjs';
export class AssistantError extends Error { constructor(code) { super(code); this.name='AssistantError'; } }
const error = code => new AssistantError(code);
// Server-side only. Caller must authenticate owner and reserve daily quota BEFORE calling.
export async function prepareDraft({text, apiKey, now = new Date(), timeZone = 'Europe/Moscow', pending = null, defaultCurrency = null, fetchImpl = fetch}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1500) throw error('invalid_input');
  let today;
  try {
    if (!Number.isFinite(+now)) throw 0;
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get = type => parts.find(p=>p.type===type).value;
    today = `${get('year')}-${get('month')}-${get('day')}`;
  } catch { throw error('invalid_time_context'); }
  if (pending !== null) pending = validateProposal(pending);
  const short=shortChange(text,pending,today);
  if(short){const proposal=proposalDefaults(short,{today,defaultCurrency,text,inheritedCurrency:short.currency,inheritedDate:short.date});return {proposal,...formatProposal(proposal)};}
  /* Понятные фразы разбираются локально. Это не запасной разбор после сбоя
     модели, а обязательная первая линия: она не позволяет превратить действие
     со временем в расход и не тратит платный запрос на простую покупку. */
  const local=localDraft(text,today);
  if(local){const proposal=proposalDefaults(local,{today,defaultCurrency,text});return {proposal,...formatProposal(proposal)};}
  if (/(?:кажд(?:ый|ую|ое|ого|ые)|ежедневно|еженедельно|ежемесячно|ежегодно|по будням|по выходным)/iu.test(text)) throw error('recurrence_format');
  if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey)) throw error('key_missing_or_invalid');
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),25000);
  try {
    const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method:'POST', redirect:'error', signal:controller.signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
      body:JSON.stringify({model:'deepseek-flash',stream:false,thinking:{type:'disabled'},max_tokens:1200,
        response_format:{type:'json_object'},messages:[
          {role:'system',content:SYSTEM_PROMPT+'\nТекущая дата: '+today+'; часовой пояс: '+timeZone+'. Если дата не названа, программа сама использует текущую дату. Если валюта не названа — пропусти currency: её подставит программа из настроек. Суммы словами переводи в числа.'},
          ...(pending ? [{role:'assistant',content:'Текущий неподтверждённый черновик: '+JSON.stringify(pending)}] : []),
          {role:'user',content:text}
        ]})
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw error(({401:'key_rejected',402:'balance_required',429:'provider_busy'})[response.status] || 'provider_unavailable');
    }
    const reader=response.body?.getReader();
    if (!reader) throw error('invalid_response');
    let size=0,body='';const decoder=new TextDecoder();
    while(true) {
      const {done,value}=await reader.read();if(done) break;
      size+=value.byteLength;
      if(size>32768) {await reader.cancel();throw error('invalid_response');}
      body+=decoder.decode(value,{stream:true});
    }
    body+=decoder.decode();
    let envelope;
    try {
      const result=JSON.parse(body),choice=result.choices?.[0];
      if(choice?.finish_reason!=='stop' || choice.message?.tool_calls?.length || typeof choice.message?.content!=='string') throw 0;
      envelope=normalizeIntentEnvelope(JSON.parse(choice.message.content),{pending});
    } catch {throw error('invalid_response');}
    if(envelope.mode==='unclear')return clarificationResult(envelope);
    let proposal=envelope.proposal;
    proposal=proposalDefaults(proposal,{today,defaultCurrency,text,inheritedCurrency:envelope.mode==='amend'?pending?.currency:undefined,inheritedDate:envelope.mode==='amend'?pending?.date:undefined});
    return {proposal,...formatProposal(proposal)};
  } catch(e) {
    if(e instanceof AssistantError) throw e;
    throw error(controller.signal.aborted ? 'provider_timeout' : 'provider_unavailable');
  } finally {clearTimeout(timer);}
}
