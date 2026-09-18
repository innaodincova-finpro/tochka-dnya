const fs = require('fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const tinyFont = /font(?:-size)?\s*:\s*(?:[^;}]*\s)?([7-9])px\b/g;
const matches = [...html.matchAll(tinyFont)].map(match => match[0]);

assert.deepEqual(matches, [], 'в интерфейсе нет пользовательского текста размером 7–9 px');
assert.match(html, /\.continuous-cal \.day-preview\{[^}]*font:500 10px\/1\.25/s,
  'подписи календаря читаются размером не менее 10 px');

console.log('PASS: user-visible text is not rendered at 7–9 px');
