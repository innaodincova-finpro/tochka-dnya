import assert from 'node:assert/strict';
import {documentSearchIntent,incomingDocument,saveIncomingDocument,findDocument} from './documents.mjs';
import {makeHandler} from './receiver.mjs';
import {hash} from './common.mjs';

assert.deepEqual(documentSearchIntent('Найди документ договор'),{query:'договор'});
assert.deepEqual(documentSearchIntent('найди документы про квартиру?'),{query:'квартиру'});
assert.deepEqual(documentSearchIntent('Найди иконки'),{query:'иконки'});
assert.equal(documentSearchIntent('найди заметку договор'),null);
assert.equal(incomingDocument({document:{file_id:'f',file_size:10,mime_type:'application/pdf',file_name:'Договор.pdf'}}).title,'Договор');
assert.equal(incomingDocument({date:1,caption:'Чек',photo:[{file_id:'small',file_size:3},{file_id:'large',file_size:9}]}).fileId,'large');

const uid='00000000-0000-4000-8000-000000000001',chat=123;
const env=n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'service-secret',TOCHKA_ASSISTANT_BOT_TOKEN:'bot-secret'})[n];
let calls=[],members=true,linked=true,rows=[];
const s={
 db:async(path,method='GET',body)=>{calls.push({kind:'db',path,method,body});if(path.startsWith('tochka_members'))return members?[{user_id:uid}]:[];if(path.startsWith('tochka_documents?'))return rows;if(path==='tochka_documents'&&method==='POST')return [body];throw new Error('Unexpected db '+path);},
 tg:async(method,body)=>{calls.push({kind:'tg',method,body});if(method==='getFile')return {file_path:'documents/file.pdf',file_size:4};return {message_id:1};}
};
const request=async(url,o={})=>{calls.push({kind:'fetch',url,o});if(url.includes('/file/bot'))return new Response(new Uint8Array([1,2,3,4]),{headers:{'content-length':'4'}});if(url.includes('/storage/v1/object/'))return new Response('{}',{status:o.method==='DELETE'?200:200});if(url.endsWith('/sendDocument'))return Response.json({ok:true,result:{message_id:2}});throw new Error('Unexpected fetch '+url);};
const linkedFn=async()=>linked;

let handled=await saveIncomingDocument({message:{date:1,document:{file_id:'f',file_size:4,mime_type:'application/pdf',file_name:'Договор.pdf'}},s,uid,chat,linked:linkedFn,env,request});
assert.equal(handled,true);const upload=calls.find(c=>c.kind==='fetch'&&c.url.includes('/storage/v1/object/'));
assert.equal(upload.o.headers['x-upsert'],'false');assert.equal(upload.o.headers.authorization,'Bearer service-secret');assert.ok(upload.url.includes('/tochka-documents/'+uid+'/'));
const metadata=calls.find(c=>c.kind==='db'&&c.path==='tochka_documents');assert.equal(metadata.body.title,'Договор');assert.equal(metadata.body.size_bytes,4);
assert.ok(!calls.some(c=>c.kind==='db'&&c.path.includes('reserve')));

calls=[];await saveIncomingDocument({message:{document:{file_id:'x',file_size:4,mime_type:'application/x-msdownload',file_name:'bad.exe'}},s,uid,chat,linked:linkedFn,env,request});
assert.ok(calls.some(c=>c.kind==='tg'&&/формат/.test(c.body.text)));assert.ok(!calls.some(c=>c.kind==='fetch'));
calls=[];await saveIncomingDocument({message:{document:{file_id:'x',file_size:20*1024*1024+1,mime_type:'application/pdf',file_name:'large.pdf'}},s,uid,chat,linked:linkedFn,env,request});
assert.ok(calls.some(c=>c.kind==='tg'&&/20 МБ/.test(c.body.text)));

rows=[{id:'1',title:'Договор',original_name:'Договор.pdf',mime_type:'application/pdf',size_bytes:4,object_path:uid+'/1/Договор.pdf'}];calls=[];
await findDocument(documentSearchIntent('Найди документ договор'),{s,uid,chat,linked:linkedFn,env,request});
const sent=calls.find(c=>c.kind==='fetch'&&c.url.endsWith('/sendDocument'));assert.ok(sent);assert.ok(sent.o.body instanceof FormData);assert.ok(!calls.some(c=>c.kind==='db'&&c.path.includes('reserve')));

rows=[{id:'1',title:'Договор аренды'},{id:'2',title:'Договор купли'}];calls=[];
await findDocument(documentSearchIntent('Найди документ договор'),{s,uid,chat,linked:linkedFn,env,request});
assert.match(calls.find(c=>c.kind==='tg'&&c.method==='sendMessage').body.text,/1\. Договор аренды/);assert.ok(!calls.some(c=>c.kind==='fetch'&&c.url.endsWith('/sendDocument')));

members=false;calls=[];await findDocument(documentSearchIntent('Найди документ договор'),{s,uid,chat,linked:linkedFn,env,request});assert.ok(!calls.some(c=>c.kind==='fetch'||c.kind==='tg'));

// Full webhook route: document handling happens before the reservation/AI pipeline.
members=true;calls=[];const secret='a'.repeat(64),hook=await hash(secret);
const webhookRequest=async(url,o={})=>{
 calls.push({kind:'web',url,o});let data;
 if(url.includes('/auth/v1/'))data={id:uid,email:'owner@test.invalid',email_confirmed_at:'2026-01-01'};
 else if(url.endsWith('/getWebhookInfo'))data={ok:true,result:{allowed_updates:['message','callback_query']}};
 else if(url.endsWith('/getFile'))data={ok:true,result:{file_path:'documents/file.pdf',file_size:4}};
 else if(url.endsWith('/sendMessage'))data={ok:true,result:{message_id:1}};
 else if(url.includes('/file/bot'))return new Response(new Uint8Array([1,2,3,4]),{headers:{'content-length':'4'}});
 else if(url.includes('/storage/v1/object/'))return new Response('{}');
 else if(url.includes('tochka_assistant_links'))data=[{chat_id:chat}];
 else if(url.includes('tochka_assistant_pilot'))data=[{user_id:uid,enabled:true,enabled_at:'2026-01-01T00:00:00Z',hook_hash:hook}];
 else if(url.includes('tochka_members'))data=[{user_id:uid}];
 else if(url.endsWith('/rest/v1/tochka_documents'))data=[{}];
 else throw new Error('Unexpected webhook request '+url);
 return Response.json(data);
};
const webhookEnv=n=>({...Object.fromEntries(['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TOCHKA_ASSISTANT_BOT_TOKEN'].map(k=>[k,env(k)])),TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@test.invalid'})[n];
const handler=makeHandler(webhookEnv,webhookRequest,()=>{throw new Error('AI must not run');});
const result=await handler(new Request('https://local',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:77,message:{message_id:7,date:Math.floor(Date.now()/1000),chat:{id:chat,type:'private'},from:{id:chat,is_bot:false},document:{file_id:'f',file_size:4,mime_type:'application/pdf',file_name:'Договор.pdf'}}})}));
assert.equal(result.status,200);assert.ok(!calls.some(c=>c.url.includes('tochka_assistant_reserve')));
console.log('PASS document/photo validation, private upload metadata, exact retrieval, ambiguous list, owner gates, no AI quota');
