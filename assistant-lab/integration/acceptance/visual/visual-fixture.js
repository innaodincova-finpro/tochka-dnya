/* Public visual fixture: synthetic records only. No network-backed auth or data. */
(function(){
const device=new URLSearchParams(location.search).get('device')||'a',uid='fixture-owner';
const today=new Date().toISOString().slice(0,10);
const source={source_version:'2026-09-12T18:00:00Z',calendar_revision:2,calendar_event:{title:'Пробная встреча помощника',date:today,time:'17:00',address:'Тестовый адрес'}};
const opened=new Promise((resolve,reject)=>{const r=indexedDB.open('tochka-assistant-visual-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const seed=()=>({payload:{settings:{cloudOwner:uid,onboarded:1,cur:'RUB'},ev:[{id:'existing',title:'Пробная исходная встреча',date:today,time:'10:00',kind:'plain',repeat:'none'}],exp:[],inc:[],notes:[],day:{},del:[]},updated_at:new Date().toISOString()});
async function transact(fn){const db=await opened;return new Promise((resolve,reject)=>{const tx=db.transaction('fixture','readwrite'),store=tx.objectStore('fixture'),r=store.get('state');let answer;r.onsuccess=()=>{const row=r.result||seed();if(!r.result)store.put(row,'state');try{answer=fn(row,store);}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>resolve(answer);tx.onerror=()=>reject(tx.error);});}
async function fixtureFetch(input,opt={}){
const url=new URL(typeof input==='string'?input:input.url,location.href),method=opt.method||'GET';
if(url.origin!==location.origin)throw Error('Внешняя сеть отключена в демонстрации.');
const body=opt.body?JSON.parse(opt.body):null,reply=(d,status=200)=>Response.json(d,{status});
if(url.pathname==='/functions/v1/tochka-assistant-calendar'&&body?.action==='list')return reply({records:[source]});
if(url.pathname==='/rest/v1/rpc/tochka_visit')return reply(true);
if(url.pathname!=='/rest/v1/user_app_data')return reply({message:'Только демонстрационные данные'},403);
return transact((row,store)=>{
if(url.searchParams.get('user_id')!=='eq.'+uid)return reply({message:'fixture only'},403);
if(method==='GET')return reply(row);
if(method==='PATCH'){
if(url.searchParams.get('updated_at')!=='eq.'+row.updated_at)return reply([]);
const next={payload:body.payload,updated_at:body.updated_at};store.put(next,'state');return reply([{updated_at:next.updated_at}]);
}
return reply({message:'fixture only'},405);
});
}
window.fetch=fixtureFetch;
const create=window.supabase.createClient;
window.supabase.createClient=(url,key,options)=>{
const c=create(url,key,{...options,global:{...options.global,fetch:fixtureFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const session={user:{id:uid,email:'fixture@example.test'},access_token:'fixture-local-only'};
c.auth={getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
return c;
};
document.addEventListener('DOMContentLoaded',()=>{
const banner=document.createElement('div');banner.textContent='ДЕМОНСТРАЦИЯ · Только вымышленные записи · Рабочее облако отключено';banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:10001;background:#fff3c2;color:#382a00;text-align:center;padding:4px;font:12px system-ui;pointer-events:none';document.body.append(banner);
});
})();
