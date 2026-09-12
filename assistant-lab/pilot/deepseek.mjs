import {SYSTEM_PROMPT, validateProposal, formatProposal} from './proposal.mjs';
export class AssistantError extends Error { constructor(code) { super(code); this.name='AssistantError'; } }
const error = code => new AssistantError(code);
// Server-side only. Caller must authenticate owner and reserve daily quota BEFORE calling.
export async function prepareDraft({text, apiKey, now = new Date(), timeZone = 'Europe/Moscow', fetchImpl = fetch}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1500) throw error('invalid_input');
  if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey)) throw error('key_missing_or_invalid');
  let today;
  try {
    if (!Number.isFinite(+now)) throw 0;
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get = type => parts.find(p=>p.type===type).value;
    today = `${get('year')}-${get('month')}-${get('day')}`;
  } catch { throw error('invalid_time_context'); }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),25000);
  try {
    const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method:'POST', redirect:'error', signal:controller.signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
      body:JSON.stringify({model:'deepseek-flash',stream:false,thinking:{type:'disabled'},max_tokens:1200,
        response_format:{type:'json_object'},messages:[
          {role:'system',content:SYSTEM_PROMPT+'\nПример JSON: {"kind":"event","title":"Врач","date":"2026-09-15","time":"10:15"}. Пример не содержит данных пользователя.\nТекущая дата: '+today+'; часовой пояс: '+timeZone+'.'},
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
    let proposal;
    try {
      const result=JSON.parse(body),choice=result.choices?.[0];
      if(choice?.finish_reason!=='stop' || choice.message?.tool_calls?.length || typeof choice.message?.content!=='string') throw 0;
      proposal=validateProposal(JSON.parse(choice.message.content));
    } catch {throw error('invalid_response');}
    // Guard explicit scheduling requests against the observed model fallback to a note.
    if (proposal.kind === 'note' && /^\s*(?:пожалуйста[,\s]+)?(?:запланируй|назначь|организуй)\s+(?:мне\s+)?встречу(?=\s|[.!?]|$)/iu.test(text)) {
      return {needsClarification:true,text:'На какую дату и время запланировать встречу? Пришлите запрос целиком с датой и временем.\nВ «Точку дня» ничего не сохранено.'};
    }
    return {proposal,...formatProposal(proposal)};
  } catch(e) {
    if(e instanceof AssistantError) throw e;
    throw error(controller.signal.aborted ? 'provider_timeout' : 'provider_unavailable');
  } finally {clearTimeout(timer);}
}
