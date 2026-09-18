// Stable executable acceptance matrix for the intent boundary. Expected
// meanings are shared by all users; this is not a personalized phrase list.
// Model-routed cases use a synthetic provider in local tests. Run the same
// matrix against the configured model only after a separate cost approval.
export const SEMANTIC_CORPUS=[
 {text:'Зайти в аптеку в 19.00.',route:'local',proposal:{kind:'event',title:'Зайти в аптеку',date:'2026-09-13',time:'19:00'}},
 {text:'Мне надо зайти в аптеку сегодня вечером в 19:00',route:'model',proposal:{kind:'event',title:'Зайти в аптеку',date:'2026-09-13',time:'19:00'}},
 {text:'В аптеку к семи вечера',route:'model',proposal:{kind:'event',title:'В аптеку',date:'2026-09-13',time:'19:00'}},
 {text:'Позвонить маме завтра в 10:00',route:'local',proposal:{kind:'event',title:'Позвонить маме',date:'2026-09-14',time:'10:00'}},
 {text:'Не забыть позвонить маме завтра',route:'model',proposal:{kind:'event',title:'Позвонить маме',date:'2026-09-14'}},
 {text:'Врач 18 сентября в 14:30',route:'model',proposal:{kind:'event',title:'Врач',date:'2026-09-18',time:'14:30'}},
 {text:'Во вторник стоматолог в десять утра',route:'model',proposal:{kind:'event',title:'Стоматолог',date:'2026-09-15',time:'10:00'}},
 {text:'Запланируй встречу с Ольгой',route:'model',proposal:{kind:'event',title:'Встреча с Ольгой',date:'2026-09-13'}},
 {text:'Нужно забрать документы 20 сентября',route:'model',proposal:{kind:'event',title:'Забрать документы',date:'2026-09-20'}},
 {text:'Купить лекарства завтра в 12:00',route:'model',proposal:{kind:'event',title:'Купить лекарства',date:'2026-09-14',time:'12:00'}},
 {text:'Забрать заказ из магазина в 18:00',route:'model',proposal:{kind:'event',title:'Забрать заказ из магазина',date:'2026-09-13',time:'18:00'}},
 {text:'Напомни оплатить интернет 25 сентября',route:'model',proposal:{kind:'event',title:'Оплатить интернет',date:'2026-09-25'}},
 {text:'На следующей неделе сходить в МФЦ',route:'model',proposal:{kind:'event',title:'Сходить в МФЦ'}},
 {text:'Пятёрочка 5000',route:'local',proposal:{kind:'expense',title:'Пятёрочка',date:'2026-09-13',amount:5000,currency:'RUB',category:'Продукты'}},
 {text:'В аптеке потратила 1350 рублей',route:'model',proposal:{kind:'expense',title:'Аптека',date:'2026-09-13',amount:1350,currency:'RUB',category:'Здоровье'}},
 {text:'Запиши расход: лекарства 800',route:'model',proposal:{kind:'expense',title:'Лекарства',date:'2026-09-13',amount:800,currency:'RUB',category:'Здоровье'}},
 {text:'Сегодня такси 740',route:'model',proposal:{kind:'expense',title:'Такси',date:'2026-09-13',amount:740,currency:'RUB',category:'Транспорт'}},
 {text:'Кофе триста пятьдесят рублей',route:'local',proposal:{kind:'expense',title:'Кофе',date:'2026-09-13',amount:350,currency:'RUB',category:'Кафе'}},
 {text:'Купила платье за 9000',route:'model',proposal:{kind:'expense',title:'Платье',date:'2026-09-13',amount:9000,currency:'RUB',category:'Одежда'}},
 {text:'Оплатила интернет 1200',route:'model',proposal:{kind:'expense',title:'Интернет',date:'2026-09-13',amount:1200,currency:'RUB'}},
 {text:'Магазин Магнит пять тысяч',route:'local',proposal:{kind:'expense',title:'Магазин Магнит',date:'2026-09-13',amount:5000,currency:'RUB',category:'Продукты'}},
 {text:'Запиши идею: подготовить материалы к уроку',route:'local',proposal:{kind:'note',title:'подготовить материалы к уроку'}},
 {text:'Заметка: пароль лежит в менеджере паролей',route:'local',proposal:{kind:'note',title:'пароль лежит в менеджере паролей'}},
 {text:'Сохрани мысль про новую структуру отчёта',route:'model',proposal:{kind:'note',title:'Новая структура отчёта'}},
 {text:'Нужно изучить требования кафедры',route:'model',proposal:{kind:'note',title:'Изучить требования кафедры'}},
 {text:'Аптека 19.00',route:'model',unclear:'event_or_expense'},
 {text:'Магазин вечером',route:'model',unclear:'intent'},
 {text:'Купить лекарства и записать расход 800',route:'model',unclear:'multiple_requests'},
 {text:'Сделай это потом',route:'model',unclear:'intent'},
 {text:'В семь',route:'model',unclear:'intent'}
];
