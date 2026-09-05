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
  assert(/сохранено/.test(w.document.getElementById('saved').textContent), 'статус автосохранения виден пользователю');

  // в каждом состоянии — законченная фраза, и всегда сказано, где запись цела
  const labels = ['local','syncing','synced','offline','error'].map(st => {
    w.eval(`cloudState = '${st}'; storageOk = true;`);
    return w.cloudLabel();
  });
  assert(labels.every(t => t.length > 8 && !/на телефоне \d/.test(t)),
    'строка сохранения не обрывается на полуслове');
  assert(/сохранено/.test(labels[3]) && /сохранено/.test(labels[4]),
    'при сбое облака и без сети сказано, что на устройстве всё цело');
  w.eval("cloudState = 'local';");
  assert(w.document.body.textContent.includes('подключить облачное сохранение'), 'предложение облачной защиты видно до входа');
  assert(w.eval("SUPABASE_KEY.startsWith('sb_publishable_')"), 'в приложении используется только публичный ключ облака');

  const event = {
    id: 'test-event', title: 'Маникюр', date: w.today(), time: '10:15',
    kind: 'plain', repeat: 'none'
  };
  w.eval(`S.ev.push(${JSON.stringify(event)})`);
  w.renderAll();
  assert(w.document.body.textContent.includes('10:15'), 'время события показывается в интерфейсе');
  w.eval("goScreen('s-cal')");   // календарь собирается, когда его открывают
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

  // ---- данные из облака и из резервной копии ----
  const oldSchema = { settings: { cur: 'RUB' }, exp: [], inc: [], ev: [] };
  assert(w.hasUserData(oldSchema) === false, 'запись старого образца не роняет проверку наличия данных');
  const fixed = w.normalize(JSON.parse(JSON.stringify(oldSchema)));
  assert(Array.isArray(fixed.notes) && fixed.day && Array.isArray(fixed.del),
    'недостающие разделы достраиваются');
  assert(fixed.settings.name !== undefined && fixed.settings.showDone !== undefined,
    'недостающие настройки достраиваются');
  w.eval(`S = normalize(${JSON.stringify(oldSchema)}); renderAll();`);
  assert(w.document.body.textContent.length > 0, 'экран рисуется на записи старого образца');

  // ---- новый телефон не должен затирать облако ----
  const cloud = w.normalize({
    settings: { cur: 'RUB', name: 'Инна' },
    exp: Array.from({ length: 40 }, (_, i) => ({ id: 'c' + i, sum: 100, cat: 'Дом', date: w.today(), cur: 'RUB' })),
    inc: [], ev: [], notes: [], day: {},
    savedAt: new Date(Date.now() - 86400000).toISOString()
  });
  const freshPhone = w.normalize({
    settings: { cur: 'RUB' },
    exp: [{ id: 'new-1', sum: 500, cat: 'Кафе', date: w.today(), cur: 'RUB' }],
    inc: [], ev: [], notes: [], day: {},
    savedAt: new Date().toISOString()
  });
  const merged = w.mergeStates(freshPhone, cloud);
  assert(merged.exp.length === 41, 'год записей из облака не стирается новым телефоном');
  assert(merged.exp.some(e => e.id === 'new-1'), 'запись, внесённая до входа в аккаунт, сохраняется');
  assert(merged.settings.name === 'Инна', 'настройки из облака подхватываются');

  // ---- удалённое остаётся удалённым ----
  const afterDelete = w.normalize({
    settings: { cur: 'RUB' }, inc: [], ev: [], notes: [], day: {},
    exp: cloud.exp.filter(e => e.id !== 'c0'),
    del: [{ id: 'c0', at: new Date().toISOString() }],
    savedAt: new Date().toISOString()
  });
  const afterMerge = w.mergeStates(afterDelete, cloud);
  assert(!afterMerge.exp.some(e => e.id === 'c0'), 'удалённая запись не возвращается после синхронизации');

  // ---- разбор надиктованного ----
  w.eval("S = blank(); S.settings.cur = 'RUB'; S.settings.onboarded = 1;");
  const say = t => w.parseSpeech(t);
  const plus = n => w.iso(new Date(Date.now() + n * 86400000));

  assert(w.parseSum('восемьсот рублей') === 800 && w.parseSum('полторы тысячи') === 1500
    && w.parseSum('сто тысяч') === 100000 && w.parseSum('две тысячи пятьсот') === 2500,
    'суммы прописью распознаются');
  assert(w.parseTime(' в десять ') === '10:00' && w.parseTime(' в пятнадцать тридцать ') === '15:30'
    && w.parseTime(' в одиннадцать ноль ноль ') === '11:00',
    'время прописью распознаётся');
  assert(w.parseDate('завтра') === plus(1) && w.parseDate('вчера') === plus(-1)
    && w.parseDate('послезавтра') === plus(2),
    'вчера, завтра и послезавтра считаются от сегодня');

  const money = say('потратила восемьсот рублей на продукты');
  assert(money.exp.length === 1 && money.exp[0].sum === 800 && money.exp[0].cat === 'Продукты',
    'расход голосом попадает в нужную категорию');
  const salary = say('получила зарплату сто тысяч');
  assert(salary.inc.length === 1 && salary.inc[0].sum === 100000 && !salary.exp.length,
    'зарплата попадает в доходы, а не в расходы');
  const meet = say('завтра в десять маникюр');
  assert(meet.ev.length === 1 && meet.ev[0].time === '10:00' && meet.ev[0].date === plus(1)
    && meet.ev[0].title === 'Маникюр',
    'событие со временем и датой раскладывается по полям');
  assert(say('купить молоко хлеб яйца').notes.length === 1, 'список покупок уходит в заметки');

  // раньше «двадцать» из даты читалось как сумма, и запись становилась расходом
  const hair = say('двадцать девятого сентября в одиннадцать ноль ноль парикмахер');
  assert(hair.ev.length === 1 && !hair.exp.length, 'дата прописью не превращает запись в расход');
  assert(hair.ev[0].date.slice(5) === '09-29' && hair.ev[0].time === '11:00' && hair.ev[0].title === 'Парикмахер',
    'число, месяц и время из даты прописью встают по местам');

  // а без даты то же слово по-прежнему трата
  const hairPaid = say('парикмахер тысяча двести рублей');
  assert(hairPaid.exp.length === 1 && hairPaid.exp[0].sum === 1200 && !hairPaid.ev.length,
    'то же слово без даты остаётся расходом');

  // раньше дата в конце фразы терялась, и дело уходило в неразобранное
  const call = say('позвонить маме завтра');
  assert(call.ev.length === 1 && call.ev[0].date === plus(1) && !call.rest.length,
    'дата в конце фразы относится к сказанному перед ней');

  // ---- облако: подменяем клиента, настоящая сеть в проверках не участвует ----
  w.eval(`
    globalThis.__sent = null; globalThis.__reset = null;
    cloudClient = {
      auth: { resetPasswordForEmail: (email) => { globalThis.__reset = email; return Promise.resolve({ error: null }); } },
      from: () => ({
        upsert: (row) => { globalThis.__sent = row; return Promise.resolve({ error: globalThis.__failPush ? { message: 'нет сети' } : null }); },
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { payload: globalThis.__remote }, error: null }) }) })
      })
    };
    cloudUser = { id: 'u1', email: 'a@b.c' };
  `);

  w.eval('globalThis.__failPush = true; cloudRetry = 0;');
  await w.eval('pushCloud()');
  assert(w.eval('cloudRetry') === 1 && w.eval('cloudState') === 'error',
    'неудачная отправка в облако ставится на повтор, а не забывается');
  w.eval('clearTimeout(cloudTimer); globalThis.__failPush = false; cloudRetry = 0;');
  await w.eval('pushCloud()');
  assert(w.eval('cloudState') === 'synced' && w.eval('cloudRetry') === 0,
    'удачная отправка сбрасывает счётчик повторов');

  const mail = w.document.createElement('input');
  mail.id = 'cloud-email'; mail.value = 'Inna@Example.COM';
  w.document.body.appendChild(mail);
  await w.eval('cloudReset()');
  assert(w.eval('globalThis.__reset') === 'inna@example.com',
    'письмо для смены пароля отправляется на указанную почту');
  mail.remove();

  // записи прежнего аккаунта не должны уехать в чужое облако
  w.eval(`
    globalThis.__remote = normalize({ settings:{cur:'RUB'}, exp:[{id:'r1',sum:10,cat:'Дом',date:today(),cur:'RUB'}],
      inc:[], ev:[], notes:[], day:{}, savedAt:new Date().toISOString() });
    globalThis.__sent = null;
    S = blank(); S.settings.cloudOwner = 'someone-else';
    S.exp = [{ id:'mine', sum:999, cat:'Дом', date:today(), cur:'RUB' }];
    cloudUser = null;
  `);
  await w.eval("connectCloudUser({id:'u1',email:'a@b.c'})");
  assert(!w.eval("S.exp.some(e => e.id === 'mine')"),
    'записи прежнего аккаунта не попадают в чужое облако');
  assert(w.eval("JSON.stringify(globalThis.__sent.payload.exp).indexOf('mine') === -1"),
    'чужие записи не отправляются на сервер');
  assert(w.eval("JSON.parse(localStorage.getItem(KEY + ':prev')).exp.some(e => e.id === 'mine')"),
    'записи прежнего аккаунта отложены, а не стёрты');

  // список покупок правится с двух телефонов: пункты не должны теряться
  const listA = w.normalize({ settings:{cur:'RUB'}, exp:[], inc:[], ev:[], day:{},
    notes:[{ id:'list-1', title:'Покупки', items:[{t:'Молоко',done:true},{t:'Хлеб',done:false}] }],
    savedAt: new Date().toISOString() });
  const listB = w.normalize({ settings:{cur:'RUB'}, exp:[], inc:[], ev:[], day:{},
    notes:[{ id:'list-1', title:'Покупки', items:[{t:'Молоко',done:false},{t:'Яйца',done:false}] }],
    savedAt: new Date(Date.now() - 60000).toISOString() });
  const lists = w.mergeStates(listA, listB).notes[0].items.map(i => i.t);
  assert(lists.indexOf('Хлеб') >= 0 && lists.indexOf('Яйца') >= 0 && lists.indexOf('Молоко') >= 0,
    'пункты списка, добавленные на разных телефонах, складываются');
  assert(lists.length === 3, 'одинаковые пункты не задваиваются');

  // ---- время, набранное на цифровой клавиатуре ----
  const timeField = w.document.createElement('input');
  w.document.body.appendChild(timeField);
  const typeTime = v => { timeField.value = v; w.fixTime(timeField); return timeField.value; };

  // раньше «0815» превращалось в 08:00 — минуты молча пропадали
  assert(typeTime('0815') === '08:15' && typeTime('1930') === '19:30' && typeTime('2359') === '23:59',
    'четыре цифры подряд читаются как часы и минуты');
  assert(typeTime('815') === '08:15' && typeTime('0000') === '00:00',
    'три цифры и полночь читаются верно');
  assert(typeTime('8') === '08:00' && typeTime('12') === '12:00',
    'одни часы без минут дополняются нулями');
  assert(typeTime('08:15') === '08:15' && typeTime('8.15') === '08:15' && typeTime('в десять') === '10:00',
    'привычные записи времени по-прежнему понимаются');
  assert(typeTime('2530') === '' && typeTime('0860') === '',
    'несуществующее время отклоняется, а не подгоняется молча');
  timeField.remove();

  // ---- кнопка на карточке должна относиться к тому, что написано рядом ----
  const farDate = w.iso(new Date(Date.now() + 9 * 86400000));
  const nearDate = w.iso(new Date(Date.now() + 2 * 86400000));
  const todayText = () => w.document.getElementById('s-today').textContent.replace(/\s+/g, ' ');

  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{ id:'far-1', date:'${farDate}', time:'08:15', title:'Работа' }]; renderAll();`);
  assert(todayText().indexOf('ничего не назначено') >= 0
    && todayText().indexOf('Перенести') < 0 && todayText().indexOf('План →') >= 0,
    'пока ближайшая неделя пуста, кнопка не предлагает перенести несуществующее');
  assert(w.document.querySelector("#s-today button[onclick*=\"editEv('far-1')\"]"),
    'до далёкого события всё же можно дойти нажатием на его название');

  w.eval(`S.ev = [{ id:'near-1', date:'${nearDate}', time:'10:00', title:'Врач' }]; renderAll();`);
  assert(todayText().indexOf('Перенести / удалить') >= 0,
    'у события на этой неделе кнопка переноса на месте');

  w.eval('S.ev = []; renderAll();');
  assert(todayText().indexOf('План →') >= 0 && todayText().indexOf('Перенести') < 0,
    'в пустом календаре предлагается перейти к плану');

  // ---- подсказки в поле события ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'h1',date:today(),title:'Работа'},{id:'h2',date:today(),title:'Маникюр'},
            {id:'h3',date:today(),title:'Работа'},{id:'h4',date:today(),title:'Работа'},
            {id:'h5',date:today(),title:'Маникюр'},{id:'h6',date:today(),title:'Врач'}];`);
  const ranked = w.eventHintList();
  assert(ranked[0] === 'Работа' && ranked[1] === 'Маникюр' && ranked[2] === 'Врач',
    'подсказки идут по частоте: что набиралось чаще, то выше');
  assert(ranked.filter(x => x === 'Маникюр').length === 1,
    'своя запись не задваивается со встроенной подсказкой');

  w.eval("openSheet('ev')");
  const box = w.document.getElementById('hints-f-title');
  const rows = () => [...box.querySelectorAll('.hint-row span')].map(b => b.textContent);
  assert(!box.classList.contains('open'), 'список закрыт, пока в поле не встали');
  w.eval("openHints('f-title')");
  assert(box.classList.contains('open') && rows()[0] === 'Работа',
    'при нажатии на поле раскрывается список, и своё стоит первым');
  assert(box.querySelector('.hint-row em'),
    'свои записи помечены, чтобы отличать их от встроенных примеров');
  w.eval("renderHints('f-title','ма')");
  assert(rows().every(t => t.toLowerCase().includes('ма')) && rows().indexOf('Маникюр') >= 0,
    'по мере набора список сужается');
  w.eval("renderHints('f-title','вра')");
  w.eval("useHint(document.querySelector('#hints-f-title .hint-row'))");
  assert(w.document.getElementById('f-title').value === 'Врач',
    'выбор строки заполняет поле');
  assert(!box.classList.contains('open'), 'и список закрывается');

  // ---- разделение на виды события убрано ----
  assert(!w.document.getElementById('p-kind'), 'в форме события больше нет выбора вида');
  w.eval("editId = 'h1'; openSheet('evEdit')");
  assert(!w.document.getElementById('p-kind'), 'при изменении события выбора вида тоже нет');
  w.eval('editId = null; closeSheet();');

  // заблаговременное напоминание теперь даёт ежегодный повтор
  const inDays = n => w.iso(new Date(Date.now() + n * 86400000));
  w.eval(`S.ev = [{id:'yr',date:'${inDays(5)}',title:'Годовщина',repeat:'year'},
                 {id:'bd',date:'${inDays(4)}',title:'Мама',kind:'bd'}]; dropIndex();`);
  const ahead = w.todo();
  assert(ahead.some(x => x[1] === 'Годовщина'),
    'о ежегодной дате приложение предупреждает заранее без выбора вида');
  assert(ahead.some(x => x[1] === 'Мама'),
    'у прежних записей с днём рождения напоминание сохранилось');

  // ---- поле события: своё поле сверху, подсказки под ним ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'w1',date:today(),title:'Работа'},{id:'w2',date:today(),title:'Работа'},
            {id:'w3',date:today(),title:'Маникюр'}];`);
  w.eval("openSheet('ev')");
  const titleField = w.document.getElementById('f-title');
  const hintBox = w.document.getElementById('hints-f-title');
  assert(titleField.closest('.withmic') && !hintBox.closest('.withmic'),
    'подсказки стоят под полем, а не внутри строки и не сжимают ввод');
  assert(!titleField.getAttribute('list') && !w.document.querySelector('#f-hints ~ datalist'),
    'у поля события нет своего списка Safari, закрывающего форму');

  // свой вариант набирается прямо здесь и запоминается
  titleField.value = 'Косметолог';
  w.eval("renderHints('Косметолог'); saveEv();");
  assert(w.eval("S.ev.some(e => e.title === 'Косметолог')"),
    'набранный вручную вариант сохраняется');
  w.eval("openSheet('ev'); openHints('f-title');");
  assert([...w.document.querySelectorAll('#hints-f-title .hint-row span')].some(b => b.textContent === 'Косметолог'),
    'набранный вручную вариант становится подсказкой в следующий раз');
  w.eval('closeSheet();');

  const toastCount = () => w.document.querySelectorAll('#toasts .toast').length;
  w.eval("document.getElementById('toasts').innerHTML = '';");
  w.eval("toast('одно и то же'); toast('одно и то же'); toast('одно и то же');");
  assert(toastCount() === 1, 'одинаковые сообщения не копятся стопкой');

  // ---- двоеточие появляется во время набора, а не после ухода из поля ----
  const tf = w.document.createElement('input');
  w.document.body.appendChild(tf);
  const typing = seq => {
    tf.value = '';
    const steps = [];
    for (const ch of seq){ tf.value += ch; w.liveTime(tf); steps.push(tf.value); }
    return steps;
  };
  assert(typing('1015').join(',') === '1,10,10:1,10:15',
    'при наборе 1015 двоеточие встаёт сразу, не дожидаясь ухода из поля');
  assert(typing('0815').pop() === '08:15' && typing('2359').pop() === '23:59',
    'четыре цифры разделяются верно');
  assert(typing('815').join(',') === '8,8:1,8:15',
    'если час больше двух, он однозначно один: 815 это 8:15, а не 81:5');
  assert(typing('930').pop() === '9:30' && typing('8').pop() === '8',
    'три цифры и одинокий час набираются без помех');

  tf.value = '10:'; w.liveTime(tf);
  assert(tf.value === '10', 'стирание не подставляет двоеточие обратно');

  // продиктованное словами трогать нельзя
  tf.value = 'в десять пятнадцать'; w.liveTime(tf);
  assert(tf.value === 'в десять пятнадцать', 'продиктованное словами во время набора не портится');
  w.fixTime(tf);
  assert(tf.value === '10:15', 'продиктованное словами приводится к времени при уходе из поля');
  tf.remove();

  // ---- надиктованный список раскладывается по пунктам ----
  const split = t => w.splitDictatedItems(t);
  assert(split('Помидоры 5 А Лук 1 кг морковь 2 кг чеснок полкилограмма').length === 4,
    'надиктованный одной строкой список делится на пункты');
  assert(split('помидоры 5 кг лук 1 кг морковь 2 кг').join('|') === 'Помидоры 5 кг|Лук 1 кг|Морковь 2 кг',
    'название с количеством не слипается со следующим пунктом');
  assert(split('вода 5 литров и сок 2 литра').length === 2 && split('хлеб, молоко, яйца').length === 3,
    'союзы и запятые тоже разделяют пункты');

  // дробный вес диктуется по-разному и должен приводиться к одному виду
  assert(split('творог полкилограмма')[0] === 'Творог 0,5 кг', 'полкилограмма это 0,5 кг');
  assert(split('творог ноль целых пять кг')[0] === 'Творог 0,5 кг', 'ноль целых пять это 0,5');
  assert(split('творог 0 5 кг')[0] === 'Творог 0,5 кг', 'потерянная запятая в «0 5 кг» восстанавливается');
  assert(split('картошка полтора кг')[0] === 'Картошка 1,5 кг', 'полтора это 1,5');

  const area = w.document.createElement('textarea');
  w.document.body.appendChild(area);
  area.value = 'Хлеб\nМолоко'; w.spillList(area);
  assert(area.value === 'Хлеб\nМолоко', 'уже разложенный вручную список не перекраивается');
  area.value = 'помидоры 5 кг лук 1 кг'; w.spillList(area);
  assert(area.value === 'Помидоры 5 кг\nЛук 1 кг',
    'надиктованное раскладывается прямо в поле, чтобы результат было видно');
  area.remove();

  // ---- календарь показывает состояние, а не только наличие записи ----
  const day = n => w.iso(new Date(Date.now() + n * 86400000));
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'past',date:'${day(-3)}',title:'Прошло',time:'10:00'},
            {id:'closed',date:'${day(-2)}',title:'Закрыто',time:'09:00'},
            {id:'soon',date:'${day(2)}',title:'Впереди',time:'12:00'}];
    S.day['${day(-2)}'] = {done:['closed']};
    renderAll(); goScreen('s-cal');`);
  assert(w.dayState(day(-3)) === 'day-missed', 'прошедший день с неотмеченной записью выделен отдельно');
  assert(w.dayState(day(-2)) === 'day-done', 'день, где всё отмечено, выглядит иначе, чем забытый');
  assert(w.dayState(day(2)) === 'day-ahead', 'запланированное впереди остаётся спокойным');
  assert(w.dayState(day(9)) === '', 'пустой день не подсвечивается вовсе');

  assert(w.document.querySelectorAll('#s-cal .d.day-missed').length === 1
    && w.document.querySelectorAll('#s-cal .d.day-done').length === 1,
    'состояние доходит до клеток календаря');
  assert(w.document.querySelector('#s-cal .d.day-missed').getAttribute('aria-label').includes('не отмечено'),
    'состояние дня произносится вслух, а не только показывается цветом');
  assert(w.document.querySelector('#s-cal .d.day-missed').getAttribute('aria-label').includes('не отмечено'),
    'состояние дня понятно и без подписи под календарём — оно произносится вслух');

  // на экране «Сегодня» видно, что время события уже прошло
  w.eval(`nowHHMM = () => '18:00';
    S.ev = [{id:'m',date:today(),title:'Утро',time:'07:00'},
            {id:'v',date:today(),title:'Вечер',time:'23:50'}];
    renderAll();`);
  const todayBox = w.document.getElementById('s-today');
  assert(todayBox.textContent.includes('уже прошло'),
    'событие, время которого прошло, помечено прямо в списке дня');
  assert(todayBox.querySelectorAll('.tl.late').length === 1,
    'помечено только просроченное, а не всё подряд');
  w.eval("S.day[today()] = {done:['m']}; renderAll();");
  assert(!w.document.getElementById('s-today').textContent.includes('уже прошло'),
    'после отметки пометка снимается');

  // ---- напоминание в телефоне предлагается сразу, а не прячется в правке ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    globalThis.__ics = null;
    toPhoneCalendarObj = (e) => { globalThis.__ics = e; };
    openSheet('ev');`);
  assert(w.document.getElementById('f-ring'),
    'напоминание в телефоне предлагается прямо при создании события');
  w.document.getElementById('f-title').value = 'Психолог';
  w.document.getElementById('f-time').value = '10:15';
  w.document.getElementById('f-ring').checked = true;
  w.eval('saveEv()');
  assert(w.eval("S.ev.some(e => e.title === 'Психолог' && e.time === '10:15')"),
    'событие сохраняется в приложении');
  assert(w.eval("globalThis.__ics && globalThis.__ics.title === 'Психолог' && globalThis.__ics.time === '10:15'"),
    'то же событие уходит в календарь телефона одним действием');

  w.eval("globalThis.__ics = null; openSheet('ev');");
  w.document.getElementById('f-title').value = 'Без часа';
  w.document.getElementById('f-ring').checked = true;
  w.eval('saveEv()');
  assert(!w.eval('globalThis.__ics'),
    'без времени звонок не назначается');
  assert([...w.document.querySelectorAll('#toasts .toast')].some(x => x.textContent.includes('нужен час')),
    'и объяснено, почему не назначен');

  // ---- название записи не должно становиться кодом ----
  const evil = "Врач'); alert(1); //";
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'ev-evil', date:today(), title:${JSON.stringify(evil)}}];
    openSheet('ev');`);
  w.eval("openHints('f-title')");
  const chip = w.document.querySelector('#hints-f-title .hint-row');
  assert(chip && chip.getAttribute('onclick') === 'useHint(this)',
    'название не подставляется внутрь кода обработчика');
  assert(chip.dataset.v === evil, 'название передаётся как данные, а не как выражение');
  w.eval("useHint(document.querySelector('#hints-f-title .hint-row'))");
  assert(w.document.getElementById('f-title').value === evil,
    'при этом кавычки в названии не теряются');
  w.eval('closeSheet();');

  // ---- файл для календаря телефона нельзя подделать через название ----
  const forged = w.eventICS({id:'i1', date:'2026-09-10', time:'10:00',
    title:'Врач\nSUMMARY:подделка\nATTENDEE:чужой', repeat:'none'});
  const lines = forged.split('\r\n');
  assert(lines.filter(l => l.indexOf('SUMMARY') === 0).length === 1,
    'перевод строки в названии не дописывает в файл посторонние поля');
  assert(!lines.some(l => l.indexOf('ATTENDEE') === 0),
    'подставить участника через название нельзя');
  assert(w.eventICS({id:'i2', date:'2026-09-10', title:'Хлеб, молоко'}).includes('Хлеб\\, молоко'),
    'запятая в названии сохраняется, а не выбрасывается');

  // ---- имя класса не должно пересекаться с оформлением пояснений ----
  assert(!/\.hint\{[^}]*border-radius/.test(html),
    'список подсказок не перекрашивает мелкие пояснения под полями');

  // ---- сбой не оставляет белый экран ----
  w.eval("crashShown = false; document.querySelectorAll('.crashbar').forEach(x => x.remove());");
  w.eval("showCrash('что-то сломалось')");
  const crash = w.document.querySelector('.crashbar');
  assert(crash && crash.textContent.includes('Записи сохранены'),
    'при сбое человек видит сообщение и знает, что записи целы');
  assert(crash.querySelector('button'), 'и может обновить страницу одной кнопкой');
  w.eval("crashShown = false; showCrash('второй раз');");
  assert(w.document.querySelectorAll('.crashbar').length === 2 - 1 + 1,
    'сообщение не размножается бесконечно');
  w.document.querySelectorAll('.crashbar').forEach(x => x.remove());
  w.eval('crashShown = false;');

  // ---- календарь не перестраивается, пока он не открыт ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    for (let i = 0; i < 200; i++) S.ev.push({id:'p'+i, date:iso(new Date(Date.now()+(i%400)*86400000)), title:'С'+i, time:'10:00'});
    calendarMonthCount = 120; goScreen('s-cal'); goScreen('s-today');`);
  const before = w.document.querySelectorAll('#s-cal .d').length;
  w.eval("S.exp.push({id:'z',date:today(),sum:10,cat:'Дом',cur:'RUB'}); save();");
  assert(w.eval('calDirty'), 'при сохранении с другого экрана календарь только помечается устаревшим');
  assert(w.document.querySelectorAll('#s-cal .d').length === before,
    'и не перестраивается впустую');
  w.eval("goScreen('s-cal')");
  assert(!w.eval('calDirty') && w.document.querySelectorAll('#s-cal .d').length > 0,
    'при возврате в календарь он собирается заново');
  assert(w.eval('calendarMonthCount') === 12,
    'и начинается с текущего года, а не с десяти лет сразу');

  // ---- повторяющиеся события не потерялись при ускорении ----
  w.eval(`S.ev = [{id:'yr', date:'2026-03-08', title:'Годовщина', repeat:'year'}]; dropIndex();`);
  assert(w.evOf('2027-03-08').length === 1 && w.evOf('2027-03-09').length === 0,
    'ежегодное событие по-прежнему находится в будущих годах');

  // ---- наблюдения дошли до экрана ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    for (let i = 0; i < 40; i++){
      const dt = iso(new Date(Date.now() - i*86400000));
      S.exp.push({id:'o'+i, date:dt, sum:(i%7===2?3000:300), cat:(i%7===2?'Кафе':'Продукты'), cur:'RUB'});
    }
    dropIndex(); renderAll();`);
  assert(w.pickObs(), 'на таких данных приложению есть что заметить');
  assert(w.document.getElementById('s-today').textContent.includes('Нажмите, чтобы посмотреть'),
    'наблюдение показывается на экране, а не остаётся в коде');

  // ---- доходы видно, можно исправить и удалить ----
  w.eval(`S.inc.push({id:'inc-1', date:today(), title:'Зарплата', sum:100000, cur:'RUB'});
    renderAll(); goScreen('s-money'); toggleFold('fin-inc'); toggleFold('fin-ops');`);
  const moneyBox = w.document.getElementById('s-money');
  assert(moneyBox.textContent.includes('Зарплата'), 'доход виден в финансах');
  assert(moneyBox.querySelector('button[onclick*="editInc"]'), 'доход можно исправить');
  assert(moneyBox.querySelector('button[onclick*="confirmDropInc"]'), 'доход можно удалить');
  w.eval("confirmDropInc('inc-1')");
  assert(!w.eval("S.inc.some(x => x.id === 'inc-1')"), 'удаление дохода работает');
  assert(w.eval("S.del.some(x => x.id === 'inc-1')"),
    'удалённый доход не вернётся из облака');

  // ---- повтор события видно ----
  w.eval(`S.ev = [{id:'rep', date:today(), title:'Зал', time:'08:00', repeat:'week'}];
    dropIndex(); renderAll();`);
  assert(w.document.getElementById('s-today').textContent.includes('каждую неделю'),
    'повтор виден в карточке ближайшего события');
  assert(w.daySheet(w.today()).includes('каждую неделю'),
    'и в окне выбранного дня');

  // ---- у записи со сроком есть напоминание ----
  w.eval(`S.notes.push({id:'note-due', date:today(), text:'Врач', kind:'task', due:today()});
    renderAll(); editNote('note-due');`);
  assert(w.document.querySelector('#sheet-in button[onclick*="noteToPhone"]'),
    'у записи со сроком появилась кнопка напоминания');
  w.eval('closeSheet();');

  // ---- подсказки во всех полях, а не только у события ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'a1', date:today(), title:'Врач', address:'ул. Ленина, 10'},
            {id:'a2', date:today(), title:'Врач', address:'ул. Ленина, 10'}];
    S.exp = [{id:'x1', date:today(), title:'Продукты', cat:'Продукты', sum:100, cur:'RUB'},
             {id:'x2', date:today(), title:'Продукты', cat:'Продукты', sum:100, cur:'RUB'}];
    S.notes = [{id:'l1', date:today(), title:'Закуп', items:[{t:'Хлеб',done:false}]}];
    dropIndex(); renderAll();`);

  w.eval("openSheet('ev'); openHints('f-address');");
  assert(w.document.querySelector('#hints-f-address .hint-row'),
    'у адреса появились свои подсказки');
  assert(!w.document.querySelector('#sheet-in [list]'),
    'в форме события не осталось полей, открывающих панель Safari во весь экран');

  w.eval("closeSheet(); openSheet('exp'); openHints('f-title');");
  assert(w.document.querySelector('#hints-f-title .hint-row'),
    'у названия расхода появились свои подсказки');
  assert(!w.document.querySelector('#sheet-in [list]'),
    'в форме расхода тоже');

  w.eval("closeSheet(); openSheet('list'); openHints('f-list-title');");
  assert(w.document.querySelector('#hints-f-list-title .hint-row'),
    'у названия списка появились свои подсказки');
  w.eval('closeSheet();');

  assert(w.addressHints()[0] === 'ул. Ленина, 10',
    'адреса тоже сортируются по частоте, а не по порядку записи');

  // ---- поиск за пределами заметок ----
  w.eval("noteFind('врач')");
  const notesBox = w.document.getElementById('s-notes');
  assert(notesBox.textContent.includes('События') && notesBox.textContent.includes('Врач'),
    'событие находится поиском');
  w.eval("noteFind('продукты')");
  assert(w.document.getElementById('s-notes').textContent.includes('Расходы'),
    'расход находится поиском');
  w.eval("noteFind('ничегонетакого')");
  assert(w.document.getElementById('s-notes').textContent.includes('Ничего не нашлось'),
    'и честно сообщает, когда не нашлось');
  w.eval("noteFind('')");

  // ---- плановая сумма события ----
  w.eval("openSheet('ev')");
  assert(w.document.getElementById('f-sum'),
    'поле плановой суммы есть в форме, раз его значение читается при сохранении');
  w.document.getElementById('f-title').value = 'Стоматолог';
  w.document.getElementById('f-sum').value = '5000';
  w.eval('saveEv()');
  assert(w.eval("S.ev.some(e => e.title === 'Стоматолог' && e.plan === 5000)"),
    'плановая сумма сохраняется вместе с событием');

  // ---- приложение, открытое в двух местах, не затирает само себя ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.exp = [{id:'tab-mine', date:today(), sum:100, cat:'Дом', cur:'RUB'}];
    S.savedAt = new Date().toISOString();`);
  const fromOtherTab = w.eval(`JSON.stringify(normalize({
    settings:{cur:'RUB'},
    exp:[{id:'tab-other', date:today(), sum:200, cat:'Кафе', cur:'RUB'}],
    inc:[], ev:[], notes:[], day:{}, savedAt:new Date().toISOString()}))`);
  w.dispatchEvent(new w.StorageEvent('storage', {key: w.eval('KEY'), newValue: fromOtherTab}));
  assert(w.eval("S.exp.some(e => e.id === 'tab-mine')"),
    'запись этой вкладки не стирается тем, что пришло из другой');
  assert(w.eval("S.exp.some(e => e.id === 'tab-other')"),
    'запись другой вкладки подхватывается');

  w.eval(`killed('tab-other'); S.exp = S.exp.filter(e => e.id !== 'tab-other');
    S.savedAt = new Date().toISOString();`);
  w.dispatchEvent(new w.StorageEvent('storage', {key: w.eval('KEY'), newValue: fromOtherTab}));
  assert(!w.eval("S.exp.some(e => e.id === 'tab-other')"),
    'удалённая запись не возвращается из другой вкладки');

  w.dispatchEvent(new w.StorageEvent('storage', {key: 'посторонний-ключ', newValue: '{}'}));
  assert(w.eval("S.exp.some(e => e.id === 'tab-mine')"),
    'чужие ключи в памяти браузера приложение не трогает');

  // ---- одно событие не должно стоять на экране дважды ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'dup', date:today(), title:'Маникюр', time:'10:15'}];
    dropIndex(); renderAll();`);
  const todayText2 = () => w.document.getElementById('s-today').textContent.replace(/\s+/g, ' ');
  assert((todayText2().match(/Маникюр/g) || []).length === 1,
    'сегодняшнее событие перечислено один раз, а не продублировано верхней карточкой');
  assert(todayText2().includes('Дальше сегодняшнего дня пока ничего не назначено'),
    'верхняя карточка честно говорит, что дальше пусто');

  w.eval(`S.ev.push({id:'nxt', date:iso(new Date(Date.now()+3*86400000)), title:'Врач', time:'09:00'});
    dropIndex(); renderAll();`);
  assert(todayText2().includes('Врач') && (todayText2().match(/Маникюр/g) || []).length === 1,
    'верхняя карточка показывает то, что будет после сегодня');

  // ---- разбор по экранам ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.name = 'Инна';
    S.ev = [{id:'s1', date:today(), title:'Маникюр', time:'10:15'}];
    S.notes = [{id:'s2', date:today(), kind:'task', text:'Позвонить маме', due:iso(new Date(Date.now()-2*86400000)), done:false}];
    S.inc = [{id:'s3', date:today(), title:'Зарплата', sum:200000, cur:'RUB'}];
    S.exp = [{id:'s4', date:today(), title:'Продукты', cat:'Продукты', sum:5000, cur:'RUB'}];
    dropIndex(); renderAll();`);

  const today2 = () => w.document.getElementById('s-today').textContent.replace(/\s+/g, ' ');
  assert(today2().indexOf('срок прошёл') < today2().indexOf('Сегодня'),
    'просроченное стоит выше списка на сегодня, а не в самом низу');
  assert(today2().includes('срок прошёл 2 дня назад'),
    'срок описан по-человечески, а не «было на 3 сентября»');

  w.eval("goScreen('s-notes')");
  assert(w.document.getElementById('s-notes').textContent.includes('срок прошёл'),
    'в заметках срок описан теми же словами, что и на «Сегодня»');
  assert(!w.document.getElementById('n-kind-pick'),
    'вид записи выбирается один раз — вкладкой, а не ещё и переключателем в форме');
  assert(w.document.getElementById('s-notes').textContent.includes('Новое дело'),
    'форма подписана тем, что именно она создаёт');

  w.eval("goScreen('s-money')");
  const m2 = w.document.getElementById('s-money').textContent.replace(/\s+/g, ' ');
  assert((m2.match(/Расходы за период/g) || []).length === 1,
    'заголовок «Расходы за период» не повторяется дважды подряд');
  assert(m2.includes('Осталось'),
    'приложение считает остаток, раз обе цифры у него есть');
  w.eval("S.exp.push({id:'s5', date:today(), title:'Крупное', cat:'Дом', sum:300000, cur:'RUB'}); dropIndex(); renderAll();");
  assert(w.document.getElementById('s-money').textContent.includes('Перерасход'),
    'и честно называет перерасход, когда потрачено больше, чем пришло');

  w.eval("goScreen('s-more')");
  assert(!w.document.getElementById('s-more').textContent.includes('Финансовые настройки'),
    'валюта настраивается в одном месте, а не в двух');

  // окно дня подписывает запись по её виду
  w.eval("S.notes.push({id:'s6', date:today(), kind:'task', text:'Дело на сегодня', due:today(), done:false}); dropIndex();");
  const sheet = w.daySheet(w.today());
  assert(sheet.includes('>дело<') && !sheet.includes('>заметка<'),
    'дело в окне дня подписано делом, а не заметкой');

  // меню добавления не смешивает разные виды под одной кнопкой
  w.eval("openSheet('quick')");
  const menu = w.document.getElementById('sheet-in').textContent;
  assert(menu.includes('Событие с датой') && menu.includes('Дело с галочкой') && menu.includes('Заметка'),
    'событие, дело и заметка разведены по отдельным кнопкам');
  assert(!menu.includes('Дело или событие'),
    'одна кнопка больше не обещает две разные вещи');
  w.eval('closeSheet();');

  // ---- длинная заметка не занимает весь экран ----
  const recipe = 'Аджика на зиму — двойная порция\nПолучится примерно 12–14 банок по 500 мл: ' +
    'помидоры 5 кг; перец 2 кг; морковь 1 кг; яблоки 1 кг; чеснок 400 г; масло 400 мл; ' +
    'сахар 200 г; соль 4 ложки; уксус 200 мл. Овощи измельчите, варите 60 минут.';
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.notes = [{id:'long', date:today(), kind:'note', text:${JSON.stringify(recipe)}},
               {id:'short', date:today(), kind:'task', text:'Глобус закуп', done:false}];
    noteOpen = {}; renderAll(); goScreen('s-notes'); setNotesTab('note');`);
  const notesText = () => w.document.getElementById('s-notes').textContent.replace(/\s+/g, ' ');

  assert(notesText().includes('Аджика на зиму') && !notesText().includes('варите 60 минут'),
    'длинная заметка показана первой строкой, а не целиком');
  const more = w.document.querySelector('.note-more');
  assert(more && more.textContent.includes('читать целиком'),
    'есть кнопка, чтобы раскрыть');
  const collapsed = notesText().length;

  w.eval("toggleNoteText('long')");
  assert(notesText().includes('варите 60 минут'), 'по нажатию текст раскрывается целиком');
  assert(notesText().length > collapsed, 'развёрнутый вид длиннее свёрнутого');
  assert(w.document.querySelector('.note-more').textContent.includes('свернуть'),
    'и её же можно свернуть обратно');
  w.eval("toggleNoteText('long')");
  assert(!notesText().includes('варите 60 минут'), 'сворачивание работает');

  assert(!w.document.querySelector('.note-more[onclick*="short"]'),
    'короткой записи кнопка раскрытия не нужна');
  w.eval("setNotesTab('task')");
  assert(!notesText().includes('Добавлено сегодня · создано'),
    'подпись не повторяет одно и то же дважды');

  // ---- дела, заметки и списки лежат отдельно ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.notes = [{id:'b1', date:today(), kind:'task', text:'Глобус закуп', done:false},
               {id:'b2', date:today(), kind:'task', text:'Позвонить врачу', done:false},
               {id:'b3', date:today(), kind:'note', text:'Аджика на зиму — рецепт'},
               {id:'b4', date:today(), title:'Покупки', items:[{t:'Хлеб', done:false}]}];
    noteQuery = ''; renderAll(); goScreen('s-notes');`);
  const box3 = () => w.document.getElementById('s-notes').textContent.replace(/\s+/g, ' ');

  assert(w.eval("S.settings.notesTab") === 'task',
    'приложение открывается на делах — том, что требует действия');
  assert(box3().includes('Глобус закуп') && !box3().includes('Аджика'),
    'на вкладке дел рецепта нет');

  w.eval("setNotesTab('note')");
  assert(box3().includes('Аджика') && !box3().includes('Глобус закуп'),
    'заметки лежат отдельно от дел');
  w.eval("setNotesTab('list')");
  assert(box3().includes('Покупки') && !box3().includes('Аджика'),
    'списки лежат отдельно от заметок');

  const tabButtons = [...w.document.querySelectorAll('#s-notes .switch button')];
  assert(tabButtons.length === 3 && tabButtons[0].textContent.includes('2'),
    'на вкладках видно, сколько невыполненного в каждой');

  w.eval("noteFind('аджика')");
  assert(w.document.getElementById('s-notes').textContent.includes('Аджика'),
    'поиск ищет по всем вкладкам сразу, не только по открытой');
  assert(!w.document.querySelector('#s-notes .switch'),
    'во время поиска вкладки не мешают');
  w.eval("noteFind('')");

  // новая запись попадает на свою вкладку и открывает её
  w.eval("setNotesTab('list');");
  w.eval(`S.notes.push({id:'b5', date:today(), kind:'note', text:'Новая мысль'});
    S.settings.notesTab = 'note'; renderNotes();`);
  assert(box3().includes('Новая мысль'), 'сохранённая заметка видна сразу, без поиска по вкладкам');

  // ---- перечень внутри заметки читается, а не идёт простынёй ----
  const adjika = 'Аджика на зиму — двойная порция Получится примерно 12–14 банок: ' +
    '* помидоры — 5 кг; * перец — 2 кг; * морковь — 1 кг; * чеснок — 400 г. Варите 60 минут.';
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.notesTab = 'note';
    noteOpen = {}; noteQuery = '';
    S.notes = [{id:'adj', date:today(), kind:'note', text:${JSON.stringify(adjika)}}];
    renderAll(); goScreen('s-notes');`);
  w.eval("toggleNoteText('adj')");
  const full = w.document.querySelector('.note-full');
  assert(full, 'развёрнутый текст выведен отдельным блоком во всю ширину');
  assert(!full.closest('.txt'),
    'он не зажат в узкую колонку между значком и кнопками');
  const bullets = full.textContent.split('\n').filter(l => l.trim().indexOf('•') === 0);
  assert(bullets.length === 4, 'каждый пункт перечня встал на свою строку');
  assert(bullets[0].includes('помидоры') && !full.textContent.includes('*'),
    'звёздочки заменены на нормальные маркеры');

  // обычный текст без перечня не должен ломаться
  assert(w.noteBody('Позвонить в 5*7 раз') === 'Позвонить в 5*7 раз',
    'текст с одиночной звёздочкой остаётся как был');

  // ---- поиск на виду, а не под формой ----
  const firstEl = w.document.getElementById('s-notes').firstElementChild;
  assert(firstEl && firstEl.id === 'n-q',
    'поле поиска — первое на экране, до него не надо листать');
  w.eval("noteFind('чеснок')");
  assert(w.document.getElementById('s-notes').textContent.includes('Аджика'),
    'заметка находится по слову из середины текста');
  w.eval("noteFind('')");

  // ---- порядок блоков на экране «Заметки» ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; noteQuery = ''; noteOpen = {};
    S.notes = [{id:'o1', date:today(), kind:'task', text:'Глобус закуп', done:false},
               {id:'o2', date:today(), kind:'note', text:'Аджика на зиму — рецепт. Помидоры 5 кг, перец 2 кг, чеснок 400 г. Варить 60 минут, разлить по стерилизованным банкам.'}];
    S.ev = [{id:'o3', date:today(), title:'Маникюр', time:'10:00'}];
    dropIndex(); renderAll(); goScreen('s-notes');`);
  const blocks = () => [...w.document.getElementById('s-notes').children];

  assert(blocks()[0].id === 'n-q', 'поиск всегда первый');
  assert(blocks()[1].textContent.includes('Новое дело'),
    'без поиска сначала форма записи, потом список');

  w.eval("noteFind('глобус')");
  assert(!w.document.getElementById('s-notes').textContent.includes('Новое дело'),
    'при поиске форма записи убирается — она мешает читать результаты');
  assert(blocks()[1].textContent.includes('Найдено во всех записях'),
    'результаты идут сразу под полем поиска');

  w.eval("noteFind('маникюр')");
  assert(blocks()[1].textContent.includes('События'),
    'найденное событие показано, лишнего заголовка про заметки нет');

  w.eval("noteFind('чепуха')");
  const nothingText = w.document.getElementById('s-notes').textContent;
  assert((nothingText.match(/Ничего не нашлось/g) || []).length === 1,
    'сообщение о пустом результате выводится один раз, а не двумя карточками');
  w.eval("noteFind('')");

  // развёрнутая заметка не повторяет своё начало дважды
  w.eval("setNotesTab('note'); toggleNoteText('o2');");
  const one = w.document.querySelector('.note-block').textContent;
  assert((one.match(/Аджика на зиму/g) || []).length === 1,
    'у развёрнутой заметки начало текста не показано дважды');
  assert(one.includes('свернуть'), 'кнопка сворачивания на месте');

  // ---- вкладка и форма — один выбор, а не два независимых ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; noteQuery = '';
    renderAll(); goScreen('s-notes');`);
  const formText = () => w.document.getElementById('s-notes').children[1].textContent.replace(/\s+/g, ' ');

  w.eval("setNotesTab('task'); toggleFold('new-task');");
  assert(formText().includes('Новое дело') && formText().includes('Сохранить дело'),
    'на вкладке дел форма создаёт дело');
  w.eval("setNotesTab('note'); toggleFold('new-note');");
  assert(formText().includes('Новая заметка') && formText().includes('Сохранить заметку'),
    'на вкладке заметок форма создаёт заметку');
  w.eval("setNotesTab('list'); toggleFold('new-list');");
  assert(formText().includes('Создать список') && !w.document.getElementById('n-text'),
    'на вкладке списков вместо поля текста — создание списка');
  assert(!w.document.getElementById('s-notes').textContent.match(/Новый список[\s\S]{0,40}Заметок пока нет/),
    'кнопка списка не висит на чужой вкладке');

  // что выбрано вкладкой, то и сохраняется
  w.eval("setNotesTab('note'); foldOpen['new-note'] = true; renderNotes();");
  w.document.getElementById('n-text').value = 'Рецепт аджики';
  w.eval('saveNote()');
  assert(w.eval("S.notes[0].kind") === 'note', 'на вкладке заметок сохраняется заметка');
  w.eval("setNotesTab('task'); foldOpen['new-task'] = true; renderNotes();");
  w.document.getElementById('n-text').value = 'Позвонить';
  w.eval('saveNote()');
  assert(w.eval("S.notes[1].kind") === 'task', 'на вкладке дел сохраняется дело');

  // меню добавления открывает нужную вкладку
  w.eval("focusNote('note')");
  assert(w.eval("S.settings.notesTab") === 'note',
    '«Заметка» из меню добавления открывает вкладку заметок, а не жмёт кнопку в форме');

  // ---- дописать в заметку, не открывая правку ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.notesTab = 'note';
    noteQuery = ''; noteOpen = {};
    S.notes = [{id:'ap1', date:today(), kind:'note', text:'Аджика на зиму. Помидоры 5 кг, варить 60 минут и разлить по банкам.'},
               {id:'ap2', date:today(), kind:'note', text:'Адрес мастера'}];
    renderAll(); goScreen('s-notes'); openAppend('ap1');`);
  assert(w.document.getElementById('f-append'), 'есть отдельное пустое поле для дописывания');
  assert(w.document.getElementById('sheet-in').textContent.includes('Аджика'),
    'видно, к чему дописываем');
  w.document.getElementById('f-append').value = 'Хранить в погребе';
  w.eval('saveAppend()');
  assert(w.eval("S.notes.find(n => n.id === 'ap1').text").endsWith('\nХранить в погребе'),
    'дописанное встаёт в конец новой строкой');
  assert(w.eval("!!noteOpen['ap1']"), 'заметка сразу раскрывается — видно, что получилось');

  // в список дописываются пункты, а не строка текста
  w.eval(`S.notes.push({id:'ap3', date:today(), title:'Покупки', items:[{t:'Хлеб', done:false}]});
    setNotesTab('list'); renderNotes(); openAppend('ap3');`);
  w.document.getElementById('f-append').value = 'молоко 2 литра яйца 10 штук';
  w.eval('saveAppend()');
  const items = w.eval("S.notes.find(n => n.id === 'ap3').items.map(i => i.t)");
  assert(items.length === 3 && items[2] === 'Яйца 10 шт',
    'надиктованные пункты раскладываются и не разъезжаются на числе');
  w.eval("openAppend('ap3')");
  w.document.getElementById('f-append').value = 'хлеб';
  w.eval('saveAppend()');
  assert(w.eval("S.notes.find(n => n.id === 'ap3').items.length") === 3,
    'то, что уже есть в списке, не задваивается');

  // ---- закрепление держит запись первой ----
  w.eval("setNotesTab('note'); renderNotes();");
  const firstNote = () => w.document.querySelector('#s-notes .note-block').textContent;
  const wasFirst = firstNote();
  assert(!wasFirst.includes('Аджика'), 'сначала порядок обычный');
  w.eval("togglePin('ap1')");
  assert(firstNote().includes('Аджика'), 'закреплённая поднимается наверх');
  assert(w.document.querySelector('.pin.on'), 'закреплённая помечена звездой');
  assert(w.document.querySelector('.note-block.pinned'), 'и выделена фоном');
  w.eval("togglePin('ap1')");
  assert(!firstNote().includes('Аджика'), 'открепление возвращает обычный порядок');
  assert(!w.document.querySelector('.pin.on'), 'и звезда гаснет');

  // ---- тема: не папка, а необязательная подпись с отбором ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.notesTab = 'note';
    noteQuery = ''; themeFilter = ''; noteOpen = {};
    S.notes = [{id:'th1', date:today(), kind:'note', text:'Аджика', theme:'Заготовки'},
               {id:'th2', date:today(), kind:'note', text:'Лечо', theme:'Заготовки'},
               {id:'th3', date:today(), kind:'note', text:'Плитка в ванной', theme:'Ремонт'},
               {id:'th4', date:today(), kind:'note', text:'Адрес мастера'}];
    renderAll(); goScreen('s-notes');`);
  const shown = () => w.document.querySelectorAll('#s-notes .note-block').length;
  const notesAll = () => w.document.getElementById('s-notes').textContent.replace(/\s+/g, ' ');

  assert(shown() === 4, 'без отбора видны все записи вкладки, включая записи без темы');
  const themeBtns = [...w.document.querySelectorAll('.theme')].map(b => b.textContent);
  assert(themeBtns[0] === 'Все' && themeBtns.includes('Заготовки') && themeBtns.includes('Ремонт'),
    'темы собираются сами из записей, заводить их заранее не надо');

  w.eval("setTheme('Заготовки')");
  assert(shown() === 2 && !notesAll().includes('Плитка'), 'нажатие на тему оставляет только её записи');
  assert(!notesAll().includes('Адрес мастера'), 'записи без темы в отбор не попадают');
  w.eval("setTheme('Заготовки')");
  assert(shown() === 4, 'повторное нажатие снимает отбор');

  assert(w.document.querySelector('.theme-tag'), 'тема видна прямо в строке записи');
  assert(w.hintSource('theme').indexOf('Заготовки') === 0,
    'в подсказках тем первой идёт та, что встречается чаще');

  // новая запись наследует открытую тему
  w.eval("setTheme('Ремонт')");
  assert(w.document.getElementById('f-theme').value === 'Ремонт',
    'при открытой теме форма подставляет её сама');
  w.document.getElementById('n-text').value = 'Купить плинтус';
  w.eval('saveNote()');
  assert(w.eval("S.notes.some(n => n.text.indexOf('плинтус') >= 0 && n.theme === 'Ремонт')"),
    'запись сохраняется с этой темой');

  // без темы всё продолжает работать
  w.eval("themeFilter = ''; S.notes = [{id:'th5', date:today(), kind:'note', text:'Просто мысль'}]; renderNotes();");
  assert(!w.document.querySelector('.themes'),
    'когда тем нет, полоса не занимает место');
  assert(notesAll().includes('Просто мысль'), 'записи без темы видны как обычно');

  // ---- список делится на пункты и без количеств у каждого ----
  assert(w.splitDictatedItems('помидоры 5 кг яблоки 2 кг сахар соль уксус морковь 2 кг').length === 6,
    'пункты без количества всё равно разделяются');
  assert(w.splitDictatedItems('сладкий красный перец 2 кг')[0] === 'Сладкий красный перец 2 кг',
    'прилагательные остаются при своём существительном');
  assert(w.splitDictatedItems('растительное масло 400 мл сахар 200 г').length === 2,
    'составное название не рвётся пополам');
  assert(w.splitDictatedItems('хлеб молоко яйца').length === 3,
    'три простых покупки подряд — три пункта');
  assert(w.splitDictatedItems('купить хлеб').join('') === 'Хлеб',
    'ведущий глагол не становится отдельным пунктом');
  assert(w.splitDictatedItems('острый перец 4 штуки чеснок 400 г').length === 2,
    'счётные слова не создают лишних пунктов');

  // ---- кнопки не отнимают ширину у текста ----
  const longNote = 'Аджика на зиму — двойная порция. Получится примерно 12–14 банок по 500 мл: ' +
    '* помидоры — 5 кг; * чеснок — 400 г. Варите 60 минут.';
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.notesTab = 'note';
    noteQuery = ''; themeFilter = ''; noteOpen = {};
    S.notes = [{id:'wide', date:today(), kind:'note', text:${JSON.stringify(longNote)}, theme:'Заготовки'}];
    renderAll(); goScreen('s-notes');`);
  const blockEl = w.document.querySelector('.note-block');
  assert(!blockEl.querySelector('.note-row .mini'),
    'кнопки убраны из строки с текстом — она больше не сжимается в колонку');
  assert(blockEl.querySelector('.note-tools .mini'),
    'кнопки стоят своей строкой под записью');
  assert(!blockEl.querySelector('.note-row').textContent.includes('*'),
    'в свёрнутом виде звёздочки перечня не показываются');

  // ---- при открытии экрана всё свёрнуто до заголовка ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.name = 'Инна';
    noteQuery = ''; themeFilter = ''; foldOpen = {}; noteOpen = {};
    S.notes = [{id:'f1', date:today(), title:'Покупки',
                items:[{t:'Помидоры 5 кг',done:false},{t:'Яблоки 2 кг',done:false},{t:'Сахар',done:false}]}];
    for (let i = 0; i < 6; i++) S.exp.push({id:'fx'+i, date:today(), title:'Продукты', cat:'Продукты', sum:500, cur:'RUB'});
    S.inc = [{id:'fi', date:today(), title:'Зарплата', sum:100000, cur:'RUB'}];
    dropIndex(); renderAll();`);

  assert(w.document.querySelectorAll('.fold').length > 0 &&
         w.document.querySelectorAll('.fold.open').length === 0,
    'при первом открытии ни один блок не развёрнут');

  const seen = id => {
    const el = w.document.getElementById(id);
    const was = el.hidden; el.hidden = false;
    const t = el.textContent.replace(/\s+/g, ' ');
    el.hidden = was; return t;
  };
  assert(seen('s-today').includes('осталось 3 пункта') && !seen('s-today').includes('Помидоры'),
    'на «Сегодня» список свёрнут до итога, пункты не вываливаются');
  assert(seen('s-money').includes('6 записей') && !seen('s-money').includes('изменитьудалить'),
    'в «Финансах» операции свёрнуты до количества');
  assert(seen('s-more').includes('имя, разделы, показ выполненного') && !seen('s-more').includes('Имя в приветствии'),
    'в «Ещё» настройки свёрнуты до подписи');
  assert(!seen('s-notes').includes('Сохранить дело'),
    'форма новой записи свёрнута, а не занимает пол-экрана');

  // раскрывается нажатием и сворачивается обратно
  w.eval("toggleFold('today-list-f1')");
  assert(seen('s-today').includes('Помидоры 5 кг'), 'нажатие раскрывает содержимое');
  assert(w.document.querySelectorAll('.fold.open').length === 1, 'раскрывается только нажатый блок');
  w.eval("toggleFold('today-list-f1')");
  assert(!seen('s-today').includes('Помидоры 5 кг'), 'повторное нажатие сворачивает обратно');

  // итог по деньгам виден без раскрытия — ради него и заходят
  assert(seen('s-money').includes('Осталось'),
    'главная цифра остаётся на виду, сворачиваются только подробности');

  // ---- свернуть можно там, где закончил читать ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; S.settings.notesTab = 'note';
    noteQuery = ''; themeFilter = ''; foldOpen = {}; noteOpen = {};
    S.notes = [{id:'cl1', date:today(), kind:'note', text:'Аджика на зиму — двойная порция. Получится примерно 12–14 банок по 500 мл: * помидоры 5 кг; * чеснок 400 г. Варить час и разлить по банкам.'},
               {id:'cl2', date:today(), title:'Покупки', items:[{t:'Хлеб',done:false},{t:'Молоко',done:false}]}];
    renderAll(); goScreen('s-notes');`);

  w.document.querySelector('#s-notes .fold-head').click();
  const openBody = w.document.querySelector('.fold-body');
  assert(openBody.lastElementChild.classList.contains('fold-close'),
    'у раскрытой формы кнопка «свернуть» стоит в конце, а не только сверху');
  openBody.lastElementChild.click();
  assert(!w.document.querySelector('.fold-body'), 'нажатие на неё сворачивает блок');

  w.eval("toggleNoteText('cl1')");
  const openNote = w.document.querySelector('.note-block');
  assert(openNote.lastElementChild.classList.contains('fold-close'),
    'у раскрытой заметки тоже есть «свернуть» под текстом');
  openNote.lastElementChild.click();
  assert(!w.document.querySelector('.note-full'), 'заметка сворачивается снизу');

  w.eval("setNotesTab('list'); toggleFold('list-cl2');");
  const openList = w.document.querySelector('#s-notes .note-block');
  assert(openList.lastElementChild.classList.contains('fold-close'),
    'у раскрытого списка «свернуть» под пунктами');
  openList.lastElementChild.click();
  assert(!w.document.querySelector('#s-notes .tick'), 'список сворачивается снизу');

  // ---- в формах нет пояснительных подписей ----
  const teaching = [
    'Не папка: можно не заполнять',
    'Заметку не нужно выполнять',
    'Дело отмечается галочкой. Дату можно поставить позже',
    'У каждого пункта в списке будет своя галочка',
    'Статус применяется к делам',
    'Запись появится в плане на выбранную дату',
    'Событие живёт в календаре, дело отмечается галочкой',
    'Войдите один раз, чтобы записи автоматически',
    'Точнее всего получается, когда вы записываете',
    'Состав по позициям в коде не записан',
    'Расходы в разных валютах не складываются'
  ];
  teaching.forEach(t => assert(!html.includes(t),
    'убрана подпись-инструкция: ' + t.slice(0, 34)));
  assert(!html.includes('class="hint"'),
    'мелких пояснений под полями не осталось');

  // ---- «План» и окно дня ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; foldOpen = {};
    S.ev = [{id:'pl1', date:today(), title:'Маникюр', time:'10:15'}];
    S.notes = [{id:'pl2', date:today(), title:'Покупки',
                items:[{t:'Хлеб',done:false},{t:'Молоко',done:false}], due:today()}];
    dropIndex(); renderAll(); goScreen('s-cal');`);
  const calText = w.document.getElementById('s-cal').textContent.replace(/\s+/g, ' ');

  assert(!w.document.querySelector('.cal-legend') && !html.includes('cal-legend'),
    'подпись про цвета убрана — она объясняла то, что видно и так');
  assert(calText.trim().indexOf('Сентябрь') < 12 || calText.trim().indexOf('Январь') < 12 ||
         /^[А-Я][а-я]+ \d{4}/.test(calText.trim()),
    'календарь начинается с месяца, а не с пояснений');
  assert(calText.includes('Покупки') && !calText.includes('Покупки: Хлеб'),
    'в клетке у списка только название, без перечня пунктов');

  const sheetToday = w.daySheet(w.today());
  const dayHead = sheetToday.slice(sheetToday.indexOf('day-sheet-date'), sheetToday.indexOf('</div>'));
  assert(!dayHead.includes(w.today().slice(0,4)),
    'в заголовке дня текущего года год не повторяется');
  assert(w.daySheet('2027-03-08').includes('2027'),
    'а для другого года год остаётся');
  assert(sheetToday.includes('Покупки: Хлеб, Молоко'),
    'в окне дня состав списка виден — там для него есть место');

  // ---- количество без названия не становится отдельным пунктом ----
  assert(w.splitDictatedItems('5 кг картошки помидор 2 кг')[0] === '5 кг картошки',
    'количество, названное раньше товара, остаётся при нём');
  assert(w.splitDictatedItems('купить 5 килограмм картошки помидор 2 кг').length === 2,
    'обрывок «5 кг» не превращается в отдельную покупку');
  assert(!w.splitDictatedItems('картошка 5 кг помидор 2 кг огурцов лук 1 кг').some(x => x === '5 кг'),
    'пункта без названия в списке не остаётся');

  // ---- единица без числа означает одну ----
  assert(w.splitDictatedItems('лук килограмм')[0] === 'Лук 1 кг',
    '«килограмм» без числа — это один килограмм');
  assert(w.splitDictatedItems('молоко литр хлеб')[0] === 'Молоко 1 л',
    '«литр» без числа — это один литр');
  assert(w.splitDictatedItems('сахар 200 грамм')[0] === 'Сахар 200 г' &&
         w.splitDictatedItems('яйца 10 штук')[0] === 'Яйца 10 шт',
    'единицы после числа записываются коротко');

  // ---- в окнах нет объяснений, только поля и кнопки ----
  w.eval("S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; renderAll();");
  const sheetText = k => { w.eval("openSheet('" + k + "')");
    return w.document.getElementById('sheet-in').textContent.replace(/\s+/g, ' ').trim(); };

  const voiceSheet = sheetText('voice');
  assert(!voiceSheet.includes('Скажите всё подряд') && !voiceSheet.includes('Например') &&
         !voiceSheet.includes('Что не разберётся'),
    'в окне диктовки убраны подсказки и примеры — пример остался в самом поле');
  assert(voiceSheet.includes('Разложить по полям'), 'кнопка на месте');

  const welcomeSheet = sheetText('welcome');
  assert(!welcomeSheet.includes('Дела с датой и временем') && !welcomeSheet.includes('Ежедневные расходы'),
    'первый запуск спрашивает имя и валюту, а не пересказывает разделы');

  assert(!sheetText('backup').includes('Держите копию'),
    'в окне копии остались только действия');
  w.eval('closeSheet();');

  // ---- у времени такие же подсказки, как у остальных полей ----
  w.eval(`S = blank(); S.settings.onboarded = 1; S.settings.hi = 1;
    S.ev = [{id:'t1', date:today(), title:'Маникюр', time:'10:15'},
            {id:'t2', date:today(), title:'Врач', time:'10:15'},
            {id:'t3', date:today(), title:'Зал', time:'19:30'}];
    dropIndex(); renderAll(); openSheet('ev'); openHints('f-time');`);
  const timeRows = () => [...w.document.querySelectorAll('#hints-f-time .hint-row span')].map(x => x.textContent);

  assert(timeRows()[0] === '10:15',
    'у времени есть подсказки, и чаще назначенный час стоит первым');
  assert(w.document.querySelector('#hints-f-time .hint-row em'),
    'своё время помечено, как и в других полях');
  w.eval("renderHints('f-time','10')");
  assert(timeRows().every(t => t.indexOf('10') >= 0),
    'по мере набора список сужается');
  w.eval("useHint(document.querySelector('#hints-f-time .hint-row'))");
  assert(w.document.getElementById('f-time').value === '10:15',
    'выбор подставляет время в поле');
  w.eval('closeSheet();');

  // ---- ошибки облака говорят по-русски и подсказывают, что делать ----
  const errText = m => w.cloudErrorText({message: m});
  assert(errText('For security purposes, you can only request this after 0 seconds.').includes('Подождите минуту'),
    'ограничение по частоте объяснено словами, а не ответом сервера');
  assert(errText('User already registered').includes('«Войти»'),
    'при существующем аккаунте сказано, какую кнопку нажать');
  assert(errText('Invalid login credentials').includes('Забыли пароль?'),
    'при неверном пароле показан путь к восстановлению');
  assert(errText('Email not confirmed').includes('письмо'),
    'неподтверждённая почта объяснена');
  assert(errText('Failed to fetch').includes('интернет'),
    'обрыв связи назван обрывом связи');
  assert(errText('Signups not allowed for this instance').includes('приглашение'),
    'при закрытой регистрации сказано, что нужно приглашение');
  ['For security', 'User already', 'Invalid login', 'Failed to fetch', 'Нечто неизвестное'].forEach(m =>
    assert(!/[a-z]{4,}/.test(errText(m)), 'в сообщении нет английских слов: ' + m.slice(0, 20)));

  // ---- лента для календаря айфона ----
  w.eval("S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; cloudUser = null; renderAll();");
  const key1 = w.feedKey();
  assert(key1.length >= 40, 'ключ ленты длинный и случайный — подобрать его нельзя');
  assert(w.feedKey() === key1, 'ключ не меняется при каждом обращении');
  assert(w.eval("S.settings.feedKey") === key1, 'ключ хранится вместе с записями и уезжает в облако');
  assert(w.feedUrl('webcal').indexOf('webcal://') === 0 && w.feedUrl('webcal').includes(key1),
    'ссылка для подписки собрана с ключом');

  w.eval("openSheet('feed')");
  assert(w.document.getElementById('sheet-in').textContent.includes('подключите облачное'),
    'без аккаунта лента не предлагается — она берётся из облака');

  w.eval("cloudUser = {id:'u', email:'a@b.c'}; openSheet('feed');");
  const feedSheet = w.document.getElementById('sheet-in').textContent.replace(/\s+/g, ' ');
  assert(w.document.getElementById('f-feed').value === w.feedUrl('webcal'),
    'ссылка показана целиком и её можно скопировать');
  assert(feedSheet.includes('Подписной календарь'),
    'три шага настройки на месте — это делается один раз');
  assert(w.document.querySelectorAll('#sheet-in .steps li').length === 3,
    'шагов ровно три, без лишних объяснений');
  w.eval('closeSheet(); cloudUser = null;');

  // ---- разделы можно скрыть, у каждого свой набор ----
  w.eval("S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; foldOpen = {}; renderAll(); goScreen('s-more'); toggleFold('more-set');");
  const visibleTabs = () => [...w.document.querySelectorAll('.tabs button')].filter(b => !b.hidden).length;

  assert(visibleTabs() === 5, 'по умолчанию видны все пять разделов');
  assert(w.document.querySelectorAll('#s-more .askring').length === 3,
    'скрыть можно три раздела — «Сегодня» и «Ещё» остаются всегда');

  w.eval("toggleScreen('s-money')");
  assert(visibleTabs() === 4 && w.document.getElementById('tab-money').hidden,
    'выключенный раздел уходит из нижней панели');
  assert(w.eval("S.exp !== undefined"), 'записи при этом остаются на месте');

  w.eval("goScreen('s-cal'); toggleScreen('s-cal');");
  assert(w.eval('curScreen') === 's-today',
    'если выключить открытый раздел, приложение уводит на «Сегодня», а не оставляет на пустом');

  w.eval("toggleScreen('s-money'); toggleScreen('s-cal');");
  assert(visibleTabs() === 5, 'разделы возвращаются');

  w.eval("S.settings.hidden = {'s-money':1}; renderAll();");
  assert(w.document.getElementById('tab-money').hidden,
    'настройка применяется при запуске, а не только при нажатии');

  // ---- ссылку на календарь можно сменить, если она утекла ----
  w.eval("S = blank(); S.settings.onboarded = 1; S.settings.hi = 1; cloudUser = {id:'u', email:'a@b'}; renderAll(); openSheet('feed');");
  const oldKey = w.feedKey();
  assert(w.document.querySelector('#sheet-in button[onclick*="resetFeed"]'),
    'в окне календаря есть кнопка смены ссылки');
  w.eval('resetFeed()');
  const newKey = w.feedKey();
  assert(newKey !== oldKey && newKey.length === oldKey.length,
    'ключ меняется на новый такой же длины');
  assert(w.document.getElementById('f-feed').value.includes(newKey),
    'в поле сразу показана новая ссылка');
  assert(!w.document.getElementById('f-feed').value.includes(oldKey),
    'старая ссылка больше нигде не фигурирует');
  w.eval('closeSheet(); cloudUser = null;');

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
