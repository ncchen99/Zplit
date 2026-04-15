import { test, expect, type Page } from '@playwright/test';

/**
 * Zplit E2E 綜合測試腳本 (涵蓋群組與個人)
 * 已根據實際元件與翻譯文字設計
 */

// 輔助函式：透過虛擬數字鍵盤 (CalculatorInput) 輸入金額
async function fillCalculatorInput(page: Page, amountStr: string) {
  // 點擊觸發欄位開啟數字小鍵盤 (div[role="button"] with NT$)
  const trigger = page.locator('div[role="button"]').filter({ hasText: 'NT$' }).first();
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  
  // 等待鍵盤出現 (等待綠色確認按鈕)
  await page.waitForSelector('button.btn-theme-green');

  // 逐一輸入字元
  for (const char of amountStr) {
    if (char >= '0' && char <= '9') {
      await page.getByRole('button', { name: char, exact: true }).click();
    } else if (char === '.') {
      await page.getByRole('button', { name: '.', exact: true }).click();
    }
  }
  
  // 點擊確認 (CornerDownLeft/btn-theme-green 按鈕)
  await page.locator('button.btn-theme-green').filter({ has: page.locator('svg.lucide-corner-down-left') }).click();
  
  // 等待鍵盤收起 (確保遮罩消失)
  await expect(page.locator('button.btn-theme-green')).not.toBeVisible();
}

// 輔助函式：使用免登入進行測試
async function loginAsAnonymous(page: Page, nickname: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const guestBtn = page.getByRole('button', { name: '免登入開始' });
  if (await guestBtn.isVisible()) {
    await guestBtn.click();
    
    // 等待跳轉到 Onboarding
    await page.waitForURL('**/onboarding', { timeout: 20000 });
    
    // Onboarding 填寫暱稱
    await page.getByPlaceholder('輸入你的暱稱').fill(nickname);
    await page.getByRole('button', { name: '完成，開始使用！' }).click();
    
    // 等待進入首頁並確保導航列出現
    await page.waitForURL('**/home');
    await page.locator('.dock').waitFor({ state: 'visible' });
  }
}

