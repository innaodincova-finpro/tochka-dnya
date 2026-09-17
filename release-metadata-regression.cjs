const fs = require('fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const appVersion = html.match(/const APP_VERSION = '([^']+)'/)?.[1];

assert.equal(appVersion, packageJson.version, 'версия интерфейса совпадает с package.json');
assert.match(serviceWorker, new RegExp(`tochka-dnya-v${packageJson.version.replace(/\./g, '\\.')}[^']*'`),
  'кэш service worker использует ту же версию');
assert.doesNotMatch(html, /const APP_UPDATED\s*=|обновлено '\+APP_UPDATED/,
  'интерфейс не показывает вручную записанную устаревающую дату обновления');

console.log('PASS: release version is consistent and no fake update date is shown');
