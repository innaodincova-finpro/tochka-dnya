import {ORIGIN,safe,services,readJSON,hash} from './common.mjs';
import {validateProposal,formatProposal} from './proposal.mjs';
export function makeHandler(env,request=fetch){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS',vary:'Origin'}});
 return async req=>{
 if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return reply({error:'origin_not_allowed'},403);
 if(req.method==='OPTIONS')return reply({ok:true});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const auth=req.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(auth))return reply({error:'sign_in_required'},401);
 try{
 const s=services(env,request),user=await s.user(auth),input=await readJSON(req);
 const own='?user_id=eq.'+encodeURIComponent(user.id);
 const fields='source_version,proposal,calendar_event,calendar_revision';
 if(input.action==='list')return reply({records:await s.db('tochka_assistant_sandbox'+own+'&select='+fields+'&order=source_version.desc&limit=100')});
 if(!['import','edit'].includes(input.action)||typeof input.version!=='string'||!Number.isFinite(Date.parse(input.version)))throw safe('invalid_request',400);
 const filter=own+'&source_version=eq.'+encodeURIComponent(input.version);
 const row=(await s.db('tochka_assistant_sandbox'+filter+'&select='+fields))[0];
 if(!row)throw safe('not_found',404);
 if(input.action==='import'&&row.calendar_event)return reply({record:row,duplicate:true});
 let p;try{p=validateProposal(input.action==='import'?row.proposal:input.proposal);}catch{throw safe('invalid_request',400);}
 if(p.kind!=='event'||formatProposal(p).needsClarification)throw safe('event_required',400);
 if(input.action==='edit'&&(!row.calendar_event||input.revision!==row.calendar_revision))return reply({error:'conflict',record:row},409);
 const event={id:'assistant_'+await hash(user.id+':'+row.source_version),title:p.title,date:p.date,time:p.time,place:p.place||'',repeat:'none'};
 const rows=await s.db('tochka_assistant_sandbox'+filter+'&calendar_revision=eq.'+row.calendar_revision+'&select='+fields,'PATCH',{calendar_event:event,calendar_revision:row.calendar_revision+1});
 if(!rows.length){const latest=(await s.db('tochka_assistant_sandbox'+filter+'&select='+fields))[0];return reply({error:'conflict',record:latest},409);}
 return reply({record:rows[0]});
 }catch(e){return reply({error:e.safe||'unavailable'},e.status||503);}
 };
}
