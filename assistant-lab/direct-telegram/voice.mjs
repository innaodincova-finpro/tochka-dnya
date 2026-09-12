const MAX_BYTES=4*1024*1024;
export const voiceErrorText=e=>({
 voice_not_configured:'Распознавание голоса ещё не подключено: нужен ключ сервиса. Пока отправьте задание текстом.',
 voice_too_long:'Запишите голосовое до 60 секунд, по одному заданию.',
 voice_too_large:'Голосовое слишком большое. Запишите короткое сообщение до 60 секунд.',
 voice_empty:'Не удалось разобрать речь. Запишите сообщение ещё раз или отправьте текст.',
 voice_text_long:'В голосовом слишком много текста. Отправьте одно короткое задание.',
 voice_key:'Сервис распознавания отклонил ключ. Пока отправьте задание текстом.',
 voice_busy:'Сервис распознавания временно недоступен. Попробуйте позже или отправьте текст.'
})[e.message]||'Не удалось распознать голосовое. Попробуйте ещё раз или отправьте текст.';
const fail=code=>{throw new Error(code);};
export function checkVoice(v){
 if(!v||typeof v.file_id!=='string'||!v.file_id||v.file_id.length>512)fail('voice_empty');
 if(!Number.isFinite(v.duration)||v.duration<0||v.duration>60)fail('voice_too_long');
 if(v.file_size!==undefined&&(!Number.isSafeInteger(v.file_size)||v.file_size<=0||v.file_size>MAX_BYTES))fail('voice_too_large');
}
async function bounded(r,max){
 if(Number(r.headers.get('content-length'))>max){await r.body?.cancel();fail('voice_too_large');}
 const reader=r.body?.getReader();if(!reader)fail('voice_empty');
 const parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('voice_too_large');}parts.push(value);}
 return new Blob(parts);
}
// Called only after owner verification and update/quota reservation. Never log audio, tokens or transcripts.
export async function transcribeVoice({voice,env,tg,request=fetch}){
 checkVoice(voice);
 const key=env('TOCHKA_ASSISTANT_GROQ_API_KEY');if(!key||/\s/.test(key))fail('voice_not_configured');
 const file=await tg('getFile',{file_id:voice.file_id});
 const path=file?.file_path;
 if(typeof path!=='string'||!/^voice\/[A-Za-z0-9_.-]+\.(?:oga|ogg|opus|mp3|m4a)$/i.test(path))fail('voice_empty');
 if(file.file_size>MAX_BYTES)fail('voice_too_large');
 const r=await request('https://api.telegram.org/file/bot'+env('TOCHKA_ASSISTANT_BOT_TOKEN')+'/'+path,{signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!r.ok){await r.body?.cancel();fail('voice_busy');}
 const audio=await bounded(r,MAX_BYTES);if(!audio.size)fail('voice_empty');
 const form=new FormData();form.append('file',audio,'voice.'+(path.endsWith('.oga')?'ogg':path.split('.').pop()));
 form.append('model','whisper-large-v3-turbo');form.append('language','ru');form.append('response_format','verbose_json');form.append('temperature','0');
 const response=await request('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!response.ok){await response.body?.cancel();fail(response.status===401?'voice_key':'voice_busy');}
 const data=JSON.parse(await (await bounded(response,65536)).text());
 const segments=data.segments;
 if(Array.isArray(segments)&&segments.length&&segments.every(s=>s.no_speech_prob>0.6))fail('voice_empty');
 const text=data.text?.trim();if(!text||typeof text!=='string')fail('voice_empty');if(text.length>1500)fail('voice_text_long');
 return text;
}
