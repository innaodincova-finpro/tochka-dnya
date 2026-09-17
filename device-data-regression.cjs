const fs = require('fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

async function makeWindow(confirmResult = true) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://test.invalid/',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.confirm = () => confirmResult;
      window.scrollTo = () => {};
      window.matchMedia = () => ({matches: false, addListener() {}});
    }
  });
  await new Promise(resolve => setTimeout(resolve, 180));
  return dom;
}

async function main() {
  const dom = await makeWindow();
  const window = dom.window;
  const run = source => window.eval(source);

  run(`
    clearTimeout(cloudTimer);
    S = blank();
    S.settings.onboarded = 1;
    S.settings.cloudOwner = 'owner-a';
    S.notes.push({id:'local-note', date:today(), text:'Локальная запись'});
    saveQuiet();
    localStorage.setItem(KEY + ':base:owner-a', JSON.stringify(S));
    localStorage.setItem(KEY + ':account:owner-a', JSON.stringify(S));
    localStorage.setItem(KEY + ':conflict:owner-a:1', JSON.stringify(S));
    localStorage.setItem('another-application', 'keep');
    cloudUser = {id:'owner-a', email:'owner@example.test'};
    cloudReady = true;
    cloudState = 'synced';
    globalThis.disabledPush = 0;
    globalThis.signedOut = 0;
    globalThis.syncedBeforeDelete = 0;
    disablePush = async () => { disabledPush++; };
    pushCloud = async () => { syncedBeforeDelete++; cloudState = 'synced'; };
    cloudClient = {auth:{signOut:async options => {
      signedOut++;
      globalThis.signOutScope = options.scope;
      return {error:null};
    }}};
  `);

  assert.match(run('foldOpen["more-cloud"]=true; renderMore(); document.getElementById("s-more").innerHTML'), /Удалить данные с этого устройства/);
  await run('deleteDeviceData()');

  assert.equal(run('syncedBeforeDelete'), 1, 'перед удалением выполняется облачная синхронизация');
  assert.equal(run('disabledPush'), 1, 'push отключён до удаления локальных данных');
  assert.equal(run('signedOut'), 1, 'локальная сессия завершена');
  assert.equal(run('signOutScope'), 'local', 'другие устройства остаются в аккаунте');
  assert.equal(run('Object.keys(localStorage).filter(key => key === KEY || key.startsWith(KEY + ":")).length'), 0, 'локальные данные приложения удалены');
  assert.equal(run('localStorage.getItem("another-application")'), 'keep', 'чужие данные браузера не затронуты');
  assert.equal(run('S.notes.length'), 0, 'память текущей вкладки очищена');
  assert.equal(run('cloudUser'), null, 'аккаунт отключён на текущем устройстве');
  dom.window.close();

  const cancelled = await makeWindow(false);
  cancelled.window.eval(`
    clearTimeout(cloudTimer);
    S = blank();
    S.notes.push({id:'keep-note', date:today(), text:'Не удалять'});
    saveQuiet();
    globalThis.called = 0;
    disablePush = async () => { called++; };
  `);
  await cancelled.window.eval('deleteDeviceData()');
  assert.equal(cancelled.window.eval('called'), 0, 'отмена не запускает удаление');
  assert.equal(cancelled.window.eval('JSON.parse(localStorage.getItem(KEY)).notes[0].id'), 'keep-note', 'при отмене запись остаётся');
  cancelled.window.close();

  console.log('PASS: device-only deletion syncs first, signs out locally, removes only Tochka data and honours cancellation');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
