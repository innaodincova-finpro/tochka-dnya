const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://test.invalid/',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
const w=dom.window;
try{
  const yesterday=w.iso(new Date(Date.now()-86400000));
  assert.equal(w.parseSpeech('вчера потратила 800 на продукты').exp[0].date,yesterday);
  assert.equal(w.parseSpeech('вчера получила зарплату 5000').inc[0].date,yesterday);
  assert.equal(w.parseSum('ужин с семьёй'),null);
  assert.equal(w.parseSum('встреча с Тристаном'),null);
  const monthly={date:'2026-01-31',repeat:'month'};
  assert.equal(w.occursOn(monthly,'2026-02-28'),true);
  assert.equal(w.occursOn(monthly,'2026-04-30'),true);
  assert.equal(w.occursOn(monthly,'2026-02-27'),false);
  assert.match(w.noteDue('позвонить 5 мая')||'',/-05-05$/);
  console.log('PASS audit stage 3: voice dates, exact number words, monthly clamp, 5 мая');
}finally{dom.window.close();}
