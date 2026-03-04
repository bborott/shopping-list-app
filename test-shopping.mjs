import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = `file:///${__dirname.replace(/\\/g, '/')}/shopping-list.html`;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  // localStorage 초기화를 위해 storage 비우기
  const page = await context.newPage();

  // 페이지 열기 → localStorage 수동 초기화
  await page.goto(FILE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 1] 초기 상태 확인');
  // ──────────────────────────────────────────

  const emptyVisible = await page.locator('#empty').isVisible();
  assert(emptyVisible, '빈 상태 메시지가 표시됨');

  const listItems = await page.locator('#list li').count();
  assert(listItems === 0, '초기 리스트가 비어있음');

  const stats = await page.locator('#statsText').textContent();
  assert(stats.trim() === '총 0개', '초기 통계: 총 0개');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 2] 아이템 추가 (버튼 클릭)');
  // ──────────────────────────────────────────

  await page.fill('#itemInput', '사과');
  await page.click('button[title="추가"]');
  await page.waitForTimeout(100);

  let count = await page.locator('#list li').count();
  assert(count === 1, '아이템 1개 추가됨');

  const firstItemText = await page.locator('.item-text').first().textContent();
  assert(firstItemText === '사과', '추가된 아이템 텍스트: 사과');

  const inputVal = await page.inputValue('#itemInput');
  assert(inputVal === '', '추가 후 입력창 초기화됨');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 3] 아이템 추가 (Enter 키)');
  // ──────────────────────────────────────────

  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(100);

  count = await page.locator('#list li').count();
  assert(count === 2, 'Enter 키로 아이템 추가됨 (총 2개)');

  await page.fill('#itemInput', '우유');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(100);

  count = await page.locator('#list li').count();
  assert(count === 3, '아이템 3개로 증가함');

  const statsAfterAdd = await page.locator('#statsText').textContent();
  assert(statsAfterAdd.includes('총 3개'), '통계에 총 3개 표시됨');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 4] 빈 입력 추가 방지');
  // ──────────────────────────────────────────

  await page.fill('#itemInput', '   ');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(100);

  count = await page.locator('#list li').count();
  assert(count === 3, '공백만 있는 입력은 추가되지 않음');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 5] 체크(완료) 기능');
  // ──────────────────────────────────────────

  // 가장 첫 번째 아이템 체크 (가장 마지막에 추가된 우유)
  const firstCheckbox = page.locator('#list li input[type="checkbox"]').first();
  await firstCheckbox.click();
  await page.waitForTimeout(100);

  const firstLiDone = await page.locator('#list li').first().getAttribute('class');
  assert(firstLiDone && firstLiDone.includes('done'), '체크 시 done 클래스 추가됨');

  const statsWithDone = await page.locator('#statsText').textContent();
  assert(statsWithDone.includes('완료 1개'), '완료 1개 통계 반영됨');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 6] 체크 해제 (토글)');
  // ──────────────────────────────────────────

  await firstCheckbox.click();
  await page.waitForTimeout(100);

  const firstLiUndone = await page.locator('#list li').first().getAttribute('class');
  assert(!firstLiUndone || !firstLiUndone.includes('done'), '체크 해제 시 done 클래스 제거됨');

  const statsUndone = await page.locator('#statsText').textContent();
  assert(statsUndone.includes('완료 0개'), '완료 0개로 통계 복구됨');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 7] 아이템 삭제');
  // ──────────────────────────────────────────

  const countBefore = await page.locator('#list li').count();
  const firstDeleteBtn = page.locator('.delete-btn').first();
  await firstDeleteBtn.click();
  await page.waitForTimeout(100);

  const countAfter = await page.locator('#list li').count();
  assert(countAfter === countBefore - 1, `삭제 후 아이템 수 감소 (${countBefore} → ${countAfter})`);

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 8] 완료 항목 일괄 삭제');
  // ──────────────────────────────────────────

  // 남은 아이템 모두 체크
  const checkboxes = page.locator('#list li input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  for (let i = 0; i < cbCount; i++) {
    await checkboxes.nth(i).click();
    await page.waitForTimeout(50);
  }

  await page.click('.clear-done');
  await page.waitForTimeout(100);

  const countAfterClear = await page.locator('#list li').count();
  assert(countAfterClear === 0, '완료 항목 일괄 삭제 후 리스트 비어있음');

  const emptyVisibleAgain = await page.locator('#empty').isVisible();
  assert(emptyVisibleAgain, '빈 상태 메시지 다시 표시됨');

  // ──────────────────────────────────────────
  console.log('\n🧪 [테스트 9] localStorage 영속성');
  // ──────────────────────────────────────────

  await page.fill('#itemInput', '영속성 테스트 아이템');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(100);

  // 페이지 새로고침
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(100);

  const countAfterReload = await page.locator('#list li').count();
  assert(countAfterReload === 1, 'localStorage: 새로고침 후 아이템 유지됨');

  const persistedText = await page.locator('.item-text').first().textContent();
  assert(persistedText === '영속성 테스트 아이템', 'localStorage: 저장된 텍스트 일치');

  // ──────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(`📊 테스트 결과: 통과 ${passed}개 / 실패 ${failed}개 / 총 ${passed + failed}개`);
  if (failed === 0) {
    console.log('🎉 모든 테스트를 통과했습니다!');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다. 위 내용을 확인하세요.');
  }
  console.log('══════════════════════════════════════\n');

  await page.waitForTimeout(2000); // 결과 확인을 위해 잠시 대기
  await browser.close();
}

runTests().catch(err => {
  console.error('테스트 실행 오류:', err);
  process.exit(1);
});