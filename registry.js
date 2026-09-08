const SUPABASE_URL = 'https://dcpthwmuiodrjepifzsd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt';
const ADMIN_EMAIL = 'inna_odincova@mail.ru';
const NEW_USER_GUIDE = "Здравствуйте! Приглашаю вас в мою «Точку дня» — приложение для встреч, дел, заметок и учёта расходов.\n\nЯ подготовила несколько простых шагов, чтобы вам было легче начать.\n\n1. Зайдите по моей ссылке\nОткройте ссылку из этого сообщения. Придумайте пароль не короче 8 символов, введите его дважды и нажмите «Сохранить пароль и открыть приложение».\nЭто ваш новый пароль для «Точки дня». Пароль от почты вводить не нужно.\nЕсли ссылка не открывается или срок её действия закончился — напишите мне, я пришлю новую.\n\n2. Добавьте «Точку дня» на экран iPhone\nОткройте в Safari этот адрес:\nhttps://innaodincova-finpro.github.io/tochka-dnya/\nНажмите «Поделиться» → «На экран Домой» → «Добавить». Если увидите «Открыть как веб-приложение», включите этот пункт.\nНа экране телефона появится значок «Точки дня». Дальше открывайте приложение через него.\nЕсли оно попросит войти, откройте «Ещё» → «Мои данные» и введите почту из приглашения и пароль, который только что придумали.\nНа компьютере можно пользоваться тем же адресом в браузере.\n\n3. Включите напоминания о встречах\nВ приложении откройте «Ещё» → «Напоминания». Нажмите «Включить уведомления», затем «Разрешить».\nПосле этого нажмите «Отправить пробное уведомление» и закройте приложение. Через 1–2 минуты должно прийти сообщение. Если не пришло — напишите мне, помогу разобраться.\nНа iPhone эта возможность работает начиная с iOS 16.4. Календарь Apple подключать не нужно.\n\n4. Запишите свою первую встречу\nВ разделе «План» нажмите «Добавить» и укажите название, дату и время встречи. Сохраните её и дождитесь надписи «сохранено в облаке».\nДобавляйте встречу заранее — больше чем за час до начала. Например, о встрече в 16:30 приложение напомнит в 15:30. Его можно закрыть, но телефон должен быть подключён к интернету.\nЕсли время встречи не указано, напоминания за час не будет.\n\n5. Осваивайтесь в своём темпе\nВ «Сегодня» можно посмотреть свой день, в «Плане» — встречи, в «Заметках» — записывать мысли, дела и списки, в «Финансах» — доходы и расходы.\nЧтобы прочитать заметку целиком, нажмите на неё. Расход можно внести за прошлый день — просто выберите нужную дату.\nЗаписи сохраняются автоматически. После важных изменений дождитесь отметки «сохранено в облаке».\n\nСохраните это сообщение, чтобы при необходимости вернуться к шагам. Ссылка для первого входа предназначена только вам — не пересылайте её другим людям.\n\nЕсли возникнут вопросы, напишите мне, что не получилось. Можно приложить снимок экрана, только без пароля и личной ссылки.\n\nИнна";
function invitationMessage(invitation){
  return 'Я создала для вас доступ к «Точке дня».\nВаша почта для входа: '+(invitation?.email||'')+'\nВаша личная ссылка для первого входа:\n'+(invitation?.url||'')+'\n\n'+NEW_USER_GUIDE;
}

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let people=[],page=1,epoch=0,busy=false,inviting=false;
const size=20;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s&&!isNaN(Date.parse(s))?new Date(s).toLocaleString('ru-RU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Пока нет';
function clearPrivate(){epoch++;people=[];$('rows').replaceChildren();$('summary').textContent='';$('message').value='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('workspace').hidden=true;$('invite').hidden=true;}
async function request(body){
 const {data,error}=await client.auth.getSession();
 if(error||!data.session)throw new Error('Войдите в свой аккаунт «Точки дня».');
 const res=await fetch(SUPABASE_URL+'/functions/v1/kabinet',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await res.json();
 if(!res.ok){if(res.status===401||res.status===403)clearPrivate();throw new Error(result.error||'Не удалось получить сведения. Повторите попытку.');}
 return result;
}
async function refresh(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('notice').textContent='Обновляем список…';const run=epoch;
 try{const data=await request();if(run!==epoch)return;people=Array.isArray(data.lyudi)?data.lyudi:[];$('workspace').hidden=false;$('invite').hidden=false;$('login').hidden=true;render();$('notice').textContent='Обновлено '+date(new Date().toISOString());}
 catch(e){$('notice').textContent=e.message;}
 finally{busy=false;$('refresh').disabled=false;if(run!==epoch)setTimeout(refresh,0);}
}
function render(){
 const guests=people.filter(p=>String(p.pochta).toLowerCase()!==ADMIN_EMAIL);
 $('summary').textContent='Приглашённых: '+guests.length+' · Входили: '+guests.filter(p=>p.zahodil).length+' · Ещё не вошли: '+guests.filter(p=>!p.zahodil).length;
 const q=$('search').value.trim().toLowerCase(),filter=$('filter').value;
 const list=people.filter(p=>String(p.pochta).toLowerCase().includes(q)&&(filter==='all'||(filter==='entered'?!!p.zahodil:!p.zahodil)));
 const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);
 $('rows').innerHTML=list.slice((page-1)*size,page*size).map(p=>'<button class="person" data-index="'+people.indexOf(p)+'"><span class="email">'+esc(p.pochta)+(String(p.pochta).toLowerCase()===ADMIN_EMAIL?' <small>Вы</small>':'')+'</span><span class="status">'+(p.zahodil?'Входил':'Ещё не вошёл')+'</span><span class="desktop">'+esc(date(p.zahodil))+'</span><span class="desktop">'+esc(date(p.sinhronizaciya))+'</span></button>').join('')||'<p class="empty">По вашему запросу никого не найдено.</p>';
 $('pages').textContent='Страница '+page+' из '+pages+' · Найдено: '+list.length;$('prev').disabled=page===1;$('next').disabled=page===pages;
}
$('search').addEventListener('input',()=>{page=1;render()});$('filter').addEventListener('change',()=>{page=1;render()});
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render();$('list-start').scrollIntoView({block:'start'})};$('refresh').onclick=refresh;
$('rows').onclick=e=>{const row=e.target.closest('[data-index]');if(!row)return;const p=people[Number(row.dataset.index)];if(!p)return;$('person-title').textContent=p.pochta;$('details').innerHTML='<dl><dt>Последний вход</dt><dd>'+esc(date(p.zahodil))+'</dd><dt>Последнее облачное сохранение</dt><dd>'+esc(date(p.sinhronizaciya))+'</dd></dl><p>Встречи: '+esc(p.sobytiya||0)+' · Дела: '+esc(p.dela||0)+' · Списки: '+esc(p.spiski||0)+' · Расходы: '+esc(p.rashody||0)+'</p><p class="muted">Время указано по вашему устройству. Тексты личных записей здесь не отображаются. Факт входа не подтверждает получение уведомлений.</p>';$('person-dialog').showModal();};
$('invite').onclick=()=>{$('invite-error').textContent='';$('invite-dialog').showModal();};
$('invite-form').onsubmit=async e=>{e.preventDefault();if(inviting)return;inviting=true;$('create').disabled=true;const run=epoch;
 try{const data=await request({action:'invite',email:$('email').value.trim().toLowerCase()});if(run!==epoch)return;$('message').value=invitationMessage(data);$('invite-dialog').close();$('result-dialog').showModal();$('email').value='';await refresh();}catch(e){$('invite-error').textContent=e.message;}finally{inviting=false;$('create').disabled=false;}};
$('share').onclick=async()=>{try{if(!navigator.share){$('share-status').textContent='Нажмите «Скопировать», затем вставьте приглашение в мессенджер.';return;}await navigator.share({title:'Приглашение в «Точку дня»',text:$('message').value});}catch(e){if(e.name!=='AbortError')$('share-status').textContent='Отправка не открылась. Используйте «Скопировать».';}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('message').value);$('share-status').textContent='Скопировано. Вставьте приглашение в личное сообщение.';}catch{$('message').focus();$('message').select();$('share-status').textContent='Скопируйте выделенный текст.';}};
$('login').onsubmit=async e=>{e.preventDefault();$('sign-in').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await refresh();}catch{$('notice').textContent='Не удалось войти. Проверьте почту и пароль «Точки дня».';}finally{$('sign-in').disabled=false;}};
client.auth.onAuthStateChange((event,session)=>{if(!session){clearPrivate();$('login').hidden=false;$('notice').textContent='Войдите в аккаунт владельца «Точки дня».';}else if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){clearPrivate();setTimeout(refresh,0);}});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
