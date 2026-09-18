const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://test.invalid/',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
const w=dom.window;
try{
  const yesterday=w.iso(new Date(Date.now()-86400000));
  assert.equal(w.parseSpeech('вчера потратила 800 на продукты').exp[0].date,yesterday);
  assert.equal(w.parseSpeech('вчера получила зарплату 5000').inc[0].date,yesterday);
  assert.equal(w.parseSum('ужин с семьёй'),null);
  assert.equal(w.parseSum('встреча с Тристаном'),null);
  assert.equal(w.parseSum('встреча 18.09'),null);
  const numericDate=w.parseDate('18.09');
  assert.match(numericDate,/^\d{4}-09-18$/);
  const spokenNote=w.parseSpeech('ПРИЁМКА 18.09 — заметка');
  assert.equal(spokenNote.exp.length,0);
  assert.deepEqual([...spokenNote.notes],['ПРИЁМКА 18.09 — заметка']);
  const numericEvent=w.parseSpeech('встреча с врачом 18.09');
  assert.equal(numericEvent.exp.length,0);
  assert.equal(numericEvent.ev.length,1);
  assert.equal(numericEvent.ev[0].date,numericDate);
  assert.equal(w.parseSpeech('Пятёрочка 5000').exp[0].sum,5000);
  const monthly={date:'2026-01-31',repeat:'month'};
  assert.equal(w.occursOn(monthly,'2026-02-28'),true);
  assert.equal(w.occursOn(monthly,'2026-04-30'),true);
  assert.equal(w.occursOn(monthly,'2026-02-27'),false);
  assert.match(w.noteDue('позвонить 5 мая')||'',/-05-05$/);
  console.log('PASS audit stage 3: voice dates, exact number words, monthly clamp, 5 мая');
}finally{dom.window.close();}
