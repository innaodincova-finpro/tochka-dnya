const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/',pretendToBeVisual:true,beforeParse(w){w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){}});w.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';}});
const w=dom.window,run=s=>w.eval(s);let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('OK '+m);};
async function main(){
 await new Promise(r=>setTimeout(r,180));
 run("clearTimeout(cloudTimer);S=blank();S.settings.onboarded=1;S.notes=[{id:'n1',date:'2026-09-13',kind:'note',text:'Рецепт аджики'}];renderAll();");
 ok(run("NOTE_TABS.some(x=>x[0]==='document')"),'есть отдельная вкладка Документы');
 run("setNotesTab('document')");
 run("cloudUser={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};curScreen='s-notes';openContext()");
 ok(w.document.querySelector('#sheet h3')?.textContent==='Новый документ','кнопка Добавить открывает загрузку файла во вкладке Документы');
 run("closeSheet();cloudUser=null");
 ok(run("S.notes.length===1&&S.notes[0].text==='Рецепт аджики'"),'переход не меняет существующие заметки');
 ok(w.document.getElementById('s-notes').textContent.includes('закрытом облаке'),'без входа объяснено закрытое облако');
 ok(run("allowedDocument({name:'scan.pdf',type:'application/pdf',size:10})"),'PDF разрешён');
 ok(run("allowedDocument({name:'contract.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:10})"),'Word разрешён');
 ok(run("allowedDocument({name:'photo.jpg',type:'image/jpeg',size:10})"),'фотография разрешена');
 ok(!run("allowedDocument({name:'script.html',type:'text/html',size:10})"),'неподдерживаемый тип отклонён');
 run("cloudUser={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};documentsState='ready';documents=[{id:'d1',title:'Паспорт',original_name:'scan.pdf',object_path:'a/d1/original.pdf',mime_type:'application/pdf',size_bytes:2048,created_at:'2026-09-13T10:00:00Z'}];noteQuery='пас';renderNotes();");
 ok(w.document.getElementById('s-notes').textContent.includes('Паспорт'),'поиск находит документ по названию');
 run("noteQuery='содержимое';renderNotes();");
 ok(!w.document.getElementById('s-notes').textContent.includes('Паспорт'),'первая версия не ищет по содержимому');
 ok(/grid-template-columns:repeat\(4/.test(html),'четыре вкладки помещаются в одну строку');
 console.log('Документы: '+checks+' проверок пройдено.');dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
