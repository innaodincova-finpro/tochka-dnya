/* Проверки «Точки дня».
   Запуск:  npm i jsdom  &&  node proverki.js
   Файл index.html должен лежать рядом.
   Проверки не трогают ваши данные — приложение поднимается в памяти. */
const {JSDOM} = require('jsdom'), fs = require('fs');
const dom = new JSDOM(fs.readFileSync(__dirname + '/index.html', 'utf8'),
  {runScripts:'dangerously', pretendToBeVisual:true, url:'https://x/'});
const w = dom.window;
w.addEventListener('error', e => console.log('ОШИБКА:', e.message));

setTimeout(() => {
  const out = w.eval(`(function(){
    const r = []; const T = (n,c) => r.push([n, !!c]);
    const reset = () => { S.exp=[]; S.inc=[]; S.ev=[]; S.notes=[]; S.dreams=[]; S.day={}; S.settings.cur='RUB'; };
    try{

      /* --- разбор надиктованного --- */
      reset();
      T('«Зарплата 100 000» → сумма отдельно', parseSum(' Зарплата 100 000 ')===100000 && clean('Зарплата 100 000')==='Зарплата');
      T('«получила зарплату сто тысяч»', parseSum(' получила зарплату сто тысяч ')===100000);
      T('«аванс сорок пять тысяч» не теряет слово', clean('аванс сорок пять тысяч')==='Аванс');
      T('«вчера» понимается', parseDate('вчера зарплата') < today());
      T('падеж выправляется', clean('получила зарплату')==='Зарплата');

      /* --- списки покупок --- */
      reset();
      const l = makeNote('так зайти сегодня в пятёрку купить яйца творог хлеб');
      T('список разложен на пункты', l.items && l.items.length===3);
      T('магазин узнан', l.where==='Пятёрочка');
      T('слово-паразит срезано', !/^Так/.test(l.text));
      T('прилагательное не оторвано',
        makeNote('купить туалетную бумагу и молоко').items.map(i=>i.t).join('|')==='Туалетная бумага|Молоко');
      S.notes.push(l);
      tickItem(l.id, 0);
      T('галочка убирает пункт', l.items.filter(i=>!i.done).length===2);
      untickList(l.id);
      T('«вернуть» восстанавливает', l.items.filter(i=>!i.done).length===3);

      /* --- заметки: правка и напоминания --- */
      reset();
      const n = makeNote('завтра сходить в озон забрать доставки');
      S.notes.push(n);
      T('заметка с датой получила напоминание', !!n.due);
      T('напоминание видно в календаре', dueOn(n.due).length===1);
      editNoteId = n.id; n.due = today();
      T('в день напоминания попадает на «Сегодня»', dueNotes().length===1);
      clearDue(n.id);
      T('«снять» убирает напоминание, заметку оставляет', !n.due && S.notes.length===1);

      /* --- наблюдения: молчание при малых данных --- */
      reset();
      T('на пустой базе наблюдений нет', allObs().length===0);
      for (let i=0;i<5;i++) S.exp.push({id:uid(),date:today(),sum:300,cat:'Кафе',title:'Кофе',cur:'RUB'});
      T('пяти трат недостаточно', allObs().length===0);
      reset();
      for (let i=0;i<42;i++){
        const dt = new Date(Date.now()-i*86400000);
        S.exp.push({id:uid(),date:iso(dt),sum:dt.getDay()===5?3000:300,cat:'Продукты',title:'п',cur:'RUB'});
      }
      const wd = obsWeekday();
      T('день недели найден', !!wd);
      T('в намёке нет цифр', wd && !/[0-9]/.test(wd.teaser));
      const flat = S.exp.map(e=>Object.assign({},e,{sum:500}));
      const keep = S.exp; S.exp = flat;
      T('при ровных тратах вывода нет', obsWeekday()===null);
      S.exp = keep;

      /* --- валюта --- */
      reset();
      addExp({title:'Продукты',sum:5000,cat:'Продукты'});
      const rub = spentMonth(monthOf(today()));
      setCur('AZN');
      T('смена валюты не переписывает прошлые траты', spentMonth(monthOf(today()))===0);
      T('о другой валюте приложение сообщает', otherCurs(monthOf(today())).length===1);
      setCur('RUB');
      T('возврат валюты возвращает сумму', spentMonth(monthOf(today()))===rub);

      /* --- неполный месяц --- */
      reset();
      const m = monthOf(today()), pm = prevMonth(m), d = dayNow();
      for (let i=1;i<=daysInMonth(pm);i++) S.exp.push({id:uid(),date:pm+'-'+String(i).padStart(2,'0'),sum:100,cat:'Продукты',title:'п',cur:'RUB'});
      for (let i=1;i<=d;i++) S.exp.push({id:uid(),date:m+'-'+String(i).padStart(2,'0'),sum:100,cat:'Продукты',title:'т',cur:'RUB'});
      T('равные отрезки дают равные суммы', spentUpTo(m,d)===spentUpTo(pm,d));

      /* --- кнопка внизу --- */
      const names = ['s-today','s-cal','s-money','s-notes'].map(id => { setDock(id); return document.getElementById('dock-tx').textContent; });
      T('подпись кнопки меняется по разделам', new Set(names).size===4);

      /* --- ничего не падает --- */
      reset(); save();
      T('пустое приложение рисуется', document.getElementById('s-today').innerHTML.length > 100);
      tickItem('нет-такого',0); clearDue('нет-такого'); editNote('нет-такого');
      T('битые ссылки не ломают приложение', true);

    }catch(e){ r.push(['ИСКЛЮЧЕНИЕ: '+e.message+' | '+e.stack.split('\\n')[1], false]); }
    return r;
  })()`);
  out.forEach(([n,ok]) => console.log(ok ? '✓' : '✗', n));
  const bad = out.filter(x => !x[1]).length;
  console.log(bad ? '\n' + bad + ' проверок не прошло' : '\nВсе ' + out.length + ' проверок прошли');
  process.exit(bad ? 1 : 0);
}, 800);
