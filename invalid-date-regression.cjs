const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/index.html',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
const w=dom.window,copy=x=>JSON.parse(JSON.stringify(x));
try{
  const source=w.blank();
  source.ev=[
    {id:'good',title:'Врач',date:'2026-09-30',time:'10:00'},
    {id:'bad',title:'Несуществующая встреча',date:'2026-09-31',time:'11:00'}
  ];
  const recovered=w.normalize(copy(source));
  assert.deepEqual(Array.from(recovered.ev,x=>x.id),['good']);
  assert.equal(recovered.dateErrors.length,1);
  assert.equal(recovered.dateErrors[0].record.title,'Несуществующая встреча');
  assert.equal(recovered.dateErrors[0].date,'2026-09-31');
  const other=w.blank();
  other.ev=[{id:'bad2',title:'Вторая ошибочная дата',date:'2026-02-30'}];
  const merged=w.mergeThree(w.blank(),recovered,w.normalize(other));
  assert.equal(merged.dateErrors.length,2);

  w.localStorage.setItem('tochka-dnya-v3',JSON.stringify(source));
  w.load();
  assert.equal(w.eval('loadBlocked'),false);
  assert.equal(w.eval('storageOk'),true);
  assert.deepEqual(Array.from(w.eval('S.ev.map(x=>x.id)')),['good']);
  assert.equal(w.eval('S.dateErrors[0].record.id'),'bad');

  for(const phrase of ['встреча 31 сентября','встреча тридцатого февраля']){
    const parsed=w.parseSpeech(phrase);
    assert.equal(parsed.invalidDate,true,phrase);
    assert.equal(parsed.ev.length,0,phrase);
  }
  assert.equal(w.parseSpeech('встреча 30 сентября').invalidDate,undefined);

  const note=w.blank();
  note.notes=[{id:'n1',date:'2026-09-14',text:'Позвонить',due:'2026-02-30'}];
  const noteRecovered=w.normalize(note);
  assert.equal(noteRecovered.notes.length,1);
  assert.equal(noteRecovered.notes[0].due,undefined);
  assert.equal(noteRecovered.dateErrors.some(x=>x.section==='notes.due'),true);

  console.log('PASS impossible dates rejected before save; one damaged record is quarantined without blocking valid data');
}finally{dom.window.close()}
