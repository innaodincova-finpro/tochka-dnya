const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('index.html', 'utf8');
const activation = fs.readFileSync('activate.html', 'utf8');
const visual = fs.readFileSync('assistant-lab/integration/acceptance/visual/index.html', 'utf8');

for (const [name, source] of [['app', app], ['activation', activation], ['visual fixture', visual]]) {
  assert(source.includes('password.length<12') || source.includes('minlength="12"'), `${name}: 12-character minimum missing`);
  assert(source.includes('[a-zа-яё]'), `${name}: lowercase requirement missing`);
  assert(source.includes('[A-ZА-ЯЁ]'), `${name}: uppercase requirement missing`);
  assert(source.includes('[0-9]'), `${name}: digit requirement missing`);
  assert(source.includes('[^A-Za-zА-Яа-яЁё0-9]'), `${name}: symbol requirement missing`);
}

assert(!activation.includes('не короче 8 символов'), 'activation still promises the old password rule');
assert(app.includes('Пароль — не менее 8 символов'), 'existing users must still be allowed to sign in with an old 8-character password');
assert(app.includes('От 12 символов: большие и маленькие буквы, цифра и знак'), 'password-change guidance is incomplete');

console.log('PASS: new passwords are strong; existing 8-character passwords can still sign in');
