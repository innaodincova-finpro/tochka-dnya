import test from 'node:test';
import assert from 'node:assert/strict';
import {csvRows,parseScheduleCSV,parseScheduleICS,parseScheduleSource} from './schedule-import.mjs';
const ics=body=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:source-1\r\nSUMMARY:Практика\r\n'+body+'\r\nEND:VEVENT\r\nEND:VCALENDAR';
test('CSV preserves quoted semicolons and multiline notes',()=>{
 const out=parseScheduleCSV('Название;Дата;Начало;Окончание;Примечание\n"Пара; первая";08.10.2026;14:20;15:40;"строка 1\nстрока 2"');
 assert.equal(out.issues.length,0);assert.equal(out.events[0].title,'Пара; первая');assert.equal(out.events[0].note,'строка 1\nстрока 2');assert.equal(out.events[0].date,'2026-10-08');assert.equal(out.events[0].endTime,'15:40');
});
test('CSV chooses separator outside quotes, preserves Unicode and escaped quotes',()=>{
 assert.deepEqual(csvRows('"название;ещё",date\n"А ""Б""",2026-10-08'),[['название;ещё','date'],['А "Б"','2026-10-08']]);
});
test('CSV rejects malformed quoted structure',()=>{assert.throws(()=>csvRows('a,b\n"x'),/кавычки/);assert.throws(()=>csvRows('a,b\n"x"y,z'),/кавычки/);});
test('CSV reports every invalid date or ambiguous year without guessing',()=>{
 const out=parseScheduleCSV('Название;Дата;Время\nПервое;31.02.2026;10:00\nВторое;08.10;14:20\nТретье;08.10.2026;25:00');assert.equal(out.events.length,0);assert.equal(out.issues.length,3);
});
test('CSV retains date-only events without invented reminder time',()=>{
 const out=parseScheduleCSV('Название,Дата\nСдать работу,2026-10-08');assert.equal(out.events[0].time,'');assert.equal(out.issues.length,0);
});
test('CSV identical duplicates skip but conflicting detail is reported',()=>{
 const out=parseScheduleCSV('Название;Дата;Начало;Окончание\nПара;08.10.2026;14:20;15:40\nПара;08.10.2026;14:20;15:40\nПара;08.10.2026;14:20;16:10');assert.equal(out.events.length,1);assert.equal(out.duplicates,2);assert.equal(out.issues.length,1);
});
test('CSV formula and shifted columns are not treated as successful rows',()=>{
 const out=parseScheduleCSV('Название;Дата\n"=HYPERLINK(""url"")";08.10.2026\nПара;08.10.2026;extra');assert.equal(out.issues.length,2);assert.equal(out.events.length,0);
});
test('CSV accepts the structured teaching schedule',()=>{
 const out=parseScheduleCSV('Дисциплина;Вид занятия;Дата;Начало;Конец;Преподаватель\nМатематика;Лекция;09.10.2026;14:20;15:40;Преподаватель');assert.equal(out.summary.classes,1);assert.equal(out.events[0].endTime,'15:40');assert.equal(out.issues.length,0);
});
test('ICS UTC converts into selected timezone including date rollover',()=>{
 const out=parseScheduleICS(ics('DTSTART:20261008T223000Z\r\nDTEND:20261008T233000Z'),{timeZone:'Europe/Moscow'});assert.equal(out.issues.length,0);assert.equal(out.events[0].date,'2026-10-09');assert.equal(out.events[0].time,'01:30');assert.equal(out.events[0].endTime,'02:30');
});
test('ICS UTC and floating time require explicit timezone',()=>{
 assert.equal(parseScheduleICS(ics('DTSTART:20261008T142000')).issues.length,1);assert.equal(parseScheduleICS(ics('DTSTART:20261008T142000Z')).issues.length,1);
});
test('ICS explicit matching TZID, UID and SEQUENCE are retained',()=>{
 const out=parseScheduleICS(ics('DTSTART;TZID=Europe/Moscow:20261008T142000\r\nDTEND;TZID=Europe/Moscow:20261008T154000\r\nSEQUENCE:3'),{timeZone:'Europe/Moscow'});assert.equal(out.issues.length,0);assert.equal(out.events[0].sourceKey,'ics:source-1');assert.equal(out.events[0].sequence,3);
});
test('ICS repeats, cancellations, missing date and contradictory end remain visible',()=>{
 for(const body of ['DTSTART:20261008T142000Z\r\nRRULE:FREQ=WEEKLY','DTSTART:20261008T142000Z\r\nEXDATE:20261008T142000Z','DTSTART:20261008T142000Z\r\nSTATUS:CANCELLED','DTSTART:20260231T142000Z','DTSTART:20261008T142000Z\r\nDTEND:20261008T132000Z']){const out=parseScheduleICS(ics(body),{timeZone:'Europe/Moscow'});assert.equal(out.events.length,0);assert.equal(out.issues.length,1);assert.ok(out.issues[0].text);}
});
test('ICS all-day event preserves exclusive end date and no invented hour',()=>{
 const out=parseScheduleICS(ics('DTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261009'));assert.equal(out.issues.length,0);assert.equal(out.events[0].time,'');assert.equal(out.events[0].allDay,true);assert.equal(out.events[0].endDate,'2026-10-09');
});
test('ICS folded text and escaped punctuation survive parsing',()=>{
 const out=parseScheduleICS(ics('DTSTART;VALUE=DATE:20261008\r\nDESCRIPTION:Первая\\n\r\n строка\\, вторая'));assert.equal(out.events[0].note,'Первая\nстрока, вторая');
});
test('ICS incompatible zones and broken framing do not invent events',()=>{
 assert.equal(parseScheduleICS(ics('DTSTART;TZID=America/New_York:20261008T142000'),{timeZone:'Europe/Moscow'}).events.length,0);assert.equal(parseScheduleICS('BEGIN:VEVENT\nDTSTART:20261008T142000Z\nEND:VEVENT').issues.length,1);
});
test('source parsing is read-only, explicitly rejects unconnected OCR formats',async()=>{
 const input={format:'text',text:'Практическое занятие по дисциплине Русский язык и культура речи  08.10.2026 14:20 — 15:40'};const prior=JSON.stringify(input);const out=await parseScheduleSource(input);assert.equal(JSON.stringify(input),prior);assert.equal(out.events[0].date,'2026-10-08');assert.equal(out.events[0].time,'14:20');await assert.rejects(()=>parseScheduleSource({format:'pdf',bytes:new Uint8Array()}),/распознавания/);
});
