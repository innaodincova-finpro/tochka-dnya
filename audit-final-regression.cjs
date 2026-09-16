/* Отчёт, который отстал от жизни, вводит в заблуждение так же, как сломанный код.
   Было: отчёт этапа 1 писал «изменения не отправлены и не опубликованы» уже после
   того, как они были приняты в основную линию и выложены на сервер.
   Здесь проверяется, что отчёты называют состояние верно и не теряют пункты. */
const assert = require('node:assert/strict');
const fs = require('node:fs');

const DEPLOYED_SOURCE = '56ea7d6bfc5123f6e374cbb82f011f9771f06760';

/* 1. Отчёт этапа 1: выкладка подтверждена, старое утверждение не вернулось. */
const stage1 = fs.readFileSync('STAGE_1_RELEASE_SECURITY_2026-09-16.md', 'utf8');
for (const stale of [
  'Изменения не отправлены в GitHub и не опубликованы',
  'Исправление ещё не опубликовано',
]) assert(!stage1.includes(stale), `отчёт этапа 1 снова говорит «${stale}», хотя изменение выложено`);
assert(stage1.includes(DEPLOYED_SOURCE), 'отчёт этапа 1 не называет выложенный исходный код');
for (const run of ['35101059795', '35101058703', '35101126271'])
  assert(stage1.includes(run), `отчёт этапа 1 не ссылается на запуск ${run} как на подтверждение`);

/* 2. Закрытие аудита: все пункты заданий A-D на месте со статусом. */
const closure = fs.readFileSync('AUDIT_ZAKRYTIE_2026-09-16.md', 'utf8');
for (const item of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'C1', 'D1', 'D2', 'D3'])
  assert(new RegExp(`\\| ${item} \\|`).test(closure), `в закрытии аудита нет пункта ${item}`);
assert(closure.includes('Принятые ограничения'), 'в закрытии аудита нет раздела принятых ограничений');
assert(
  /Аудит закрыт не полностью|Аудит закрыт полностью|Аудит закрыт с принятыми ограничениями/.test(closure),
  'закрытие аудита не отвечает прямо, закрыт аудит или нет',
);

/* 3. Каждый документ для владельца заканчивается тем, что ему делать. */
for (const file of [
  'STAGE_1_RELEASE_SECURITY_2026-09-16.md',
  'AUDIT_ZAKRYTIE_2026-09-16.md',
  'NASTROYKI_GITHUB.md',
  'NASTROYKI_SUPABASE.md',
  'OWASP_ASVS_L1_2026-09-16.md',
  'VOSSTANOVLENIE_VRUCHNUYU.md',
  'PRIEMKA_BEZ_SETI.md',
]) {
  const text = fs.readFileSync(file, 'utf8');
  assert(text.includes('## Что делать вам'), `${file}: нет блока «Что делать вам»`);
  for (const jargon of ['репозитори', 'коммит', 'ветк']) {
    assert(!new RegExp(jargon, 'i').test(text), `${file}: слово «${jargon}» без перевода на обычные слова`);
  }
}

/* 4. Порядок ручного восстановления называет все три части, которых не было в репетиции. */
const recovery = fs.readFileSync('VOSSTANOVLENIE_VRUCHNUYU.md', 'utf8');
for (const part of ['Учётные записи людей', 'Закрытые ключи серверных функций', 'Загруженные файлы'])
  assert(recovery.includes(part), `в порядке восстановления нет части «${part}»`);

console.log('PASS: отчёты называют состояние верно, пункты A-D на месте, инструкции обычными словами');
