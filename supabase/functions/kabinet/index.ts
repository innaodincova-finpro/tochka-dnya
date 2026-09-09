// Кабинет администратора «Точки дня».
//
// Отдаёт только числа: сколько людей, сколько у кого записей, когда заходили.
// Текстов заметок, названий событий и сумм здесь нет и быть не может —
// они не попадают в ответ ни при каких условиях. Это не обещание, а устройство:
// функция считает длины массивов и не читает их содержимое.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN = (Deno.env.get('ADMIN_EMAIL') || 'inna_odincova@mail.ru').toLowerCase();

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/* Кто спрашивает. Токен проверяет сам Supabase — подделать нельзя. */
async function whoAsks(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SERVICE_KEY, Authorization: auth },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return (u?.email || '').toLowerCase() || null;
}

function count(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/* Из записей человека берём только счётчики и даты. Тексты не трогаем. */
function digest(payload: any) {
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  const dates: string[] = [];
  const push = (arr: any) => Array.isArray(arr) && arr.forEach((x: any) => {
    if (x && typeof x.date === 'string') dates.push(x.date);
  });
  push(payload?.ev); push(notes); push(payload?.exp); push(payload?.inc);
  dates.sort();
  return {
    sobytiya: count(payload?.ev),
    zapisi: notes.length,
    dela: notes.filter((n: any) => !n.items && (n.kind || 'task') === 'task').length,
    spiski: notes.filter((n: any) => n.items).length,
    rashody: count(payload?.exp),
    dohody: count(payload?.inc),
    pervaya: dates[0] || null,
    poslednyaya: dates[dates.length - 1] || null,
    kalendar: !!payload?.settings?.feedKey,
    tema: payload?.settings?.theme === 'dark' ? 'тёмная' : 'светлая',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const email = await whoAsks(req);
  if (!email) return json({ error: 'Нужен вход в аккаунт' }, 401);
  if (email !== ADMIN) return json({ error: 'Доступ только у администратора' }, 403);

  const head = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY };

  if (!['GET', 'POST'].includes(req.method)) return json({error:'Метод не поддерживается'},405);
  const users: any[] = [];
  for (let page=1; ; page++) {
    const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=200&page='+page, {headers:head});
    if (!res.ok) return json({error:'Список людей недоступен'},502);
    const part = (await res.json())?.users;
    if (!Array.isArray(part)) return json({error:'Некорректный ответ сервиса'},502);
    users.push(...part);
    if (part.length < 200) break;
  }
  if (req.method === 'POST') {
    if (Number(req.headers.get('content-length')) > 2048) return json({error:'Запрос слишком большой'},413);
    let input;
    try { const raw=await req.text(); if(raw.length>2048)return json({error:'Запрос слишком большой'},413); input=JSON.parse(raw); }
    catch {return json({error:'Проверьте адрес почты'},400);}
    const target=String(input.email||'').trim().toLowerCase();
    if (!['invite','delete_pending'].includes(input.action) || target.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
      return json({error:'Введите корректный адрес почты'},400);
    const existing=users.find(u=>String(u.email||'').toLowerCase()===target);

    if (input.action === 'delete_pending') {
      if (target === ADMIN || !existing || input.user_id !== existing.id || input.confirm_email !== target)
        return json({error:'Пользователь изменился. Обновите список и подтвердите удаление заново.'},409);
      const protectedUser=(u: any)=>!!(u.email_confirmed_at || u.confirmed_at || u.last_sign_in_at);
      if (protectedUser(existing) || !existing.invited_at)
        return json({error:'Можно удалить только неиспользованное приглашение.'},409);
      const endpoint=SUPABASE_URL+'/auth/v1/admin/users/'+encodeURIComponent(existing.id);
      // Block new sign-ins before re-reading the account to close the read/delete race.
      const ban=await fetch(endpoint,{method:'PUT',headers:{...head,'Content-Type':'application/json'},body:JSON.stringify({ban_duration:'5m'})});
      if(!ban.ok)return json({error:'Не удалось подготовить удаление. Повторите позже.'},502);
      let removed=false;
      try {
        const fresh=await fetch(endpoint,{headers:head});
        if(!fresh.ok)return json({error:'Не удалось повторно проверить пользователя.'},502);
        const value=await fresh.json(),user=value.user||value;
        if(user.id!==existing.id || String(user.email||'').toLowerCase()!==target || protectedUser(user))
          return json({error:'Человек уже активировал доступ. Удаление отменено.'},409);
        const data=await fetch(SUPABASE_URL+'/rest/v1/user_app_data?select=user_id&user_id=eq.'+encodeURIComponent(existing.id)+'&limit=1',{headers:head});
        if(!data.ok)return json({error:'Не удалось проверить облачные сохранения. Удаление отменено.'},502);
        const saved=await data.json();
        if(!Array.isArray(saved)||saved.length)return json({error:'У пользователя есть облачные данные. Удаление отменено.'},409);
        const result=await fetch(endpoint,{method:'DELETE',headers:head});
        if(!result.ok)return json({error:'Удалить приглашение не удалось. Обновите список.'},502);
        removed=true;return json({deleted:true,email:target});
      } finally {
        if(!removed) {
          const remaining=existing.banned_until ? Math.max(0,Date.parse(existing.banned_until)-Date.now()) : 0;
          await fetch(endpoint,{method:'PUT',headers:{...head,'Content-Type':'application/json'},body:JSON.stringify({ban_duration:remaining>0?Math.ceil(remaining/1000)+'s':'none'})});
        }
      }
    }
    if (existing && (existing.email_confirmed_at || existing.last_sign_in_at))
      return json({error:'У этого человека уже есть доступ. Он может войти по почте и паролю или нажать «Забыли пароль».'},409);
    const res=await fetch(SUPABASE_URL+'/auth/v1/admin/generate_link',{
      method:'POST',headers:{...head,'Content-Type':'application/json'},body:JSON.stringify({type:'invite',email:target})
    });
    if(!res.ok)return json({error:'Не удалось создать приглашение. Повторите позже.'},502);
    const link=await res.json();
    if(!link.hashed_token || link.verification_type!=='invite')return json({error:'Сервис не вернул приглашение'},502);
    return json({email:target,url:'https://innaodincova-finpro.github.io/tochka-dnya/activate.html#token='+encodeURIComponent(link.hashed_token)+'&email='+encodeURIComponent(target)});
  }

  const dRes = await fetch(SUPABASE_URL + '/rest/v1/user_app_data?select=user_id,payload,updated_at', { headers: head });
  if(!dRes.ok)return json({error:'Данные о сохранениях недоступны. Повторите позже.'},502);
  const rows = await dRes.json();
  const byId: Record<string, any> = {};
  (Array.isArray(rows) ? rows : []).forEach((r: any) => { byId[r.user_id] = r; });

  const list = users.map((u: any) => {
    const row = byId[u.id];
    return {
      id: u.id,
      mozhno_udalit: !!u.invited_at && !u.email_confirmed_at && !u.confirmed_at && !u.last_sign_in_at && !row && String(u.email||'').toLowerCase()!==ADMIN,
      poslednee_priglashenie: u.invited_at || null,
      pochta: u.email,
      priglashen: u.created_at || null,
      podtverdil: u.email_confirmed_at || u.confirmed_at || null,
      zahodil: u.last_sign_in_at || null,
      sinhronizaciya: row?.updated_at || null,
      ...(row ? digest(row.payload || {}) : {
        sobytiya: 0, zapisi: 0, dela: 0, spiski: 0, rashody: 0, dohody: 0,
        pervaya: null, poslednyaya: null, kalendar: false, tema: null,
      }),
    };
  });

  list.sort((a: any, b: any) => String(b.zahodil || '').localeCompare(String(a.zahodil || '')));

  return json({
    vsego: list.length,
    voshli: list.filter((x: any) => x.zahodil).length,
    ne_voshli: list.filter((x: any) => !x.zahodil).length,
    s_zapisyami: list.filter((x: any) => x.sinhronizaciya).length,
    lyudi: list,
  });
});
