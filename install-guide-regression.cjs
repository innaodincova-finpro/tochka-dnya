const fs = require('fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

function load({userAgent, platform = '', maxTouchPoints = 0, standalone = false}) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://test.invalid/',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'userAgent', {value: userAgent, configurable: true});
      Object.defineProperty(window.navigator, 'platform', {value: platform, configurable: true});
      Object.defineProperty(window.navigator, 'maxTouchPoints', {value: maxTouchPoints, configurable: true});
      Object.defineProperty(window.navigator, 'standalone', {value: standalone, configurable: true});
      window.scrollTo = () => {};
      window.matchMedia = query => ({matches: standalone && query === '(display-mode: standalone)', addListener() {}});
    }
  });
  return dom;
}

const cases = [
  {
    name: 'iPhone',
    options: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone'},
    expected: /Safari[\s\S]*Поделиться[\s\S]*На экран Домой/,
    unexpected: /Chrome.*Установить приложение/
  },
  {
    name: 'Android',
    options: {userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', platform: 'Linux armv8l'},
    expected: /Chrome[\s\S]*(Установить приложение|Добавить на главный экран)/,
    unexpected: /Safari.*На экран Домой/
  },
  {
    name: 'computer',
    options: {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', platform: 'Win32'},
    expected: /компьютер[\s\S]*(значок установки|меню браузера)/i,
    unexpected: /На экран Домой/
  }
];

for (const testCase of cases) {
  const dom = load(testCase.options);
  try {
    const text = dom.window.eval('installGuideForCurrentDevice()');
    assert.match(text, testCase.expected, `${testCase.name}: показаны подходящие шаги установки`);
    assert.doesNotMatch(text, testCase.unexpected, `${testCase.name}: нет шагов другой платформы`);
  } finally {
    dom.window.close();
  }
}

const installed = load({userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone', standalone: true});
try {
  const text = installed.window.eval('installGuideForCurrentDevice()');
  assert.match(text, /уже установлена/i, 'установленному приложению не предлагают повторную установку');
  assert.doesNotMatch(text, /Поделиться|Установить приложение/, 'нет лишних шагов переустановки');
} finally {
  installed.window.close();
}

const invitation = load({userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32'});
try {
  const message = invitation.window.eval("invitationMessage({email:'person@example.com',url:'https://example.test/invite'})");
  assert.match(message, /iPhone или iPad[\s\S]*Android[\s\S]*компьютер/i, 'приглашение подходит получателю на любой платформе');
} finally {
  invitation.window.close();
}

console.log('PASS: installation guidance matches the recipient device');
