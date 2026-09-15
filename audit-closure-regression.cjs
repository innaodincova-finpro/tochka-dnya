const assert = require('node:assert/strict');
const fs = require('node:fs');

const report = fs.readFileSync('FINAL_AUDIT_REPORT_2026-09-15.md', 'utf8');
for (let item = 1; item <= 15; item++) {
  assert(new RegExp(`\\| ${item} \\|`).test(report), `audit item ${item} missing`);
}
for (let pr = 64; pr <= 79; pr++) {
  assert(report.includes(`/pull/${pr}`), `PR ${pr} missing from final evidence`);
}
for (const limitation of [
  'Полная аварийная репетиция восстановления',
  'Проверка паролей по базе утечек',
  'Полный браузерный тест офлайн-режима'
]) assert(report.includes(limitation), `unresolved limitation missing: ${limitation}`);

assert(report.includes('один критический и четырнадцать важных дефектов закрыты'));
console.log('PASS: final audit maps 15 findings, 16 remediation PRs and three explicit limitations');
