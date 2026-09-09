const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
(async()=>{
let handler,granted=[],auth='inna_odincova@mail.ru';
const people=[{id:'owner',email:auth},{id:'student',email:'student@example.test',last_sign_in_at:'2026-09-09'}, {id:'member',email:'member@example.test',last_sign_in_at:'2026-09-09'}];
vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/kabinet/index.ts','utf8')),{Response,Request,Map,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':k==='ADMIN_EMAIL'?'inna_odincova@mail.ru':'service'},serve:f=>handler=f},fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({email:auth});
 if(url.includes('/auth/v1/admin/users?'))return Response.json({users:people});
 if(url.includes('/user_app_data?'))return Response.json([]);
 if(url.includes('/tochka_members?'))return Response.json([{user_id:'owner'},{user_id:'member',last_seen_at:'2026-09-08'}]);
 if(url.endsWith('/tochka_manage_access')){assert.equal(opt.headers.Authorization,'Bearer owner-token');granted.push(JSON.parse(opt.body));return Response.json(true);}
 if(url.endsWith('/generate_link'))return Response.json({id:'new',hashed_token:'test-token',verification_type:'invite'});
 throw Error(url);
}});
const req=body=>new Request('https://test.invalid',{method:body?'POST':'GET',headers:{Authorization:'Bearer owner-token'},...(body?{body:JSON.stringify(body)}:{})});
let data=await (await handler(req())).json();assert.equal(data.lyudi.length,2);assert(!data.lyudi.some(p=>p.id==='student'));assert.equal(data.lyudi.find(p=>p.id==='member').zahodil,'2026-09-08');assert.equal(data.lyudi.find(p=>p.id==='member').mozhno_udalit,true);
assert.equal((await handler(req({action:'remove_access',email:'member@example.test',user_id:'wrong',confirm_email:'member@example.test'}))).status,409);
assert.equal((await handler(req({action:'remove_access',email:'member@example.test',user_id:'member',confirm_email:'member@example.test'}))).status,200);assert.equal(granted.at(-1).p_action,'remove');
data=await (await handler(req({action:'invite',email:'student@example.test'}))).json();assert.equal(data.existing,true);assert.equal(granted.at(-1).p_user_id,'student');
data=await (await handler(req({action:'invite',email:'new@example.test'}))).json();assert(data.url.includes('activate.html#token='));assert.equal(granted.at(-1).p_user_id,'new');
auth='student@example.test';assert.equal((await handler(req())).status,403);
console.log('PASS: app-scoped list/activity, activated deletion, wrong-target rejection, existing/new invitations, owner authorization');
})().catch(e=>{console.error(e);process.exit(1)});
