const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
const dom=new JSDOM(fs.readFileSync('reestr.html','utf8'),{url:'https://test.invalid/reestr.html',runScripts:'outside-only'}),w=dom.window;let payload,deleted=false,allow=false;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:'test'}}})}})};
w.confirm=message=>{assert(message.includes('Кабинета студента'));assert(message.includes('Локальные копии'));return allow;};
w.fetch=async(url,opt)=>{if(opt.method==='POST'){payload=JSON.parse(opt.body);deleted=true;return {ok:true,json:async()=>({deleted:true})}}return {ok:true,json:async()=>({lyudi:deleted?[]:[{id:'test',pochta:'test@example.invalid',zahodil:'2026-09-09',mozhno_udalit:true}]})}};
w.eval(fs.readFileSync('registry.js','utf8'));await w.eval('refresh()');w.document.querySelector('.person').click();assert.equal(w.document.getElementById('person-actions').hidden,false);
await w.document.getElementById('remove-pending').onclick();assert.equal(deleted,false);
allow=true;await w.document.getElementById('remove-pending').onclick();assert.equal(payload.action,'remove_access');assert.equal(payload.confirm_email,'test@example.invalid');assert.equal(w.document.querySelectorAll('.person').length,0);assert.equal(w.document.getElementById('person-dialog').open,false);
assert(w.eval("invitationMessage({existing:true,email:'test@example.invalid',url:'https://example.test'})").includes('существующим паролем'));
w.close();console.log('PASS: activated-user deletion button, cancel, scoped warning, exact target, refreshed list, existing-account instructions');
})().catch(e=>{console.error(e);process.exit(1)});
