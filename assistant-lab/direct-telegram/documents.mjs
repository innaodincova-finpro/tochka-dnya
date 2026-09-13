const MAX_BYTES=20*1024*1024;
const BUCKET='tochka-documents';
const MIME_TYPES=new Set([
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'image/jpeg','image/png','image/webp','image/heic','image/heif'
]);
const norm=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const safeName=name=>String(name||'document').normalize('NFKC').replace(/[\\/\u0000-\u001f\u007f]+/g,'_').replace(/\s+/g,' ').trim().slice(0,180)||'document';
const fail=code=>{throw new Error(code);};
const encodedPath=path=>path.split('/').map(encodeURIComponent).join('/');

export function documentSearchIntent(text){
 if(typeof text!=='string')return null;
 const t=text.trim();
 const explicit=/^найди\s+документ(?:ы)?(?:\s+(?:про|о))?(?:\s+|:\s*)(.*?)[?!.]*$/iu.exec(t);
 if(explicit)return {query:explicit[1].trim()};
 const short=/^найди\s+(?!заметк(?:у|и)?(?:\s|$))(.*?)[?!.]*$/iu.exec(t);
 return short?{query:short[1].trim()}:null;
}

export function incomingDocument(message){
 if(message?.document){
  const d=message.document;
  return {fileId:d.file_id,fileSize:d.file_size,mimeType:d.mime_type||'',originalName:safeName(d.file_name||'document'),title:safeName((d.file_name||'document').replace(/\.[^.]+$/,''))};
 }
 if(Array.isArray(message?.photo)&&message.photo.length){
  const p=[...message.photo].sort((a,b)=>(b.file_size||0)-(a.file_size||0))[0];
  return {fileId:p.file_id,fileSize:p.file_size,mimeType:'image/jpeg',originalName:'Фото '+new Date((message.date||0)*1000).toISOString().replace(/[:.]/g,'-')+'.jpg',title:safeName(message.caption||'Фото')};
 }
 return null;
}

function validateFile(file){
 if(!file||typeof file.fileId!=='string'||!file.fileId||file.fileId.length>512)fail('invalid_document');
 if(file.fileSize!==undefined&&(!Number.isSafeInteger(file.fileSize)||file.fileSize<=0||file.fileSize>MAX_BYTES))fail('document_too_large');
 if(!MIME_TYPES.has(file.mimeType))fail('document_type');
}
async function bounded(response,max){
 const stated=Number(response.headers.get('content-length'));if(Number.isFinite(stated)&&stated>max){await response.body?.cancel();fail('document_too_large');}
 const reader=response.body?.getReader();if(!reader)fail('document_download');let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('document_too_large');}chunks.push(value);}
 if(!size)fail('document_download');return new Blob(chunks);
}
async function activeMember(s,uid){return (await s.db('tochka_members?user_id=eq.'+encodeURIComponent(uid)+'&revoked_at=is.null&select=user_id')).length>0;}
function errorText(e){return ({document_too_large:'Файл слишком большой. Максимальный размер — 20 МБ.',document_type:'Этот формат пока не поддерживается. Можно отправить PDF, Word, JPG, PNG, WEBP или фото с iPhone.',invalid_document:'Не удалось прочитать файл. Отправьте его ещё раз.',document_download:'Не удалось скачать файл из Telegram. Попробуйте ещё раз.',document_store:'Не удалось сохранить документ в облаке. Попробуйте позже.'})[e.message]||'Не удалось сохранить документ. Попробуйте позже.';}

