import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {previewSchedule,applySchedule,calendarType} from './schedule-preview.mjs';
import {dueEvents} from './supabase/functions/push/schedule.js';
const digest=async text=>createHash('sha256').update(text).digest('hex');
const state=()=>({settings:{reminderMode:'hour'},ev:[{id:'personal',date:'2026-10-08',time:'12:00',title:'Личная встреча',note:'Не менять'}],notes:[{id:'note',date:'2026-10-08',text:'Личное'}],day:{},del:[],exp:[],inc:[]});
const event=(extra={})=>({kind:'cls',date:'2026-10-08',time:'14:20',endTime:'15:40',title:'Русский язык — практическое занятие',recordType:'Практическое занятие',sourceKey:'class:3',...extra});
const parsed=(events=[event()],issues=[])=>({events,issues,summary:{classes:events.length},session:null});
const preview=(s,p=parsed(),extra={})=>previewSchedule(s,p,{target:'study',namespace:'Учебный график',digest,...extra});
test('conflicting occurrences of one ICS UID are not preselected or saved together',async()=>{
 const s=state(),p=await preview(s,parsed([event({sourceKey:'ics:same',sequence:1}),event({sourceKey:'ics:same',sequence:2,date:'2026-10-09'})]));assert.equal(p.issues.length,1);assert.ok(p.items.every(i=>i.kind==='possible'));assert.throws(()=>applySchedule(s,p,[0,1],{excludeIssues:true}),/одну/);
});
test('separate preparation stages of one work keep four independent identities',async()=>{
 const s=state(),events=['Определить уровень','Пройти первый блок','Пройти второй блок','Пройти третий блок'].map((title,i)=>event({kind:'other',sourceKey:'work:W10:Подготовка',title:'Подготовка: '+title,date:'2026-10-'+String(12+i).padStart(2,'0')}));
 const p=await preview(s,parsed(events));assert.equal(new Set(p.items.map(i=>i.record.id)).size,4);const r=applySchedule(s,p,[0,1,2,3]);assert.equal(r.added,4);
});
test('adding study events preserves personal records, notes, completion and original state',async()=>{
 const s=state();s.day['2026-10-08']={done:['personal']};const old=structuredClone(s);const p=await preview(s);const r=applySchedule(s,p,[0]);assert.deepEqual(s,old);assert.deepEqual(r.state.ev[0],s.ev[0]);assert.deepEqual(r.state.notes,s.notes);assert.deepEqual(r.state.day,s.day);assert.equal(calendarType(r.state.ev[1]),'study');assert.equal(r.state.ev[1].time,'14:20');assert.equal(r.state.ev[1].endTime,'15:40');assert.equal(r.state.ev[1].kind,'plain');
});
test('repeat import is idempotent, missing events in partial files are preserved',async()=>{
 let s=state();s=applySchedule(s,await preview(s,parsed([event(),event({sourceKey:'class:4',time:'16:10',endTime:'17:30'})])),[0,1]).state;
 const p=await preview(s);assert.equal(p.items[0].kind,'same');const r=applySchedule(s,p,[0]);assert.equal(r.added,0);assert.equal(r.state.ev.length,3);
});
test('date moves require explicit confirmation; source and manual edit remain visible',async()=>{
 let s=applySchedule(state(),await preview(state()),[0]).state;const id=s.ev[1].id;s.ev[1].title='Моя правка';
 const p=await preview(s,parsed([event({date:'2026-10-09'})]));assert.equal(p.items[0].kind,'change');assert.match(p.items[0].message,/вручную/);
 assert.equal(applySchedule(s,p,[]).state.ev[1].title,'Моя правка');const r=applySchedule(s,p,[0]);assert.equal(r.updated,1);assert.equal(r.state.ev[1].id,id);assert.equal(r.state.ev[1].date,'2026-10-09');
});
test('deletion marks prevent automatic resurrection, including after normal tombstone expiry',async()=>{
 let s=applySchedule(state(),await preview(state()),[0]).state;const e=s.ev.pop();s.settings.scheduleDeleted={[e.id]:true};const p=await preview(s);assert.equal(p.items[0].kind,'restore');assert.equal(applySchedule(s,p,[]).added,0);const r=applySchedule(s,p,[0]);assert.equal(r.restored,1);assert.equal(r.state.settings.scheduleDeleted[e.id],undefined);
});
test('stale preview rejects changes to calendar or other sections',async()=>{
 const s=state(),p=await preview(s);s.notes[0].text='Новая правка';assert.throws(()=>applySchedule(s,p,[0]),/изменился/);
});
test('unresolved rows need explicit exclusion; no default successful partial parse',async()=>{
 const s=state(),p=await preview(s,parsed([event()],[{row:2,message:'Неясная дата'}]));assert.throws(()=>applySchedule(s,p,[0]),/Уточните/);assert.equal(applySchedule(s,p,[0],{excludeIssues:true}).excludedIssues,1);
});
test('same personal event does not get copied into study or automatically reclassified',async()=>{
 const s=state();s.ev[0]={...s.ev[0],title:event().title,time:'14:20'};const p=await preview(s);assert.equal(p.items[0].kind,'same');assert.match(p.items[0].message,/другом календаре/);assert.equal(applySchedule(s,p,[0]).state.ev.length,1);assert.equal(calendarType(s.ev[0]),'personal');
});
test('ICS UID remains stable across filenames and lower SEQUENCE cannot overwrite',async()=>{
 let s=state();const e=event({sourceKey:'ics:university-1',sequence:3});s=applySchedule(s,await preview(s,parsed([e])),[0]).state;
 const p=await preview(s,parsed([event({sourceKey:e.sourceKey,sequence:2,date:'2026-10-09'})]),{namespace:'Другой файл'});assert.equal(p.items[0].kind,'same');assert.match(p.items[0].message,/более новая/);assert.equal(applySchedule(s,p,[0]).updated,0);
});
test('session is information, no invented January events',async()=>{
 const s=state(),source=parsed();source.session={from:'2026-12-24',to:'2027-01-26'};const r=applySchedule(s,await preview(s,source),[0]);assert.equal(r.state.ev.length,2);assert.equal(r.state.settings.scheduleSessions.study.to,'2027-01-26');
});
test('imported timed events use existing one-hour and three-hour reminders',async()=>{
 let s=applySchedule(state(),await preview(state()),[0]).state;const at=Date.parse('2026-10-08T10:20:00Z');assert.equal(dueEvents(s,'Europe/Moscow',at).filter(x=>x.key.includes('sched_')).length,1);
 s.settings.reminderMode='three-and-hour';assert.equal(dueEvents(s,'Europe/Moscow',at-7200000).filter(x=>x.key.includes('sched_')).length,1);s.day['2026-10-08']={done:[s.ev[1].id]};assert.equal(dueEvents(s,'Europe/Moscow',at).filter(x=>x.key.includes('sched_')).length,0);
});
test('missing time has no invented push schedule; plan actions remain incomplete',async()=>{
 let s=applySchedule(state(),await preview(state(),parsed([event({time:'',endTime:'',planOnly:true})])),[0]).state;assert.equal(dueEvents(s,'Europe/Moscow',Date.parse('2026-10-08T10:20:00Z')).filter(x=>x.key.includes('sched_')).length,0);assert.deepEqual(s.day,{});assert.equal(s.ev[1].planOnly,true);
});
