const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/',pretendToBeVisual:true,beforeParse(w){w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});w.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';}});
const w=dom.window;

setTimeout(()=>{
 try{
  w.eval(`clearTimeout(cloudTimer);S=blank();S.settings.onboarded=1;const d=today();S.ev=[{id:'e1',date:d,title:'Встреча',kind:'plain'}];S.notes=[{id:'t1',due:d,date:d,text:'Дело',kind:'task',done:false},{id:'n1',due:d,date:d,text:'Заметка',kind:'note',done:false},{id:'l1',due:d,date:d,title:'Список',items:['Пункт'],kind:'note',done:false}];dateIndex=null;`);
  const entries=w.eval('calendarEntries(today())');
  assert.deepEqual(Array.from(entries,x=>x.type),['event','task','note','list']);
  const month=w.eval('monthCalendar(monthOf(today()))');
  for(const type of ['event','task'])assert(month.includes(`type-${type}`));
  assert(html.includes("day-preview.type-note:before{color:#4287A9}"));
  assert(html.includes("day-preview.type-list:before{color:#4E8C78}"));
  assert(html.includes('.d.day-missed')&&html.includes('.d.day-done'));
  assert(html.includes('.day-preview.day-more:before{content:none}'));
  console.log('PASS calendar record colors; missed and completed day states retained');
 }finally{dom.window.close();}
},200);