export async function saveIncomingDocument({message,s,uid,chat,linked,env,request=fetch}){
 const file=incomingDocument(message);if(!file)return false;
 try{
  validateFile(file);if(!await activeMember(s,uid)||!await linked())return true;
  const remote=await s.tg('getFile',{file_id:file.fileId});
  if(!remote||typeof remote.file_path!=='string'||!/^[A-Za-z0-9_./-]+$/.test(remote.file_path)||remote.file_path.includes('..'))fail('invalid_document');
  if(remote.file_size!==undefined&&(!Number.isSafeInteger(remote.file_size)||remote.file_size<=0||remote.file_size>MAX_BYTES))fail('document_too_large');
  if(remote.file_size!==undefined&&file.fileSize!==undefined&&remote.file_size!==file.fileSize)fail('invalid_document');
  const downloaded=await request('https://api.telegram.org/file/bot'+env('TOCHKA_ASSISTANT_BOT_TOKEN')+'/'+remote.file_path,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!downloaded.ok){await downloaded.body?.cancel();fail('document_download');}
  const blob=await bounded(downloaded,MAX_BYTES);if(file.fileSize!==undefined&&blob.size!==file.fileSize)fail('invalid_document');if(remote.file_size!==undefined&&blob.size!==remote.file_size)fail('invalid_document');
  if(!await activeMember(s,uid)||!await linked())return true;
  const id=crypto.randomUUID(),path=uid+'/'+id+'/'+file.originalName;
  const stored=await request(env('SUPABASE_URL')+'/storage/v1/object/'+BUCKET+'/'+encodedPath(path),{method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'content-type':file.mimeType,'x-upsert':'false'},body:blob,signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!stored.ok){await stored.body?.cancel();fail('document_store');}
  try{await s.db('tochka_documents','POST',{id,user_id:uid,title:file.title,original_name:file.originalName,mime_type:file.mimeType,size_bytes:blob.size,object_path:path});}
  catch(e){try{await request(env('SUPABASE_URL')+'/storage/v1/object/'+BUCKET+'/'+encodedPath(path),{method:'DELETE',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY')},signal:AbortSignal.timeout(10000),redirect:'error'});}catch{}throw e;}
  await s.tg('sendMessage',{chat_id:chat,text:'Документ сохранён: «'+file.title+'». Найти его можно командой «Найди документ '+file.title+'».'});
 }catch(e){if(await linked())try{await s.tg('sendMessage',{chat_id:chat,text:errorText(e)});}catch{}}
 return true;
}

async function sendStoredDocument(row,{chat,env,request}){
 const response=await request(env('SUPABASE_URL')+'/storage/v1/object/'+BUCKET+'/'+encodedPath(row.object_path),{headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY')},signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok){await response.body?.cancel();fail('document_download');}
 const blob=await bounded(response,MAX_BYTES),form=new FormData();form.append('chat_id',String(chat));form.append('caption','Документ: '+row.title);form.append('document',blob,safeName(row.original_name));
 const sent=await request('https://api.telegram.org/bot'+env('TOCHKA_ASSISTANT_BOT_TOKEN')+'/sendDocument',{method:'POST',body:form,signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!sent.ok){await sent.body?.cancel();fail('document_download');}const data=await sent.json();if(!data.ok)fail('document_download');
}
export async function findDocument(intent,{s,uid,chat,linked,env,request=fetch}){
 if(!intent)return false;
 if(intent.query.length<2||intent.query.length>120){await s.tg('sendMessage',{chat_id:chat,text:'Напишите от 2 до 120 символов. Например: «Найди документ договор».'});return true;}
 if(!await activeMember(s,uid)||!await linked())return true;
 const q=encodeURIComponent('*'+intent.query.replace(/[*,()]/g,' ')+'*');
 let rows;try{rows=await s.db('tochka_documents?user_id=eq.'+encodeURIComponent(uid)+'&deleted_at=is.null&title=ilike.'+q+'&select=id,title,original_name,mime_type,size_bytes,object_path,created_at&order=created_at.desc&limit=10');}catch{rows=null;}
 if(!rows){await s.tg('sendMessage',{chat_id:chat,text:'Не удалось найти документы в облаке. Попробуйте позже.'});return true;}
 if(!rows.length){await s.tg('sendMessage',{chat_id:chat,text:'По запросу «'+intent.query+'» документов не найдено.'});return true;}
 const exact=rows.filter(r=>norm(r.title)===norm(intent.query));
 if(exact.length===1){if(await activeMember(s,uid)&&await linked())await sendStoredDocument(exact[0],{chat,env,request});return true;}
 if(rows.length===1){if(await activeMember(s,uid)&&await linked())await sendStoredDocument(rows[0],{chat,env,request});return true;}
 await s.tg('sendMessage',{chat_id:chat,text:'Найдено документов: '+rows.length+'\n\n'+rows.map((r,i)=>(i+1)+'. '+r.title).join('\n')+'\n\nУточните название документа.'});return true;
}
