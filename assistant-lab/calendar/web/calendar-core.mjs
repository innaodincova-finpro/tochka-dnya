const uid=()=>crypto.randomUUID().replaceAll('-','');
function blank(){
  return {
    settings:{cur:'RUB', hidden:{}, notesTab:'task', name:'', showDone:1, theme:'light', reminderMode:'hour', onboarded:0, hi:1},
    exp:[], inc:[], ev:[], notes:[], day:{}, del:[], savedAt:null, backupAt:null, firstDataAt:null
  };
}

/* Записи приходят из трёх мест: из памяти телефона, из файла резервной копии
   и из облака. Раньше достройка недостающих полей была только у первого,
   поэтому запись старого образца из облака или из копии роняла экран.
   Теперь любые данные проходят здесь. */
const DEL_KEEP_DAYS = 180;
function validateData(raw){
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v+'T12:00:00Z')) && new Date(v+'T12:00:00Z').toISOString().slice(0,10) === v;
  if (!obj(raw)) throw new Error('Некорректная структура копии');
  for (const k of ['exp','inc','ev','notes']) {
    if (raw[k] === undefined) continue;
    if (!Array.isArray(raw[k])) throw new Error('Некорректный раздел: '+k);
    const ids = new Set();
    for (const r of raw[k]) {
      if (!obj(r) || !date(r.date)) throw new Error('Запись без корректной даты: '+k);
      if (r.id && (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(r.id) || ids.has(r.id))) throw new Error('Некорректный или повторный номер записи');
      if (r.id) ids.add(r.id);
      if ((k==='exp'||k==='inc') && (!['number','string'].includes(typeof r.sum) || (typeof r.sum==='string' && !r.sum.trim()) || !Number.isFinite(Number(r.sum)))) throw new Error('Некорректная сумма');
      if (k==='ev' && (typeof r.title!=='string' || (r.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)))) throw new Error('Некорректное событие');
      if (k==='notes' && ((r.text!==undefined && typeof r.text!=='string') || (r.due && !date(r.due)) || (r.items!==undefined && (!Array.isArray(r.items)||r.items.some(i=>!obj(i)||typeof i.t!=='string'))))) throw new Error('Некорректная заметка');
    }
  }
  if (raw.del!==undefined && (!Array.isArray(raw.del) || raw.del.some(x=>
    !obj(x) || typeof x.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(x.id) ||
    (x.at!==undefined && (typeof x.at!=='string' || !date(x.at.slice(0,10)) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x.at) || !Number.isFinite(Date.parse(x.at))))
  ))) throw new Error('Некорректные отметки удаления');
  if (raw.settings!==undefined && !obj(raw.settings)) throw new Error('Некорректные настройки');
  if (raw.day!==undefined && (!obj(raw.day)||Object.entries(raw.day).some(([d,r])=>!date(d)||!obj(r)||(r.done!==undefined&&!Array.isArray(r.done))))) throw new Error('Некорректные отметки календаря');
  return raw;
}
function mergeDeletionMarks(left,right){
  const marks=new Map();
  for(const x of [...(left||[]),...(right||[])]){
    const old=marks.get(x.id);
    // Legacy marks without a timestamp remain protective until explicitly restored.
    const stamp=v=>v.at===undefined?Infinity:Date.parse(v.at);
    if(!old || stamp(x)>stamp(old))marks.set(x.id,{id:x.id,...(x.at===undefined?{}:{at:new Date(x.at).toISOString()})});
  }
  return [...marks.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
function normalize(raw){
  if (raw != null) validateData(raw);
  const b = blank();
  const d = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? JSON.parse(JSON.stringify(raw)) : {};
  for (const k in b){
    if (Array.isArray(b[k])) d[k] = Array.isArray(d[k]) ? d[k] : [];
    else if (b[k] && typeof b[k] === 'object') d[k] = (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) ? d[k] : {};
    else if (d[k] === undefined) d[k] = b[k];
  }
  for (const k in b.settings) if (d.settings[k] === undefined) d.settings[k] = b.settings[k];
  /* запись без своего номера нельзя сравнить с такой же на другом телефоне */
  ['exp','inc','ev','notes'].forEach(k => {
    d[k] = d[k].filter(r => r && typeof r === 'object');
    d[k].forEach(r => { if (!r.id) r.id = uid(); });
  });
  const edge = Date.now() - DEL_KEEP_DAYS * 86400000;
  d.del = mergeDeletionMarks(d.del,[])
    .filter(x => !(x.at && new Date(x.at).getTime() < edge));
  return d;
}
const cloneState = x => JSON.parse(JSON.stringify(x));
function stable(x){
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  if(x && typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
function mergeThree(base, local, remote, choice){
  [base,local,remote].forEach(validateData);
  const revived=new Set();
  const eq=(a,b)=>stable(a)===stable(b);
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  function merge(b,l,r,path){
    if(path==='del')return mergeDeletionMarks(l,r);
    if(eq(l,r))return l;
    if(eq(l,b))return r;
    if(eq(r,b))return l;
    if(['exp','inc','ev','notes'].includes(path)){
      const map=a=>Object.fromEntries((a||[]).map(x=>[x.id,x]));
      const bm=map(b),lm=map(l),rm=map(r);
      return [...new Set([...Object.keys(lm),...Object.keys(rm)])].sort().map(id=>merge(bm[id],lm[id],rm[id],path+'.'+id)).filter(x=>x!==undefined);
    }
    if(path==='savedAt'||path==='backupAt')return [l,r].filter(Boolean).sort().pop()||null;
    if(object(l)&&object(r)&&(object(b)||b===undefined)){
      const out={};
      for(const k of new Set([...Object.keys(l),...Object.keys(r),...Object.keys(b||{})])){
        const v=merge((b||{})[k],l[k],r[k],path?path+'.'+k:k);if(v!==undefined)out[k]=v;
      }
      return out;
    }
    if(choice){const picked=choice==='local'?l:r;const parts=path.split('.');if(parts.length===2&&['exp','inc','ev','notes'].includes(parts[0])&&picked!==undefined)revived.add(parts[1]);return picked;}
    const e=new Error('Одна запись изменена в двух местах. Выберите версию в разделе «Ещё».');e.conflict=true;throw e;
  }
  const out=cloneState(merge(base,local,remote,''));
  out.del=mergeDeletionMarks(local.del,remote.del).filter(x=>!revived.has(x.id));
  const dead=new Set(out.del.map(x=>x.id));
  for(const k of ['exp','inc','ev','notes'])out[k]=(out[k]||[]).filter(x=>!dead.has(x.id));
  return normalize(out);
}

export {blank,validateData,normalize,mergeThree};
