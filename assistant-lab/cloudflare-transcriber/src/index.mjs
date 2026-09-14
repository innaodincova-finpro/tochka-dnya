const MAX_BYTES=4*1024*1024;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const base64=buffer=>{const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);};

export default {
 async fetch(request,env){
  if(request.method!=='POST')return new Response('',{status:405,headers:{allow:'POST'}});
  if(!env.TRANSCRIBE_SECRET||!equal(request.headers.get('x-tochka-transcribe-secret'),env.TRANSCRIBE_SECRET))return new Response('',{status:401});
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_BYTES)return json({error:'too_large'},413);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)return json({error:bytes.byteLength?'too_large':'empty'},bytes.byteLength?413:400);
  try{
   const audio=base64(bytes);
   const result=await env.AI.run('@cf/openai/whisper-large-v3-turbo',{audio,task:'transcribe',language:'ru',vad_filter:true,condition_on_previous_text:false});
   const text=typeof result?.text==='string'?result.text.trim():'';
   if(!text)return json({error:'empty'},422);
   return json({text,segments:Array.isArray(result.segments)?result.segments:[]});
  }catch{return json({error:'unavailable'},503);}
 }
};
