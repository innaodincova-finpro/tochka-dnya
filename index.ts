// Лента событий «Точки дня» для подписки в календаре айфона.
// Календарь сам ходит сюда несколько раз в сутки, приложение при этом закрыто.
// Ссылка содержит секретный ключ: он и есть пропуск к своим записям.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/* В формате календаря перевод строки начинает новое поле,
   поэтому текст экранируется по правилам RFC 5545. */
function icsText(v: unknown): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .slice(0, 250);
}

function stamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/* Событие со временем описывается в местном времени пользователя:
   так календарь покажет 10:15, а не пересчитанное значение. */
function localDateTime(date: string, time: string): string {
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}

/* конец события равнялся началу, и в календаре получалась точка вместо
   интервала. По умолчанию событие занимает час. */
function plusHour(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(Date.UTC(+date.slice(0,4), +date.slice(5,7) - 1, +date.slice(8,10), h + 1, m));
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00';
}

function allDay(date: string): string {
  return date.replace(/-/g, '');
}

function nextDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

const RRULE: Record<string, string> = {
  year: 'FREQ=YEARLY',
  month: 'FREQ=MONTHLY',
  week: 'FREQ=WEEKLY',
};

function buildCalendar(payload: any, name: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tochka Dnya//Feed//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsText(name || 'Точка дня'),
    'X-PUBLISHED-TTL:PT2H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
  ];

  const push = (id: string, title: string, date: string, time: string | null,
                repeat: string | null, place: string | null, note: string | null) => {
    if (!date) return;
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + icsText(id) + '@tochka-dnya');
    lines.push('DTSTAMP:' + stamp());
    lines.push('SUMMARY:' + icsText(title));
    if (time) {
      lines.push('DTSTART:' + localDateTime(date, time));
      lines.push('DTEND:' + plusHour(date, time));
      /* напоминание за час до события со временем */
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY',
        'DESCRIPTION:' + icsText(title), 'TRIGGER:-PT1H', 'END:VALARM');
    } else {
      lines.push('DTSTART;VALUE=DATE:' + allDay(date));
      lines.push('DTEND;VALUE=DATE:' + nextDay(date));
      /* у события без времени — напоминание накануне в девять утра */
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY',
        'DESCRIPTION:' + icsText(title), 'TRIGGER:-P1DT15H', 'END:VALARM');
    }
    if (repeat && RRULE[repeat]) lines.push('RRULE:' + RRULE[repeat]);
    if (place) lines.push('LOCATION:' + icsText(place));
    if (note) lines.push('DESCRIPTION:' + icsText(note));
    lines.push('END:VEVENT');
  };

  (payload?.ev ?? []).forEach((e: any) =>
    push(e.id, e.title, e.date, e.time || null, e.repeat || null, e.address || null,
      e.plan ? 'Ориентировочно ' + e.plan : null));

  /* записи со сроком тоже должны напоминать о себе */
  (payload?.notes ?? []).forEach((n: any) => {
    if (!n.due || n.done) return;
    const title = n.items ? (n.title || 'Список') : String(n.text || '').split('\n')[0].slice(0, 90);
    const body = n.items ? n.items.map((i: any) => i.t).join(', ') : null;
    push(n.id, title, n.due, null, null, null, body);
  });

  lines.push('END:VCALENDAR');

  /* по стандарту строка не длиннее 75 октетов, длинные переносятся с пробелом */
  const folded: string[] = [];
  for (const line of lines) {
    let rest = line;
    while (new TextEncoder().encode(rest).length > 73) {
      let cut = 70;
      while (new TextEncoder().encode(rest.slice(0, cut)).length > 73) cut--;
      folded.push(rest.slice(0, cut));
      rest = ' ' + rest.slice(cut);
    }
    folded.push(rest);
  }
  return folded.join('\r\n') + '\r\n';
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';

  if (key.length < 20) {
    return new Response('Нужен ключ доступа', { status: 400 });
  }

  const query = SUPABASE_URL + '/rest/v1/user_app_data' +
    '?select=payload&payload->settings->>feedKey=eq.' + encodeURIComponent(key) + '&limit=1';

  const res = await fetch(query, {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
  });

  if (!res.ok) {
    return new Response('Хранилище недоступно', { status: 502 });
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) {
    /* ключ не подошёл — отдаём пустой календарь, а не сообщение об ошибке:
       иначе календарь айфона будет ругаться каждые два часа */
    return new Response(buildCalendar({}, 'Точка дня'), {
      headers: { 'content-type': 'text/calendar; charset=utf-8' },
    });
  }

  const payload = rows[0].payload || {};
  const name = payload?.settings?.name ? 'Точка дня — ' + payload.settings.name : 'Точка дня';

  return new Response(buildCalendar(payload, name), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=1800',
      'content-disposition': 'inline; filename="tochka-dnya.ics"',
    },
  });
});
