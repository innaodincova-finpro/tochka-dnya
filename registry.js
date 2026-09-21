const SUPABASE_URL = 'https://dcpthwmuiodrjepifzsd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt';
const NEW_USER_GUIDE = "Здравствуйте! Приглашаю вас в мою «Точку дня» — приложение для встреч, дел, заметок и учёта расходов.\n\nЯ подготовила несколько простых шагов, чтобы вам было легче начать.\n\n1. Зайдите по моей ссылке\nОткройте личную ссылку из этого сообщения в браузере. Придумайте пароль от 12 символов — с большой и маленькой буквой, цифрой и знаком, затем введите его дважды и нажмите «Сохранить пароль и открыть приложение».\nЭто ваш новый пароль для «Точки дня». Пароль от почты вводить не нужно.\nЕсли сервис входа недоступен через мобильную сеть, переключитесь на Wi‑Fi или включите VPN и повторите с этой же ссылкой.\n\n2. Установите или откройте «Точку дня»\niPhone или iPad: откройте https://innaodincova-finpro.github.io/tochka-dnya/ в Safari, нажмите «Поделиться» → «На экран Домой» → «Добавить».\nAndroid: откройте этот адрес в Chrome, нажмите меню ⋮ → «Установить приложение» или «Добавить на главный экран».\nНа компьютере: откройте адрес в браузере.\nЕсли приложение попросит войти, откройте «Ещё» → «Мои данные» и используйте почту из приглашения и созданный пароль.\n\n3. Включите напоминания о встречах\nВ приложении откройте «Ещё» → «Напоминания». Нажмите «Включить уведомления», затем «Разрешить».\nПосле этого нажмите «Проверить уведомление» и закройте приложение. Через 1–2 минуты должно прийти сообщение. Если не пришло — напишите мне, помогу разобраться.\nНа iPhone эта возможность работает начиная с iOS 16.4.\n\n4. Запишите свою первую встречу\nВ разделе «План» нажмите «Добавить» и укажите название, дату и время встречи. Сохраните её и дождитесь надписи «сохранено в облаке».\nДобавляйте встречу заранее — больше чем за час до начала. Например, о встрече в 16:30 приложение напомнит в 15:30.\n\n5. Осваивайтесь в своём темпе\nВ «Сегодня» можно посмотреть свой день, в «Плане» — встречи, в «Заметках» — записывать мысли, дела и списки, в «Финансах» — доходы и расходы. Записи сохраняются автоматически. После важных изменений дождитесь отметки «сохранено в облаке».\n\nСохраните это сообщение. Личная ссылка предназначена только вам — не пересылайте её другим людям. Не отправляйте Инне пароль или личную ссылку; для диагностики достаточно снимка экрана без этих данных.\n\nИнна";
function invitationMessage(invitation){
  if(invitation?.existing)return 'Доступ к «Точке дня» открыт.\nПочта: '+invitation.email+'\nОткройте '+invitation.url+'\nВ разделе «Ещё» → «Мои данные» войдите с существующим паролем аккаунта. Если забыли пароль, нажмите «Забыли пароль».\nДанные других приложений сохраняются.';
  return 'Я создала для вас доступ к «Точке дня».\nВаша почта для входа: '+(invitation?.email||'')+'\nВаша личная ссылка для первого входа:\n'+(invitation?.url||'')+'\n\n'+NEW_USER_GUIDE;
}

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let people=[],page=1,epoch=0,busy=false,inviting=false,refreshAgain=false,selectedPerson=null,deleting=false;
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
 finally{busy=false;$('refresh').disabled=false;if(refreshAgain){refreshAgain=false;setTimeout(refresh,0);}}
}
function render(){
 const guests=people.filter(p=>!p.eto_vladelets);
 $('summary').textContent='Приглашённых: '+guests.length+' · Входили: '+guests.filter(p=>p.zahodil).length+' · Ещё не вошли: '+guests.filter(p=>!p.zahodil).length;
 const q=$('search').value.trim().toLowerCase(),filter=$('filter').value;
 const list=people.filter(p=>String(p.pochta).toLowerCase().includes(q)&&(filter==='all'||(filter==='entered'?!!p.zahodil:!p.zahodil)));
 const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);
 $('rows').innerHTML=list.slice((page-1)*size,page*size).map(p=>'<button class="person" data-index="'+people.indexOf(p)+'"><span class="email">'+esc(p.pochta)+(p.eto_vladelets?' <small>Вы</small>':'')+'</span><span class="status">'+(p.zahodil?'Входил':'Ещё не вошёл')+'</span><span class="desktop">'+esc(date(p.zahodil))+'</span><span class="desktop">'+esc(date(p.sinhronizaciya))+'</span></button>').join('')||'<p class="empty">По вашему запросу никого не найдено.</p>';
 $('pages').textContent='Страница '+page+' из '+pages+' · Найдено: '+list.length;$('prev').disabled=page===1;$('next').disabled=page===pages;
}
$('search').addEventListener('input',()=>{page=1;render()});$('filter').addEventListener('change',()=>{page=1;render()});
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render();$('list-start').scrollIntoView({block:'start'})};$('refresh').onclick=refresh;
$('rows').onclick=e=>{const row=e.target.closest('[data-index]');if(!row)return;const p=people[Number(row.dataset.index)];if(!p)return;selectedPerson=p;$('person-title').textContent=p.pochta;$('details').innerHTML='<dl><dt>Первое приглашение</dt><dd>'+esc(date(p.priglashen))+'</dd><dt>Последняя выдача приглашения</dt><dd>'+esc(date(p.poslednee_priglashenie))+'</dd><dt>Последняя активность в «Точке дня»</dt><dd>'+esc(date(p.zahodil))+'</dd><dt>Последнее облачное сохранение</dt><dd>'+esc(date(p.sinhronizaciya))+'</dd></dl><p>Встречи: '+esc(p.sobytiya||0)+' · Дела: '+esc(p.dela||0)+' · Списки: '+esc(p.spiski||0)+' · Расходы: '+esc(p.rashody||0)+'</p><p class="muted">Время указано по вашему устройству. Тексты личных записей здесь не отображаются. Активность учитывается только в «Точке дня» и не подтверждает получение уведомлений.</p>';$('person-actions').hidden=!p.mozhno_udalit;$('reinvite').hidden=!!p.zahodil;$('person-error').textContent='';$('person-dialog').showModal();};
$('invite').onclick=()=>{$('invite-error').textContent='';$('invite-dialog').showModal();};
$('invite-form').onsubmit=async e=>{e.preventDefault();if(inviting)return;inviting=true;$('create').disabled=true;const run=epoch;
 try{const data=await request({action:'invite',email:$('email').value.trim().toLowerCase()});if(run!==epoch)return;$('message').value=invitationMessage(data);$('invite-dialog').close();$('result-dialog').showModal();$('email').value='';await refresh();}catch(e){$('invite-error').textContent=e.message;}finally{inviting=false;$('create').disabled=false;}};
