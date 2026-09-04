const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};

async function run() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/',
    beforeParse(window) {
      window.confirm = () => true;
      window.alert = () => {};
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      window.navigator.vibrate = () => {};
    }
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  const w = dom.window;

  assert(typeof w.blank === 'function', 'модель пустого первого запуска доступна');
  const empty = w.blank();
  assert(empty.ev.length === 0 && empty.notes.length === 0 && empty.exp.length === 0,
    'приложение открывается без демонстрационных записей');

  w.eval("S = blank(); S.settings.onboarded = 1; S.settings.name = 'Анастасия';");
  w.renderAll();
  assert(w.document.body.textContent.includes('Анастасия'), 'имя отображается в приветствии');
  w.eval("save()");
  assert(/телефоне|облаке/.test(w.document.getElementById('saved').textContent), 'статус автосохранения виден пользователю');
  assert(w.document.body.textContent.includes('подключить облачное сохранение'), 'предложение облачной защиты видно до входа');
  assert(w.eval("SUPABASE_KEY.startsWith('sb_publishable_')"), 'в приложении используется только публичный ключ облака');

  const event = {
    id: 'test-event', title: 'Маникюр', date: w.today(), time: '10:15',
    kind: 'plain', repeat: 'none'
  };
  w.eval(`S.ev.push(${JSON.stringify(event)})`);
  w.renderAll();
  assert(w.document.body.textContent.includes('10:15'), 'время события показывается в интерфейсе');
  assert(w.document.querySelector('#s-cal .d.has-plan'), 'дата с записью заметно выделяется в календаре');
  assert(w.document.querySelector('#s-cal').textContent.includes('Маникюр'), 'название записи видно прямо на дате');

  w.eval(`S.ev[0].address = 'ул. Ленина, 10'`);
  assert(w.daySheet(w.today()).includes('ул. Ленина, 10'), 'адрес отображается в окне выбранного дня');

  w.togglePlanDone(w.today(), 'test-event');
  assert(w.eval(`S.day[today()].done.includes('test-event')`), 'дело отмечается выполненным');
  w.togglePlanDone(w.today(), 'test-event');
  assert(!w.eval(`S.day[today()].done.includes('test-event')`), 'отметку выполнения можно снять');

  w.eval(`S.notes.push({ id: 'test-note', kind: 'task', text: 'Позвонить', date: today(), done: false })`);
  w.renderAll();
  assert(w.document.body.textContent.includes('Позвонить'), 'задача сохраняется в заметках');

  w.eval(`S.exp.push({ id: 'test-expense', what: 'Продукты', sum: 800, cat: 'Продукты', date: today(), cur: 'RUB' })`);
  w.renderAll();
  assert(w.document.body.textContent.includes('800'), 'расход отображается после сохранения');
  w.eval("S.firstDataAt = new Date(Date.now() - 8*86400000).toISOString(); S.backupAt = null");
  assert(w.backupDue(), 'через семь дней появляется напоминание о резервной копии');

  assert(html.includes('Автор идеи и концепции приложения — Одинцова И. В.'),
    'авторство указано в приложении');
  assert(!/год рождения/i.test(html), 'поле года рождения удалено');
  assert(!/рассказать подругам/i.test(html), 'кнопка рассказать подругам удалена');

  console.log(`Готово: ${checks.length} проверок пройдено.`);
  checks.forEach((item, index) => console.log(`${index + 1}. ${item}`));
  dom.window.close();
}

run().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
