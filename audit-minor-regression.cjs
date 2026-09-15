const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('index.html','utf8');
const calendar=fs.readFileSync('supabase/functions/kalendar/index.ts','utf8');

assert.match(app,/Текущие записи будут удалены на этом устройстве, в облаке и на других подключённых устройствах/);
assert.match(app,/Это действие нельзя отменить/);
assert.match(app,/\(hasUserData\(S\) \|\| cloudUser\) && !window\.confirm/);
assert.match(calendar,/'cache-control': 'private, no-store, max-age=0'/);
assert.doesNotMatch(calendar,/'cache-control': 'public/);

console.log('PASS: restore warns about every copy; personal calendar is never publicly cached');
