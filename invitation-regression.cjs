const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
let handler,role='admin',users=[],generated=0,dataFailure=false;
const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/kabinet/index.ts','utf8'));
vm.runInNewContext(code,{Deno:{env:{get:n=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'secret',ADMIN_EMAIL:'admin@example.com'})[n]},serve:f=>handler=f},Response,Request,fetch:async(url,opts)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({email:role==='admin'?'admin@example.com':'other@example.com'});
 if(url.includes('/admin/users?')){const page=Number(new URL(url).searchParams.get('page'));return Response.json({users:users.slice((page-1)*200,page*200)});}
 if(url.endsWith('/admin/generate_link')){generated++;assert.equal(JSON.parse(opts.body).type,'invite');return Response.json({hashed_token:'test-token',verification_type:'invite'});}
 if(url.includes('/rest/v1/'))return dataFailure?new Response('',{status:503}):Response.json([]);
 throw new Error('Unexpected request');
}});
const request=(body,auth=true)=>new Request('https://test.invalid/kabinet',{method:body?'POST':'GET',headers:auth?{Authorization:'Bearer test'}:{},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 assert.equal((await handler(request(null,false))).status,401);
 role='user';assert.equal((await handler(request({action:'invite',email:'new@example.com'}))).status,403);assert.equal(generated,0);role='admin';
 assert.equal((await handler(request({action:'invite',email:'bad'}))).status,400);
 users=[{email:'used@example.com',email_confirmed_at:'today'}];assert.equal((await handler(request({action:'invite',email:'used@example.com'}))).status,409);assert.equal(generated,0);
 const res=await handler(request({action:'invite',email:' New@Example.com '}));const body=await res.json();assert.equal(res.status,200);assert.equal(body.email,'new@example.com');assert.equal(new URL(body.url).pathname,'/tochka-dnya/activate.html');assert.equal(new URL(body.url).search,'');assert.equal(res.headers.get('cache-control'),'no-store');assert(!JSON.stringify(body).includes('secret'));
 users=Array.from({length:201},(_,i)=>({id:String(i),email:i+'@example.com'}));assert.equal((await(await handler(request())).json()).vsego,201);
 dataFailure=true;assert.equal((await handler(request())).status,502);
 const {JSDOM}=require('jsdom');
 let verify=0,update=0,fail=true;
 const dom=new JSDOM(fs.readFileSync('activate.html','utf8'),{url:'https://test.invalid/activate.html#token=valid&email=new@example.com',runScripts:'dangerously',beforeParse(w){w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),verifyOtp:async p=>{verify++;assert.equal(p.type,'invite');return fail?{error:{message:'expired'}}:{data:{}};},updateUser:async()=>{update++;return {error:{message:'network'}};}}})};}});
 const w=dom.window,doc=w.document;const submit=async()=>{doc.getElementById('activate').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));};
 assert.equal(verify,0,'Opening link must not consume invitation');
 doc.getElementById('password').value='test-password';doc.getElementById('repeat').value='mismatch';await submit();assert.equal(verify,0);
 doc.getElementById('repeat').value='test-password';await submit();assert.equal(verify,1);assert.equal(update,0);assert(doc.getElementById('status').textContent.includes('истекла'));
 fail=false;await submit();assert.equal(verify,2);assert.equal(update,1);assert.equal(w.location.hash,'');await submit();assert.equal(verify,2,'Password retry must not consume token again');assert.equal(update,2);w.close();
 console.log('PASS invitations: authorization, validation, existing-account protection, 201 users, errors, secret fragment, activation and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
