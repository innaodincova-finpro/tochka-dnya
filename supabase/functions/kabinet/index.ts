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
    if (!['invite','remove_access'].includes(input.action) || target.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
      return json({error:'Введите корректный адрес почты'},400);
    const existing=users.find(u=>String(u.email||'').toLowerCase()===target);

    async function manage(id:string, action:string){
      const result=await fetch(SUPABASE_URL+'/rest/v1/rpc/tochka_manage_access',{
        method:'POST',headers:{apikey:SERVICE_KEY,Authorization:req.headers.get('authorization')!,'Content-Type':'application/json'},
        body:JSON.stringify({p_user_id:id,p_email:target,p_action:action})
      });
      return result.ok;
    }
    if(input.action==='remove_access'){
      if(target===ADMIN || !existing || input.user_id!==existing.id || input.confirm_email!==target)
        return json({error:'Пользователь изменился. Обновите список.'},409);
      if(!await manage(existing.id,'remove'))return json({error:'Не удалось удалить доступ. Обновите список и повторите.'},409);
      return json({deleted:true,email:target});
    }
    if(target===ADMIN)return json({error:'У владельца уже есть доступ.'},409);
    if(existing && (existing.email_confirmed_at || existing.last_sign_in_at)){
      if(!await manage(existing.id,'grant'))return json({error:'Не удалось предоставить доступ. Повторите позже.'},502);
      return json({email:target,existing:true,url:'https://innaodincova-finpro.github.io/tochka-dnya/index.html'});
    }
    const res=await fetch(SUPABASE_URL+'/auth/v1/admin/generate_link',{
      method:'POST',headers:{...head,'Content-Type':'application/json'},body:JSON.stringify({type:'invite',email:target})
    });
    if(!res.ok)return json({error:'Не удалось создать приглашение. Повторите позже.'},502);
    const link=await res.json();
    if(!link.hashed_token || link.verification_type!=='invite')return json({error:'Сервис не вернул приглашение'},502);
    const invited=link.user?.id || link.id || existing?.id;
    if(!invited || !await manage(invited,'grant'))return json({error:'Приглашение не завершено. Повторите выдачу ссылки.'},502);
    return json({email:target,url:'https://innaodincova-finpro.github.io/tochka-dnya/activate.html#token='+encodeURIComponent(link.hashed_token)+'&email='+encodeURIComponent(target)});
  }

  const dRes = await fetch(SUPABASE_URL + '/rest/v1/user_app_data?select=user_id,payload,updated_at', { headers: head });
  if(!dRes.ok)return json({error:'Данные о сохранениях недоступны. Повторите позже.'},502);
  const rows = await dRes.json();
  const byId: Record<string, any> = {};
  (Array.isArray(rows) ? rows : []).forEach((r: any) => { byId[r.user_id] = r; });

  const mRes=await fetch(SUPABASE_URL+'/rest/v1/tochka_members?revoked_at=is.null&select=user_id,invited_at,last_seen_at',{headers:head});
  if(!mRes.ok)return json({error:'Список доступа недоступен. Повторите позже.'},502);
  const members=await mRes.json();
  if(!Array.isArray(members))return json({error:'Некорректный список доступа'},502);
  const membership=new Map(members.map((m:any)=>[m.user_id,m]));
  const list = users.filter((u:any)=>membership.has(u.id)).map((u: any) => {
    const member:any=membership.get(u.id);
    const row = byId[u.id];
    return {
      id: u.id,
      mozhno_udalit: String(u.email||'').toLowerCase()!==ADMIN,
      poslednee_priglashenie: member.invited_at || null,
      pochta: u.email,
      priglashen: member.invited_at || null,
      podtverdil: u.email_confirmed_at || u.confirmed_at || null,
      zahodil: member.last_seen_at || null,
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

