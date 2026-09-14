'use strict';
const $=id=>document.getElementById(id);let pending=null,state={ev:[],exp:[],inc:[],notes:[],del:[]};
const now=new Date();$('date').value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
function clear(){pending=null;$('review').hidden=true;$('status').textContent=''}
$('kind').addEventListener('change',()=>{clear();$('time-label').hidden=$('kind').value!=='ev';for(const id of ['sum-label','cat-label'])$(id).hidden=$('kind').value!=='exp'});
$('proposal').addEventListener('input',clear);
function describe(p){const r=p.record;return ({ev:'Встреча',exp:'Расход',notes:'Заметка'})[p.kind]+' · '+r.date+'\n'+(r.title||r.text)+(r.time?' · '+r.time:'')+(r.sum?' · '+r.sum+' ₽ · '+r.cat:'')}
$('proposal').addEventListener('submit',e=>{e.preventDefault();try{const kind=$('kind').value,record={date:$('date').value};if(kind==='notes')record.text=$('text').value;else record.title=$('text').value;if(kind==='ev')record.time=$('time').value;if(kind==='exp'){record.sum=Number($('sum').value);record.cat=$('cat').value}pending=AssistantProposals.createProposal({id:crypto.randomUUID(),owner:'sandbox',createdAt:Date.now(),kind,record});$('description').textContent=describe(pending);$('review').hidden=false;$('status').textContent='Предложение подготовлено. Пока ничего не добавлено.';$('confirm').focus()}catch(e){$('status').textContent=e.message}});
$('cancel').addEventListener('click',()=>{clear();$('status').textContent='Предложение отменено.'});
$('confirm').addEventListener('click',()=>{if(!pending)return;try{state=AssistantProposals.applyToSandbox(state,pending,{owner:'sandbox',confirmed:true});const li=document.createElement('li');li.textContent=describe(pending);$('records').append(li);clear();$('status').textContent='Добавлено только в пробный список.'}catch(e){$('status').textContent=e.message}});
