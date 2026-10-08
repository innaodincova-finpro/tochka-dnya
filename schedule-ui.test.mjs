import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import fs from 'node:fs';import {JSDOM,VirtualConsole} from 'jsdom';
import {createScheduleUI} from './schedule-import-ui.mjs';
const text='Практическое занятие по дисциплине Русский язык и культура речи  08.10.2026 14:20 — 15:40';
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function fixture(extra={}){
 const dom=new JSDOM('<div id="sheet-in"></div>');const doc=dom.window.document;let state={settings:{},ev:[],notes:[],day:{},del:[]},owner='account-A',saved=0,toast='';let ui;
 const env={document:doc,state:()=>state,owner:()=>owner,begin(){},close:()=>ui.cancel(),toast:s=>toast=s,calendar(){},commit:next=>{state=next;saved++;},digest:async s=>createHash('sha256').update(s).digest('hex'),...extra};ui=createScheduleUI(env);
 const el=id=>doc.getElementById(id);const fill=()=>{el('schedule-name').value='График';el('schedule-text').value=text;};
 return {dom,doc,ui,el,fill,env,get state(){return state;},get saved(){return saved;},get toast(){return toast;},setOwner(value){owner=value;}};
}
test('source -> preview -> save: no premature mutation, repeat and cancel are safe',async()=>{
 const f=fixture();try{f.ui.open('study');f.fill();f.el('schedule-check').click();await flush();assert.equal(f.saved,0);assert.match(f.doc.body.textContent,/Новых: 1/);f.el('schedule-save').click();assert.equal(f.saved,1);assert.equal(f.state.ev.length,1);assert.match(f.doc.body.textContent,/Добавлено на устройстве/);f.ui.open('study');f.fill();f.el('schedule-check').click();await flush();assert.match(f.doc.body.textContent,/Уже есть: 1/);f.el('schedule-save').click();assert.equal(f.saved,1);f.el('schedule-cancel').click();assert.equal(f.ui.active(),false);}finally{f.dom.window.close();}
});
test('all view requires explicit destination; back preserves source text',async()=>{
 const f=fixture();try{f.ui.open('all');f.fill();f.el('schedule-check').click();await flush();assert.match(f.doc.body.textContent,/Выберите календарь/);assert.equal(f.saved,0);f.el('schedule-target').value='study';f.el('schedule-check').click();await flush();f.el('schedule-back').click();assert.equal(f.el('schedule-text').value,text);}finally{f.dom.window.close();}
});
test('storage failure does not show success; preview remains retryable',async()=>{
 const f=fixture({commit:()=>{throw new Error('Нет места');}});try{f.ui.open('study');f.fill();f.el('schedule-check').click();await flush();f.el('schedule-save').click();assert.match(f.toast,/Нет места/);assert.equal(f.state.ev.length,0);assert.ok(f.el('schedule-save'));assert.doesNotMatch(f.doc.body.textContent,/Добавлено на устройстве/);}finally{f.dom.window.close();}
});
test('cancellation and account change invalidate pending asynchronous parsing',async()=>{
 let release;const f=fixture({parse:()=>new Promise(r=>release=r)});try{f.ui.open('study');f.fill();f.el('schedule-check').click();await flush();f.setOwner('account-B');release({events:[],issues:[]});await flush();assert.equal(f.saved,0);assert.equal(f.el('schedule-save'),null);f.ui.cancel();assert.equal(f.ui.active(),false);}finally{f.dom.window.close();}
});
test('unparsed text shown and cannot be silently saved as complete',async()=>{
 const f=fixture();try{f.ui.open('study');f.fill();f.el('schedule-text').value+='\nНЕЯСНЫЙ СРОК';f.el('schedule-check').click();await flush();assert.match(f.doc.body.textContent,/НЕЯСНЫЙ СРОК/);f.el('schedule-save').click();assert.equal(f.saved,0);f.el('schedule-exclude').checked=true;f.el('schedule-save').click();assert.equal(f.saved,1);}finally{f.dom.window.close();}
});
test('full app separates calendars, preserves notes, renders complete times and saves atomically',()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://example.invalid/tochka-dnya/',virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});}});const run=s=>dom.window.eval(s);
 try{
  run("clearTimeout(cloudTimer);S=blank();S.settings.onboarded=1;S.ev=[{id:'personal',title:'Личная встреча',date:today(),time:'10:00'},{id:'study',title:'Занятие',date:today(),time:'14:20',endTime:'15:40',calendarType:'study',planOnly:true}];S.notes=[{id:'note',date:today(),due:today(),text:'Личная заметка'}];dropIndex();goScreen('s-cal');");
  run("setPlanCalendar('personal')");assert.equal(run('calendarEntries(today()).length'),2);run("setPlanCalendar('study')");assert.equal(run('calendarEntries(today()).length'),1);assert.match(run('daySheet(today())'),/14:20–15:40/);assert.match(run('daySheet(today())'),/Плановая дата/);run("setPlanCalendar('all')");assert.equal(run('calendarEntries(today()).length'),3);assert.equal(run('S.ev.length'),2);
  const before=run('JSON.stringify(S)');run("storeLocal=()=>{throw new Error('full')}");assert.throws(()=>run("commitScheduleImport({...S,ev:[...S.ev,{id:'new',title:'Новое',date:today()}]})"),/не изменён/);assert.equal(run('JSON.stringify(S)'),before);
 }finally{dom.window.close();}
});
