/* Isolated proposal contract. No network, storage, auth or production writes. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;
function validate(p){
 if(!p||Object.getPrototypeOf(p)!==Object.prototype||Object.keys(p).some(k=>!['id','owner','createdAt','kind','record'].includes(k)))throw Error('Некорректное предложение');
 if(!id(p.id)||!id(p.owner)||!Number.isSafeInteger(p.createdAt))throw Error('Некорректный номер или время');
 if(!['ev','exp','notes'].includes(p.kind))throw Error('Разрешено только добавление встречи, расхода или заметки');
 const r=p.record,allowed={ev:['date','time','title','address'],exp:['date','sum','cat','title'],notes:['date','text']}[p.kind];
 if(!r||Object.getPrototypeOf(r)!==Object.prototype||Object.keys(r).some(k=>!allowed.includes(k))||!date(r.date))throw Error('Проверьте дату и поля');
 if(p.kind==='ev'&&(!text(r.title)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)))throw Error('Укажите название и точное время встречи');
 if(p.kind==='exp'&&(typeof r.sum!=='number'||!Number.isFinite(r.sum)||r.sum<=0||r.sum>1e9||!text(r.cat)||!text(r.title)))throw Error('Проверьте сумму и категорию');
 if(p.kind==='notes'&&!text(r.text))throw Error('Введите текст заметки');
 if(r.address!==undefined&&!text(r.address))throw Error('Проверьте адрес');
 return copy(p);
}
function createProposal(p){return validate(p)}
function applyToSandbox(state,p,{owner,confirmed=false,now=Date.now()}={}){
 p=validate(p);
 if(!confirmed)throw Error('Требуется подтверждение');
 if(owner!==p.owner)throw Error('Другой пользователь');
 if(p.createdAt>now||now-p.createdAt>86400000)throw Error('Предложение устарело — проверьте дату заново');
 const out=copy(state),recordId='assistant_'+p.id;
 if(!['ev','exp','notes','inc','del'].every(k=>Array.isArray(out[k])))throw Error('Некорректная тестовая база');
 if(out.del.some(x=>x.id===recordId))throw Error('Запись была удалена; повторное добавление запрещено');
 for(const k of ['ev','exp','notes','inc'])if(out[k].some(x=>x.id===recordId))throw Error('Это предложение уже применено');
 out[p.kind].push({id:recordId,...p.record});
 return out;
}
const api={createProposal,applyToSandbox};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AssistantProposals=api;
})(typeof globalThis!=='undefined'?globalThis:this);
