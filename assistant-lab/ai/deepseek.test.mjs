import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
const input={text:'Завтра врач в 10:15',apiKey:'synthetic-test-key',now:new Date('2026-09-12T22:00:00Z')};
const answer=(content={kind:'event',title:'Врач',date:'2026-09-14',time:'10:15'},finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content:JSON.stringify(content)}}]}));
test('fixed provider, Moscow date, JSON and token cap; no tools',async()=>{
 let called=0;
 const r=await prepareDraft({...input,fetchImpl:async(url,opts)=>{
  called++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(opts.redirect,'error');
  const b=JSON.parse(opts.body);assert.equal(b.max_tokens,1200);assert.equal(b.tools,undefined);assert.equal(b.messages.length,2);
  assert.match(b.messages[0].content,/2026-09-13; часовой пояс/);assert.equal(b.messages[1].content,input.text);return answer();
 }});assert.equal(called,1);assert.match(r.text,/ничего не сохранено/);
});
test('no request without key, input or valid timezone',async()=>{
 for(const patch of [{apiKey:''},{text:''},{text:'a'.repeat(1501)},{timeZone:'bad-zone'}]) await assert.rejects(prepareDraft({...input,...patch,fetchImpl:()=>assert.fail('network forbidden')}));
});
test('provider errors are redacted and never retried',async()=>{
 for(const [status,code] of [[401,'key_rejected'],[402,'balance_required'],[429,'provider_busy'],[500,'provider_unavailable']]) {
  let n=0;await assert.rejects(prepareDraft({...input,fetchImpl:async()=>{n++;return new Response('secret provider text',{status});}}),{message:code});assert.equal(n,1);
 }
});
test('invalid/truncated/empty and oversized outputs rejected',async()=>{
 for(const make of [()=>answer({},'length'),()=>answer({kind:'event',title:'X',date:'2026-02-30'}),()=>new Response('{}'),()=>new Response('x'.repeat(32769))]) await assert.rejects(prepareDraft({...input,fetchImpl:async()=>make()}),{message:'invalid_response'});
});
test('network exception does not disclose credentials',async()=>{
 await assert.rejects(prepareDraft({...input,fetchImpl:async()=>{throw new Error(input.apiKey);}}),{message:'provider_unavailable'});
});
