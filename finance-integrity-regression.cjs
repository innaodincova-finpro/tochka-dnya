const fs = require('fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
  runScripts: 'dangerously',
  url: 'https://test.invalid/',
  beforeParse(window) {
    window.confirm = () => true;
    window.scrollTo = () => {};
    window.matchMedia = () => ({matches: false, addListener() {}});
  }
});
const window = dom.window;
const run = source => window.eval(source);

try {
  run(`
    clearTimeout(cloudTimer);
    S = blank();
    S.settings.onboarded = 1;
    S.settings.cur = 'RUB';
    S.exp = [{id:'expense-kzt', title:'Покупка', cat:'Прочее', sum:12.5, cur:'KZT', date:today()}];
    S.inc = [{id:'income-azn', title:'Возврат', sum:3.25, cur:'AZN', date:today()}];
  `);

  assert.match(run("money(12.5,'RUB')"), /12,5\s*₽/, 'копейки не округляются до целого рубля');

  run("editExp('expense-kzt')");
  assert.match(window.document.getElementById('sheet-in').textContent, /Сумма, ₸/, 'форма расхода показывает валюту записи');
  window.document.getElementById('f-sum').value = '-50';
  run('saveExpEdit()');
  assert.equal(run("S.exp[0].sum"), 12.5, 'отрицательная сумма не сохраняется при редактировании расхода');
  window.document.getElementById('f-sum').value = '18.75';
  run('saveExpEdit()');
  assert.equal(run("S.exp[0].sum"), 18.75, 'положительная дробная сумма сохраняется');
  assert.equal(run("S.exp[0].cur"), 'KZT', 'редактирование сохраняет исходную валюту расхода');

  run("editInc('income-azn')");
  assert.match(window.document.getElementById('sheet-in').textContent, /Сколько, ₼/, 'форма дохода показывает валюту записи');
  window.document.getElementById('f-sum').value = '-2';
  run('saveIncEdit()');
  assert.equal(run("S.inc[0].sum"), 3.25, 'отрицательная сумма не сохраняется при редактировании дохода');

  run("openSheet('exp')");
  window.document.getElementById('f-title').value = 'Ошибка';
  window.document.getElementById('f-sum').value = '-100';
  run('saveExp()');
  assert.equal(run('S.exp.length'), 1, 'новый отрицательный расход отклоняется');

  run("openSheet('inc')");
  window.document.getElementById('f-title').value = 'Ошибка';
  window.document.getElementById('f-sum').value = '-100';
  run('saveInc()');
  assert.equal(run('S.inc.length'), 1, 'новый отрицательный доход отклоняется');

  run(`S.settings.cur='KZT'; foldOpen['fin-ops']=true; renderMoney();`);
  const expenseRow = [...window.document.querySelectorAll('#s-money .item')].find(item => item.textContent.includes('Покупка'));
  assert.equal(expenseRow.querySelector('.ic').textContent, '₸', 'значок операции соответствует её валюте');

  console.log('PASS: finance amounts stay positive, preserve decimals and keep each operation currency');
} finally {
  dom.window.close();
}