test.describe('Zplit E2E Billing and Settlement Tests', () => {

  test.setTimeout(180000); // 增加超時時間

  test('Group Split and Personal Ledger Flow', async ({ browser }) => {
    const contextA = await browser.newContext(); // Creator
    const contextB = await browser.newContext(); // Joiner

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    let inviteUrl = '';

    // ----------------------------------------
    // A. 登入階段
    // ----------------------------------------
    await test.step('User A and User B Log In', async () => {
      await loginAsAnonymous(pageA, 'UserA_Creator');
      await loginAsAnonymous(pageB, 'UserB_Joiner');
    });

    // ----------------------------------------
    // B. 群組功能測試 (Group Flow)
    // ----------------------------------------
    await test.step('User A 創建群組並取得邀請連結', async () => {
      // 確保導航按鈕可見後再點擊
      const groupTabBtn = pageA.getByRole('button', { name: '群組' });
      await groupTabBtn.waitFor({ state: 'visible' });
      await groupTabBtn.click({ force: true });
      
      const createBtn = pageA.getByRole('button', { name: '建立群組' });
      await createBtn.waitFor({ state: 'visible' });
      await createBtn.click();

      await pageA.getByPlaceholder('例如：墾丁旅遊 2026').fill('E2E 測試群組');
      
      // 儲存 (PageHeader 中的 CheckIcon)
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-check') }).click();

      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      
      // 切換到設定分頁讀取邀請連結
      const settingsTab = pageA.getByRole('tab', { name: '設定' });
      await settingsTab.waitFor({ state: 'visible' });
      await settingsTab.click();
      
      const inviteInput = pageA.locator('input[readonly]');
      await expect(inviteInput).toBeVisible();
      inviteUrl = await inviteInput.inputValue();
      expect(inviteUrl).toContain('/join/');
    });

    await test.step('User B 加入群組', async () => {
      await pageB.goto(inviteUrl);
      
      // Step 1: 加入群組 (JoinPage Step 1)
      const joinBtn = pageB.getByRole('button', { name: '加入群組', exact: true });
      await joinBtn.waitFor({ state: 'visible' });
      await joinBtn.click();
      
      // Step 2: 選擇身分 (JoinPage Step 2)
      const newMemberBtn = pageB.getByRole('button', { name: '以上都不是，以新成員加入' });
      await newMemberBtn.waitFor({ state: 'visible' });
      await newMemberBtn.click();
      
      await pageB.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      await expect(pageB.getByText('E2E 測試群組').first()).toBeVisible();
    });

    await test.step('新增分帳: 平均分配', async () => {
      // 從列表進入群組 (點擊首頁或分頁中的群組卡片)
      // 由於 User A 剛剛已經在群組頁面，直接在那邊點擊 FAB
      const addExpenseBtn = pageA.getByRole('button', { name: '新增帳務' });
      await addExpenseBtn.waitFor({ state: 'visible' });
      await addExpenseBtn.click({ force: true });
      
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('晚餐 (平均)');
      await fillCalculatorInput(pageA, '1000');

      // 儲存
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-check') }).click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('新增分帳: 按金額分配', async () => {
      await pageA.getByRole('button', { name: '新增帳務' }).click({ force: true });
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('超市 (金額)');
      await fillCalculatorInput(pageA, '1200');

      // 切換分帳模式 (觸發按鈕的 aria-label 是 "分帳模式")
      await pageA.getByRole('button', { name: '分帳模式' }).click();
      await pageA.getByRole('button', { name: '依金額分帳' }).click();

      // 輸入每個人分配的金額
      const inputs = pageA.locator('input[type="number"]');
      await inputs.nth(0).fill('800');
      await inputs.nth(1).fill('400');
      
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-check') }).click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('新增分帳: 按比例分配', async () => {
      await pageA.getByRole('button', { name: '新增帳務' }).click({ force: true });
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('飲料 (比例)');
      await fillCalculatorInput(pageA, '100');
  
      await pageA.getByRole('button', { name: '分帳模式' }).click();
      await pageA.getByRole('button', { name: '依比例分帳' }).click();
  
      const percentInputs = pageA.locator('input[type="number"]');
      await percentInputs.nth(0).fill('70');
      await percentInputs.nth(1).fill('30');
      
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-check') }).click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('結算功能檢查', async () => {
      const settleTab = pageB.getByRole('tab', { name: '結算' });
      await settleTab.waitFor({ state: 'visible' });
      await settleTab.click();
      
      // 驗證債務金額 (1000/2 + 400 + 30 = 930)
      await expect(pageB.getByText('NT$930')).toBeVisible();

      // 點擊綠色打勾按鈕進行結算
      const confirmBtn = pageB.locator('button.btn-theme-green').filter({ has: pageB.locator('svg.lucide-check') }).first();
      await confirmBtn.click();
      
      // 確認結算 Modal
      await pageB.getByRole('button', { name: '確認' }).click();
      
      // 驗證債務已消失 (顯示所有債務已結清)
      await expect(pageB.getByText('所有債務已結清！')).toBeVisible();
    });

    // ----------------------------------------
    // C. 個人功能測試 (Personal Flow)
    // ----------------------------------------
    await test.step('個人記帳流程測試', async () => {
      // 由於在群組詳情頁中沒有底部導覽列，直接跳轉到個人分頁
      await pageA.goto('/personal');
      await pageA.waitForURL('**/personal');
      
      const addBtn = pageA.getByRole('button', { name: '新增分帳' });
      await addBtn.waitFor({ state: 'visible' });
      await addBtn.click();
      
      await pageA.getByPlaceholder('輸入朋友名字...').fill('測試好友A');
      await pageA.getByRole('button', { name: /新增「測試好友A」為新聯絡人/ }).click();

      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('借書錢');
      await fillCalculatorInput(pageA, '250');
      
      // 點擊存檔 (PageHeader 右側按鈕)
      await pageA.locator('.justify-end button').click();
      
      await pageA.waitForURL('**/personal/*'); // 進入聯絡人詳情頁
      await expect(pageA.getByText('+NT$250')).toBeVisible();

      // 進行結算
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-ellipsis-vertical') }).click();
      await pageA.getByRole('button', { name: '結清所有帳款' }).click();
      await pageA.getByRole('button', { name: '確認' }).click();
      
      await expect(pageA.getByText('已結清').first()).toBeVisible();
    });

  });
});
