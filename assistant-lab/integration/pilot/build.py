from pathlib import Path
import re
root=Path.cwd()
out=root/'pilot'
s=(root/'index.html').read_text()
s=s.replace("const KEY = 'tochka-dnya-v3';", "const KEY = 'tochka-dnya-owner-pilot-v1';")
s=s.replace('<script src="supabase.js"></script>', '<script src="/tochka-dnya/supabase.js"></script><script src="pilot-gate.js"></script>')
s=s.replace("    const access=await cloudClient.rpc('tochka_visit');", "    await window.pilotGate(user,cloudClient,()=>epoch===cloudEpoch);\n    if(epoch!==cloudEpoch)return;\n    const access=await cloudClient.rpc('tochka_visit');")
s=s.replace("if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){", 'if (false){')
s=re.sub(r'<link rel="manifest"[^>]*>', '', s)
s=s.replace('href="icon-', 'href="/tochka-dnya/icon-')
s=s.replace('<title>Точка дня</title>', '<title>Точка дня · Проверка помощника</title>')
s=s.replace('<body>', '''<body><aside style="position:relative;z-index:1;max-width:520px;margin:auto;padding:12px;background:#f1ebf8;color:#302a3d;box-sizing:border-box;font:14px/1.5 sans-serif"><strong>Проверка помощника · только для владельца</strong><div>Здесь ваши настоящие облачные записи. Подтверждённые изменения появятся и в обычной «Точке дня».</div><p id="pilot-status" role="status">Для начала войдите в «Мои данные». Копия будет создана автоматически перед синхронизацией.</p><button type="button" onclick="goScreen('s-more');toggleFold('more-cloud')">Мои данные</button> <button type="button" onclick="openAssistantImport()">Встречи помощника</button> <button id="pilot-backup" type="button" hidden>Скачать исходную копию</button><div><a href="/tochka-dnya/">Обычная «Точка дня»</a></div></aside>''')
# Welcome is not needed for an already registered owner and can cover sign-in.
s=s.replace("if (!S.settings.onboarded && !/type=recovery/.test(location.hash))", "if (false)")
(out/'index.html').write_text(s)
for name in ['assistant-import.js','assistant-panel.js']:(out/name).write_text((root/name).read_text())
assert s.count('await window.pilotGate(')==1
