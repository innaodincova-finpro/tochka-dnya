/* Проверка описаний: внутренние ссылки не должны вести в пустоту.
   Раньше README указывал на supabase/KALENDAR.md, а файл лежал в корне. */
const fs = require('fs'), path = require('path');
let bad = [];
fs.readdirSync('.').filter(f => f.endsWith('.md')).forEach(f => {
  const text = fs.readFileSync(f, 'utf8');
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const t = m[2];
    if (t.startsWith('http') || t.startsWith('#')) continue;
    if (!fs.existsSync(path.join(path.dirname(f), t))) bad.push(f + ' → ' + t);
  }
});
if (bad.length){ console.error('Битые ссылки в описаниях:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('Ссылки в описаниях: все на месте.');
