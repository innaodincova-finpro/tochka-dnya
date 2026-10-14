const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /option value="light"[^>]*>Светлая тема<\/option>/, 'Нет светлой темы');
assert.match(html, /option value="dark"[^>]*>Тёмная тема<\/option>/, 'Нет тёмной темы');
assert.match(html, /option value="berry"[^>]*>Сиренево-ягодная<\/option>/, 'Нет дополнительной темы');
assert.match(html, /\[data-theme="light"\]\{/, 'Светлая палитра не отделена');
assert.match(html, /selected === 'dark' \|\| selected === 'berry'/, 'Дополнительная тема не применяется');
assert.match(html, /theme === 'berry' \? '#7052A5'/, 'Цвет панели телефона не меняется вместе с темой');
assert.match(html, /const APP_VERSION = '5\.9\.13'/, 'Не обновлена версия приложения');

console.log('✓ Доступны светлая, тёмная и сиренево-ягодная темы');

// Проверяем выбор, сохранение, повторное открытие и возврат к прежним темам.
const {JSDOM} = require('jsdom');
function openApp(saved) {
  return new JSDOM(html, {runScripts:'dangerously',url:'https://theme.test/index.html',pretendToBeVisual:true,
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
      if(saved)w.localStorage.setItem('tochka-dnya-v3',saved);
    }});
}
const app=openApp();
try {
  const w=app.window;
  w.eval("S=blank();S.settings.onboarded=1;S.notes=[{id:'theme-note',text:'Сохранить запись',kind:'note',date:today()}];renderAll();goScreen('s-more');foldOpen['more-set']=true;renderMore();");
  for(const [theme,label,color] of [['graphite','Графит','#26313D'],['blue','Синий','#244D70'],['forest','Хвойный','#285749']]){
    const select=w.document.querySelector('#s-more select[onchange="setColorTheme(this.value)"]');
    assert.equal(select.querySelector(`option[value="${theme}"]`).textContent,label);
    select.value=theme;select.dispatchEvent(new w.Event('change'));
    assert.equal(w.document.documentElement.dataset.theme,theme);
    assert.equal(w.document.querySelector('meta[name="theme-color"]').content,color);
    const saved=w.localStorage.getItem('tochka-dnya-v3');
    assert.equal(JSON.parse(saved).settings.theme,theme);
    assert.equal(JSON.parse(saved).notes[0].text,'Сохранить запись');
    const reopened=openApp(saved);
    try{assert.equal(reopened.window.document.documentElement.dataset.theme,theme);}finally{reopened.window.close();}
  }
  for(const theme of ['light','dark','berry']){
    w.setColorTheme(theme);assert.equal(w.document.documentElement.dataset.theme,theme);
  }
  w.setColorTheme('unknown');assert.equal(w.document.documentElement.dataset.theme,'light');
  console.log('PASS: three neutral themes persist after reopening; original themes and records retained');
} finally {app.window.close();}
