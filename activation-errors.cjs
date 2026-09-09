const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
async function scenario(session,errors){
 let verifies=0,updates=0;
 const d=new JSDOM(fs.readFileSync('activate.html','utf8'),{url:'https://example.test/activate.html#token=test&email=new@example.test',runScripts:'dangerously',beforeParse(w){w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),verifyOtp:async()=>({error:errors[verifies++]||null}),updateUser:async()=>{updates++;return {error:{message:'network'}}}}})};}});
 const w=d.window;w.document.getElementById('password').value='test-password';w.document.getElementById('repeat').value='test-password';
 const submit=async()=>{w.document.getElementById('activate').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));return w.document.getElementById('status').textContent;};
 assert.equal(verifies,0,'opening a link does not consume it');
 return {d,submit,counts:()=>({verifies,updates})};
}
let t=await scenario(null,[{message:'Failed to fetch',status:0},null]);assert((await t.submit()).includes('с этой же ссылкой'));assert.equal(t.counts().updates,0);assert((await t.submit()).includes('пароль не сохранён'));assert.equal(t.counts().verifies,2);await t.submit();assert.equal(t.counts().verifies,2,'retry password without consuming link again');t.d.window.close();
t=await scenario(null,[{code:'otp_expired'}]);assert((await t.submit()).includes('истекла'));t.d.window.close();
t=await scenario(null,[{status:429}]);assert((await t.submit()).includes('Слишком много'));t.d.window.close();
t=await scenario({user:{email:'owner@example.test'}},[]);assert((await t.submit()).includes('другой аккаунт'));assert.equal(t.counts().verifies,0);t.d.window.close();
t=await scenario({user:{email:'new@example.test'}},[]);assert((await t.submit()).includes('эту почту'));assert.equal(t.counts().verifies,0);t.d.window.close();
console.log('PASS activation: network retry, expired token, rate limit, same/different session, token not consumed on open, password retry');
})().catch(e=>{console.error(e);process.exit(1)});
