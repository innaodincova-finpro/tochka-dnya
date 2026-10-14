const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/index.html',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});}});
const w=dom.window;
try{
  w.eval(`clearTimeout(cloudTimer);S=blank();S.settings.onboarded=1;const d=today();S.ev=[{id:'e1',date:d,title:'Встреча',kind:'plain'}];S.notes=[{id:'t1',due:d,date:d,text:'Дело',kind:'task',done:false},{id:'n1',due:d,date:d,text:'Заметка',kind:'note',done:false},{id:'l1',due:d,date:d,title:'Список',items:['Пункт'],kind:'note',done:false}];dateIndex=null;`);
  assert.deepEqual(Array.from(w.eval('calendarEntries(today())'),x=>x.type),['event','task','note','list']);
  const fixture=w.document.createElement('div');w.document.body.append(fixture);
  const css=html.split('<style>')[1].split('</style>')[0];
  assert.doesNotMatch(css,/\.d\.(?:has-plan|day-missed|day-done)\s*\{/,'статус дня не задаёт цвет');
  for(const theme of ['light','dark','berry','graphite','blue','forest']){
    w.eval(`S.settings.theme='${theme}';applyColorTheme();`);
    fixture.innerHTML=w.eval('monthCalendar(monthOf(today()))');
    assert.equal(fixture.querySelectorAll('.today').length,1,'выделен ровно один день');
    const current=fixture.querySelector('.today');
    assert.equal(current.getAttribute('aria-current'),'date','сегодня обозначено для озвучки');
    assert(current.textContent.includes('Встреча'),'записи в выделенном дне видны');
    fixture.insertAdjacentHTML('beforeend','<div class="cal continuous-cal"><button class="d"><span class="day-num">1</span></button><button class="d has-plan day-ahead"><span class="day-num">2</span></button><button class="d has-plan day-missed"><span class="day-num">3</span></button><button class="d has-plan day-done"><span class="day-num">4</span></button></div>');
    const cells=[...fixture.lastElementChild.children];
    const style=el=>{const c=w.getComputedStyle(el);return [c.background,c.borderColor,c.color,c.boxShadow]};
    for(const cell of cells.slice(1))assert.deepEqual(style(cell),style(cells[0]),'пустые, запланированные, просроченные и выполненные дни одного цвета');
    assert.notEqual(w.getComputedStyle(current).background,w.getComputedStyle(cells[0]).background,'сегодня выделяется фоном');
    fixture.innerHTML=w.eval('monthCalendar(addMonths(monthOf(today()),-1))');
    assert.equal(fixture.querySelectorAll('.today,[aria-current="date"]').length,0,'прошлый месяц не имеет ложной текущей даты');
  }
  assert.equal(w.eval('S.notes.length'),3,'оформление не меняет записи');
  console.log('PASS: all day states share one color; only today highlighted in all six themes; entries retained');
}finally{dom.window.close();}
