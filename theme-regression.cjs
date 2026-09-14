const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /option value="light"[^>]*>Светлая тема<\/option>/, 'Нет светлой темы');
assert.match(html, /option value="dark"[^>]*>Тёмная тема<\/option>/, 'Нет тёмной темы');
assert.match(html, /option value="berry"[^>]*>Сиренево-ягодная<\/option>/, 'Нет дополнительной темы');
assert.match(html, /\[data-theme="light"\]\{/, 'Светлая палитра не отделена');
assert.match(html, /selected === 'dark' \|\| selected === 'berry'/, 'Дополнительная тема не применяется');
assert.match(html, /theme === 'berry' \? '#7052A5'/, 'Цвет панели телефона не меняется вместе с темой');
assert.match(html, /const APP_VERSION = '5\.9\.8'/, 'Не обновлена версия приложения');

console.log('✓ Доступны светлая, тёмная и сиренево-ягодная темы');
