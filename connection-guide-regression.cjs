const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8'),registry=fs.readFileSync('registry.js','utf8');
const access=fs.readFileSync('DOSTUP.md','utf8'),guide=fs.readFileSync('user-guide.txt','utf8');
const extract=s=>JSON.parse(s.match(/const NEW_USER_GUIDE = ("[^\n]*");/)[1]);
assert.doesNotMatch(access,/У него появился аккаунт в Supabase/,'вход не описан как самостоятельная регистрация');
for(const text of [guide,extract(html),extract(registry)]){
 assert.match(text,/личную ссылку/,'для подключения нужна личная ссылка');
 assert.doesNotMatch(text,/Проверить уведомление/,'инструкция не предлагает отсутствующую кнопку');
 assert.match(text,/Отправить пробное уведомление/,'имя кнопки соответствует интерфейсу');
 assert.match(text,/установленном приложении/,'проверка облака выполняется после установки');
 assert.match(text,/сохранено в облаке/,'проверяется результат сохранения, а не только вход');
}
assert.match(fs.readFileSync('KABINET.md','utf8'),/после успешного создания приглашения/i);
assert.match(access,/Общая ссылка.*не добавляет.*реестр/i);
console.log('PASS: connection instructions distinguish invitation, installation, login and cloud save; button names match UI');

for(const installed of [false,true]){
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/index.html',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:installed,addListener(){}});Object.defineProperty(w.navigator,'standalone',{value:installed});}});
 try{for(const call of ['userGuideForCurrentDevice()','guideWithInstallSection(INVITATION_INSTALL_GUIDE)']){
  const result=dom.window.eval(call);assert.match(result,/В установленном приложении проверьте/,'адаптированная инструкция сохраняет проверку входа');assert.match(result,/Сохраните первую запись и дождитесь отметки/,'адаптированная инструкция сохраняет проверку облака');
 }}finally{dom.window.close();}
}
console.log('PASS: adapted guides retain login and cloud verification for installed and browser modes');
