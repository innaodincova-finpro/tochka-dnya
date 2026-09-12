'use strict';
const BASE='https://dcpthwmuiodrjepifzsd.supabase.co';
const KEY='sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt';
const $=id=>document.getElementById(id);
const errors={sign_in_required:'Войдите заново.',owner_only:'Проверка доступна только владельцу. Убедитесь, что указана почта из настройки TOCHKA_ASSISTANT_OWNER_EMAIL.',server_not_configured:'Проверьте, сохранена ли почта владельца в настройках сервера.',invalid_bot_token_format:'Токен сохранён не полностью или с лишними символами. Проверьте его в настройках Supabase.',wrong_bot:'Сохранён токен другого бота. Нужен токен @Inna_Assistant_bot.',telegram_check_failed:'Telegram не подтвердил токен. Проверьте токен или повторите позже.',connection_check_unavailable:'Сейчас нет соединения с сервисом проверки. Попробуйте позже.'};
$('login').addEventListener('submit',async e=>{
 e.preventDefault();if($('submit').disabled)return;$('submit').disabled=true;$('result').hidden=true;$('status').textContent='Проверяем вход…';let access=null;
 try{
  const body=JSON.stringify({email:$('email').value.trim(),password:$('password').value});$('password').value='';
  const login=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body,signal:AbortSignal.timeout(15000)});
  const data=await login.json();if(!login.ok||!data.access_token){$('status').textContent=login.status===429?'Слишком много попыток. Подождите и повторите.':'Не удалось войти. Проверьте почту и пароль «Точки дня».';return}access=data.access_token;
  $('status').textContent='Проверяем токен бота…';
  const res=await fetch(BASE+'/functions/v1/tochka-assistant-setup',{headers:{apikey:KEY,authorization:'Bearer '+access},signal:AbortSignal.timeout(20000)});const result=await res.json();
  if(!res.ok){$('status').textContent=errors[result.error]||'Проверка пока не выполнена. Сообщите об этой ошибке.';return}
  if(result.token==='missing'){$('status').textContent='Токен ещё не найден. Сохраните TOCHKA_ASSISTANT_BOT_TOKEN в настройках Supabase.';return}
  if(result.token!=='verified'){$('status').textContent='Подключение пока не подтверждено.';return}
  $('result').hidden=false;$('status').textContent='Проверка завершена успешно.';
 }catch{$('status').textContent='Не удалось связаться с сервером. Проверьте интернет и повторите.'}
 finally{
  if(access){try{await fetch(BASE+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:KEY,authorization:'Bearer '+access},signal:AbortSignal.timeout(5000)})}catch{}}
  access=null;$('password').value='';$('submit').disabled=false;
 }
});
