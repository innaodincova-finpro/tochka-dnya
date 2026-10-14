// Run with Node.js and sharp available: node build-theme-icons.cjs
const fs=require('node:fs'),sharp=require('sharp');
const themes={
 light:{name:'Светлая тема',colors:['#28425C','#3E6687','#4E7A9E','#7299B7'],head:'#4E7A9E',ground:'#F4F7FA'},
 dark:{name:'Тёмная тема',colors:['#17121F','#30233F','#4A3568','#684274'],head:'#181421',ground:'#181421'},
 berry:{name:'Сиренево-ягодная',colors:['#5B3F8C','#7C58AA','#AE74B4','#E08CA4'],head:'#7052A5',ground:'#FBF7FC'},
 graphite:{name:'Графит',colors:['#171D24','#26313D','#334656','#416074'],head:'#26313D',ground:'#171D24'},
 blue:{name:'Синий',colors:['#18374F','#244D70','#346B94','#578CAC'],head:'#244D70',ground:'#F0F5FA'},
 forest:{name:'Хвойный',colors:['#193B30','#285749','#3D7360','#65917C'],head:'#285749',ground:'#F1F6F3'}
};
const original=fs.readFileSync('icon.svg','utf8'),base=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const instructions=`<section><h2>iPhone и iPad</h2><ol><li>Откройте эту страницу в Safari.</li><li>Нажмите «Поделиться» → «На экран Домой».</li><li>Проверьте цвет значка и нажмите «Добавить».</li></ol></section>
<section><h2>Android</h2><ol><li>Откройте эту страницу в Chrome.</li><li>В меню ⋮ выберите «Установить приложение» или «Добавить на главный экран».</li><li>Если приложение уже установлено, подтвердите обновление значка, когда браузер его предложит. Цвет меняется после подтверждения.</li></ol></section>
<section><h2>Компьютер</h2><p>В Chrome или Edge воспользуйтесь значком установки в адресной строке. Для уже установленного приложения откройте меню приложения → «Доступно обновление» и подтвердите новый значок, если браузер предлагает обновление.</p></section>
<aside><b>Не удаляйте старый ярлык, пока не проверите записи в новом.</b><p>На iPhone новый ярлык может открыть отдельное хранилище. Перед добавлением проверьте в приложении «Ещё → Мои данные», что облачное сохранение подключено и записи сохранены. В новом ярлыке войдите в тот же аккаунт и проверьте записи. Если пользуетесь без облака, сначала сохраните резервную копию и восстановите её в новом ярлыке.</p><p>Уже установленный ярлык на iPhone не перекрашивается автоматически.</p></aside>`;
(async()=>{fs.mkdirSync('theme-icons',{recursive:true});
for(const [theme,t] of Object.entries(themes)){
 let svg=original;['#5B3F8C','#7C58AA','#AE74B4','#E08CA4'].forEach((c,i)=>svg=svg.replace(c,t.colors[i]));
 if(theme!=='berry')svg=svg.replace('#2E1B4A','#111820').replace('#3A2159','#111820');
 fs.writeFileSync('theme-icons/'+theme+'.svg',svg);
 for(const size of [180,192,512])await sharp(Buffer.from(svg)).resize(size,size).png().toFile('theme-icons/'+theme+'-'+size+'.png');
 const m={...base,start_url:'./index.html?initial-icon-theme='+theme,background_color:t.ground,theme_color:t.head,icons:[180,192,512].map(size=>({src:'theme-icons/'+theme+'-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:size===180?'any':'any maskable'}))};
 fs.writeFileSync('manifest-icon-'+theme+'.webmanifest',JSON.stringify(m,null,2)+'\n');
 const page=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ярлык «Точка дня» — ${t.name}</title><meta name="theme-color" content="${t.head}"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Точка дня"><link rel="apple-touch-icon" sizes="180x180" href="theme-icons/${theme}-180.png"><link rel="icon" href="theme-icons/${theme}-192.png"><link rel="manifest" href="manifest-icon-${theme}.webmanifest"><script>if(navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)){location.replace("./index.html?initial-icon-theme=${theme}");}</script><style>body{margin:0;background:${t.ground};font:16px/1.55 system-ui,sans-serif;color:${['dark','graphite'].includes(theme)?'#F1F5F9':'#223449'}}main{max-width:540px;margin:28px auto;padding:24px}header{display:flex;align-items:center;gap:18px}img{width:88px;height:88px;border-radius:22px}h1{font-size:24px;margin:0}h2{font-size:19px}section,aside{padding:18px;margin:18px 0;border:1px solid ${['dark','graphite'].includes(theme)?'#465462':'#C8D6E3'};border-radius:20px;background:${['dark','graphite'].includes(theme)?'#222B35':'#FFFFFF'}}ol{padding-left:22px}li{margin:8px 0}a{display:block;text-align:center;border-radius:14px;padding:14px;background:${t.head};color:#fff;text-decoration:none}a:focus-visible{outline:3px solid #B08347;outline-offset:3px}@media(max-width:400px){main{padding:16px;margin:12px auto}}</style></head><body><main><header><img src="theme-icons/${theme}-180.png" alt="Ярлык ${t.name}"><div><h1>Точка дня</h1><div>${t.name}</div></div></header><p>Добавьте ярлык этого цвета на главный экран. Выбранный значок будет виден в окне добавления.</p>${instructions}<a href="index.html?initial-icon-theme=${theme}">Открыть приложение</a></main></body></html>`;
 fs.writeFileSync('install-icon-'+theme+'.html',page+'\n');
}
const panels=[];let cell=0;
for(const [theme,t] of Object.entries(themes)){
 const x=(cell%3)*220,y=Math.floor(cell/3)*220;
 panels.push({input:await sharp('theme-icons/'+theme+'-180.png').resize(140,140).toBuffer(),left:x+40,top:y+20});
 panels.push({input:Buffer.from('<svg width="220" height="42" xmlns="http://www.w3.org/2000/svg"><text x="110" y="27" text-anchor="middle" font-family="DejaVu Sans" font-size="17" fill="#223449">'+t.name+'</text></svg>'),left:x,top:y+164});
 cell++;
}
await sharp({create:{width:660,height:440,channels:3,background:'#F4F7FA'}}).composite(panels).png().toFile('theme-icons/preview.png');
console.log('Built six icon palettes, install pages and manifests');})();