$('share').onclick=async()=>{try{if(!navigator.share){$('share-status').textContent='Нажмите «Скопировать», затем вставьте приглашение в мессенджер.';return;}await navigator.share({title:'Приглашение в «Точку дня»',text:$('message').value});}catch(e){if(e.name!=='AbortError')$('share-status').textContent='Отправка не открылась. Используйте «Скопировать».';}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('message').value);$('share-status').textContent='Скопировано. Вставьте приглашение в личное сообщение.';}catch{$('message').focus();$('message').select();$('share-status').textContent='Скопируйте выделенный текст.';}};
$('login').onsubmit=async e=>{e.preventDefault();$('sign-in').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await refresh();}catch{$('notice').textContent='Не удалось войти. Проверьте почту и пароль «Точки дня».';}finally{$('sign-in').disabled=false;}};
client.auth.onAuthStateChange((event,session)=>{if(!session){clearPrivate();$('login').hidden=false;$('notice').textContent='Войдите в аккаунт владельца «Точки дня».';}else if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){clearPrivate();setTimeout(()=>{if(busy)refreshAgain=true;else refresh();},0);}});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

$('reinvite').onclick=()=>{if(!selectedPerson||deleting)return;$('email').value=selectedPerson.pochta;$('person-dialog').close();$('invite-error').textContent='';$('invite-dialog').showModal();};
$('remove-pending').onclick=async()=>{
 const p=selectedPerson;if(!p||deleting||!p.mozhno_udalit)return;
 if(!confirm('Удалить '+p.pochta+' из «Точки дня»? Облачные записи и напоминания «Точки дня» будут удалены, облачный доступ закрыт. Данные «Кабинета студента» сохранятся. Локальные копии на устройствах остаются. Позже доступ можно выдать заново.'))return;
 deleting=true;const run=epoch;$('remove-pending').disabled=true;$('reinvite').disabled=true;$('person-error').textContent='';
 try{
   await request({action:'remove_access',email:p.pochta,user_id:p.id,confirm_email:p.pochta});
   if(run!==epoch)return;$('person-dialog').close();
   people=people.filter(x=>x.id!==p.id);render();await refresh();
 }catch(e){if(run===epoch)$('person-error').textContent=e.message;}
 finally{deleting=false;$('remove-pending').disabled=false;$('reinvite').disabled=false;}
};
