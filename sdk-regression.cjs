const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/createClient\(SUPABASE_URL,SUPABASE_KEY,\{global:\{headers:(\{[^}]+\})/);
assert(match,'Find actual application client headers');
const headers=vm.runInNewContext('('+match[1]+')');
const context={console,Headers,URL,fetch,Response,Request,AbortController,TextEncoder,setTimeout,clearTimeout,setInterval,clearInterval,WebSocket};
vm.createContext(context);vm.runInContext(fs.readFileSync('supabase.js','utf8'),context);
async function check(config){
 const sent=[];
 const client=context.supabase.createClient('https://test.supabase.co','test-key',{
  global:{headers:config,fetch:async(url,opts)=>{
   const h=new Headers(opts.headers);sent.push({method:opts.method,protocol:h.get('x-client-info')});
   return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  }},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 await client.from('user_app_data').select('updated_at');
 await client.from('user_app_data').update({payload:{}}).eq('user_id','test').select('updated_at');
 await client.from('user_app_data').insert({payload:{}}).select('updated_at');
 return sent;
}
(async()=>{
 const broken=await check({'x-client-info':'tochka-dnya/5.6.1'});
 assert(broken.every(r=>r.protocol!=='tochka-dnya/5.6.1'&&r.protocol.includes(',')),'Reproduce duplicate header from old configuration');
 const actual=await check(headers);
 assert.deepEqual(actual.map(r=>r.method),['GET','PATCH','POST']);
 assert(actual.every(r=>r.protocol==='tochka-dnya/5.6.1'),'Actual SDK request must pass server protocol guard');
 console.log('SDK PASS: old duplicate reproduced; application GET/PATCH/POST send exactly one supported protocol value.');
})().catch(e=>{console.error(e);process.exitCode=1;});
