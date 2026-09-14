const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /function localSaveDetails\(\)/, 'Нет отдельного статуса локального сохранения');
assert.match(html, /На устройстве:/, 'Не показано время сохранения на устройстве');
assert.match(html, /В облаке: не подключено/, 'Не показано состояние отключённого облака');
assert.match(html, /id="cloud-save-details"/, 'Облачный статус не обновляется после синхронизации');
assert.match(html, /Последнее сохранение/, 'В разделе «Ещё» нет понятного заголовка сохранения');
assert.match(html, /const APP_VERSION = '5\.9\.9'/, 'Не обновлена версия приложения');

console.log('✓ Статус локального и облачного сохранения присутствует');
