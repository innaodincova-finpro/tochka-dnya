import {ORIGIN,safe,services,readJSON} from './common.mjs';
import {validateProposal,formatProposal} from './proposal.mjs';
export function makeHandler(env,request=fetch){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS',vary:'Origin'}});
 return async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return reply({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return reply({ok:true});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  const auth=req.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(auth))return reply({error:'sign_in_required'},401);
  try{
   const s=services(env,request),u=await s.user(auth),input=await readJSON(req);
   if(!['status','confirm'].includes(input?.action))throw safe('invalid_request',400);
   const filter='?user_id=eq.'+encodeURIComponent(u.id);
   if(input.action==='confirm'){
    if(typeof input.version!=='string'||!Number.isFinite(Date.parse(input.version)))throw safe('invalid_request',400);
    let proposal;try{proposal=validateProposal(input.proposal);}catch{throw safe('invalid_request',400);}if(formatProposal(proposal).needsClarification)throw safe('incomplete',409);
    const saved=await s.db('rpc/tochka_assistant_sandbox_confirm','POST',{p_user:u.id,p_version:input.version,p_expected:proposal});
    if(saved.error)throw safe(saved.error,409);return reply(saved);
   }
   const row=(await s.db('tochka_assistant_pilot'+filter+'&select=pending,pending_at,enabled_at,enabled'))[0];
   let draft=null;
   if(row?.enabled&&row.pending&&Date.parse(row.pending_at)>Date.now()-1800000&&Date.parse(row.pending_at)>=Date.parse(row.enabled_at)){
    try {const p=validateProposal(row.pending);draft={proposal:p,version:row.pending_at,complete:!formatProposal(p).needsClarification};}catch{}
   }
   const records=await s.db('tochka_assistant_sandbox'+filter+'&select=source_version,proposal,created_at&order=created_at.desc,source_version.desc&limit=100');
   return reply({draft,records});
  }catch(e){return reply({error:e.safe||'invalid_or_unavailable'},e.status||503);}
 };
}
