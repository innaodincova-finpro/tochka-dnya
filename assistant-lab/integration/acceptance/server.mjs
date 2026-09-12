import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {PGlite} from '@electric-sql/pglite';
const root=path.resolve(process.env.TOCHKA_TEST_APP_DIR||'.'),port=8767;
const db=new PGlite();await db.exec('create table state(user_id text primary key,payload jsonb,updated_at timestamptz)');
const id='fixture-owner',date=new Date().toISOString().slice(0,10);
await db.query('insert into state values($1,$2,$3)',[id,{settings:{cloudOwner:id,onboarded:1,cur:'RUB'},ev:[{id:'existing',title:'Пробная исходная встреча',date,time:'10:00',kind:'plain',repeat:'none'}],exp:[],inc:[],notes:[],day:{},del:[]},new Date().toISOString()]);
const fixture={source_version:'2026-09-12T18:00:00Z',calendar_revision:2,calendar_event:{title:'Пробная встреча помощника',date,time:'17:00',address:'Тестовый адрес'}};
const harness=`const create=window.supabase.createClient;window.supabase.createClient=(url,key,options)=>{const client=create(url,key,{...options,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const session={user:{id:'fixture-owner',email:'fixture@example.test'},access_token:'fixture-local-only'};client.auth={getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};return client;};`;
let requests=[];
export const server=http.createServer(async(req,res)=>{
const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'self'; font-src 'self'; base-uri 'none'");
const send=(code,d)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
try{
if(u.pathname==='/test-report'){return send(200,{requests,rows:(await db.query('select payload from state')).rows});}
if(u.pathname==='/fixture.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(harness);}
if(u.pathname.startsWith('/rest/')||u.pathname.startsWith('/functions/')){
let text='';for await(const b of req){text+=b;if(text.length>1000000)return send(413,{});}const body=text?JSON.parse(text):null;
requests.push({method:req.method,path:u.pathname,at:new Date().toISOString()});
if(u.pathname==='/functions/v1/tochka-assistant-calendar'&&body?.action==='list')return send(200,{records:[fixture]});
if(u.pathname==='/rest/v1/rpc/tochka_visit')return send(200,true);
if(u.pathname!=='/rest/v1/user_app_data'||u.searchParams.get('user_id')!=='eq.fixture-owner')return send(403,{message:'fixture only'});
if(req.method==='GET'){const r=(await db.query('select payload,updated_at from state where user_id=$1',[id])).rows[0];return send(200,{...r,updated_at:new Date(r.updated_at).toISOString()});}
if(req.method==='PATCH'){const r=await db.query('update state set payload=$1,updated_at=$2 where user_id=$3 and updated_at=$4 returning updated_at',[body.payload,body.updated_at,id,u.searchParams.get('updated_at').slice(3)]);return send(200,r.rows.map(x=>({updated_at:new Date(x.updated_at).toISOString()})));}
return send(405,{});
}
if(u.pathname==='/narrow.html'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><title>Проверка 390px</title><iframe title="Точка дня — узкий экран" src="/index.html?device=narrow" style="width:390px;height:844px;border:0"></iframe>');}
let name=u.pathname.slice(1)||'index.html';if(!['index.html','assistant-import.js','assistant-panel.js','supabase.js'].includes(name))return send(404,{});
let content;
if(name==='supabase.js')content=fs.readFileSync(path.resolve(root,'supabase.js'),'utf8');
else content=fs.readFileSync(path.join(root,name),'utf8');
if(name==='index.html'){
content=content.replace("const KEY = 'tochka-dnya-v3';","const KEY = 'tochka-acceptance-'+(new URLSearchParams(location.search).get('device')||'a');");
content=content.replace("https://dcpthwmuiodrjepifzsd.supabase.co",'http://127.0.0.1:'+port).replace('sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt','fixture-local-only');
content=content.replace('<script src="supabase.js"></script>','<script src="supabase.js"></script><script src="fixture.js"></script>');
content=content.replace("if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){","if (false){");
content=content.replace('<title>Точка дня</title>','<title>Точка дня — изолированная проверка</title>');
}
res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':'text/html'});res.end(content);
}catch(e){send(500,{message:'fixture error'});}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
export async function close(){await new Promise(resolve=>server.close(resolve));await db.close();}

