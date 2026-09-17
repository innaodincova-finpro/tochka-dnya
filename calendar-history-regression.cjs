const fs = require('fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
  runScripts: 'dangerously',
  url: 'https://test.invalid/',
  beforeParse(window) {
    window.scrollTo = () => {};
    window.matchMedia = () => ({matches: false, addListener() {}});
  }
});
const window = dom.window;
const run = source => window.eval(source);

try {
  run(`clearTimeout(cloudTimer); S=blank(); S.settings.onboarded=1; renderAll(); goScreen('s-cal');`);
  assert.equal(run('calendarPastMonthCount'), 0, 'по умолчанию календарь не перегружен историей');
  assert.match(window.document.getElementById('s-cal').textContent, /Показать предыдущие 12 месяцев/, 'история доступна явной кнопкой');
  const previous = run("addMonths(monthOf(today()),-1)");
  const previousDaySelector = `[onclick="openDay('${previous}-01')"]`;
  assert.equal(window.document.querySelector(previousDaySelector), null, 'прошлый месяц ещё не загружен');
  run('showPreviousMonths()');
  assert.equal(run('calendarPastMonthCount'), 12, 'загружен предыдущий год');
  assert.ok(window.document.querySelector(previousDaySelector), 'прошлый месяц появился в календаре');
  assert.equal(run('S.exp.length+S.inc.length+S.ev.length+S.notes.length'), 0, 'просмотр истории не меняет записи');
  console.log('PASS: calendar loads previous months on demand without changing data');
} finally {
  dom.window.close();
}
