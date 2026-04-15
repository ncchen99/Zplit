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

test.describe('Zplit Complex E2E: 3 Users, CRUD, and Post-Settlement', () => {

  test.setTimeout(300000); // 複雜流程需要更多時間

  test('3-User Group Interaction and Settlement Flow', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    let inviteUrl = '';

    // 1. 登入階段
    await test.step('Three users log in', async () => {
      await loginAsAnonymous(pageA, 'UserA_Alpha');
      await loginAsAnonymous(pageB, 'UserB_Beta');
      await loginAsAnonymous(pageC, 'UserC_Gamma');
    });

    // 2. 建立群組並邀請
    await test.step('User A creates group and invites others', async () => {
      await pageA.getByRole('button', { name: '群組' }).waitFor({ state: 'visible' });
      await pageA.getByRole('button', { name: '群組' }).click({ force: true });
      await pageA.getByRole('button', { name: '建立群組' }).click();

      await pageA.getByPlaceholder('例如：墾丁旅遊 2026').fill('三人測試群組');
      await pageA.locator('.justify-end button').click(); // 儲存

      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      await pageA.getByRole('tab', { name: '設定' }).click();
      inviteUrl = await pageA.locator('input[readonly]').inputValue();
    });

    // 3. B 與 C 加入群組
    await test.step('User B and C join group', async () => {
      for (const page of [pageB, pageC]) {
        await page.goto(inviteUrl);
        await page.getByRole('button', { name: '加入群組', exact: true }).click();
        await page.getByRole('button', { name: '以上都不是，以新成員加入' }).click();
        await page.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      }
    });

    // 4. 初步記帳 (A 支付 1200)
    await test.step('Add initial expense (User A pays 1200)', async () => {
      await pageA.getByRole('button', { name: '新增帳務' }).click();
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('大餐');
      await fillCalculatorInput(pageA, '1200');
      await pageA.locator('.justify-end button').click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    // 5. 編輯帳務 (A 將 1200 改為 1500)
    await test.step('Edit expense (Change 1200 to 1500)', async () => {
      await pageA.getByText('大餐').first().click();
      await pageA.waitForURL(/\/groups\/.*\/expenses\/.*/);
      
      // 點擊編輯 (使用 Pencil 圖示定位)
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-pencil') }).click(); 
      await pageA.waitForURL(/\/groups\/.*\/expense\/.*\/edit/);
      
      await fillCalculatorInput(pageA, '1500');
      await pageA.locator('.justify-end button').click();
      
      // 等待回到詳情頁並驗證金額變動
      await pageA.waitForURL(/\/groups\/.*\/expenses\/.*/);
      await expect(pageA.getByText(/1,500/)).toBeVisible();
      
      // 返回群組首頁
      await pageA.getByRole('button', { name: 'Back' }).click();
    });

    // 6. User B 新增帳務 (B 支付 600)
    await test.step('Add second expense (User B pays 600)', async () => {
      await pageB.getByRole('button', { name: '新增帳務' }).click();
      await pageB.getByPlaceholder('例如：Pizza、計程車...').fill('交通費');
      await fillCalculatorInput(pageB, '600');
      await pageB.locator('.justify-end button').click();
    });

    // 7. 部分結算 (User C 結清給 User A 的欠款)
    // 此時 C 欠 A 500 (1500/3), 欠 B 200 (600/3)
    await test.step('Partial Settlement (User C pays User A)', async () => {
      await pageC.getByRole('tab', { name: '結算' }).click();
      await expect(pageC.getByText('NT$500')).toBeVisible(); // 驗證欠 A 的金額
      
      // 結清給 User A 的那筆 (選取第一個結算按鈕)
      await pageC.locator('button.btn-theme-green').first().click();
      await pageC.getByRole('button', { name: '確認' }).click();
      
      // 驗證 User A 的債務已消失，只剩下給 User B 的債務
      await expect(pageC.getByText('NT$500')).not.toBeVisible();
      await expect(pageC.getByText('NT$200')).toBeVisible();
    });

    // 8. 結算後新增帳務 (User C 支付 300)
    await test.step('Add expense after settlement (User C pays 300)', async () => {
      await pageC.getByRole('tab', { name: '總覽' }).click();
      await pageC.getByRole('button', { name: '新增帳務' }).click();
      await pageC.getByPlaceholder('例如：Pizza、計程車...').fill('飲料');
      await fillCalculatorInput(pageC, '300');
      await pageC.locator('.justify-end button').click();
    });

    // 9. 刪除帳務 (User A 刪除 User B 支付的那筆「交通費」)
    await test.step('Delete expense (Delete User B\'s 600)', async () => {
      await pageA.getByText('交通費').first().click();
      await pageA.waitForURL(/\/groups\/.*\/expenses\/.*/);
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-pencil') }).click(); // 進入編輯頁
      await pageA.waitForURL(/\/groups\/.*\/edit/);
      
      await pageA.getByRole('button', { name: '刪除' }).click();
      await pageA.getByRole('button', { name: '刪除', exact: true }).last().click(); // ConfirmModal 中的確認按鈕
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      await expect(pageA.getByText('交通費')).not.toBeVisible();
    });

    // 10. 最終數學驗證
    // A 支付 1500, C 支付 300, 合計 1800, 每人 600
    // C 已付 A 500
    // 預計 A 的結算頁面：會看到應收 B 的 500，並應付 C 的 100
    await test.step('Final Balance Verification', async () => {
      await pageA.getByRole('tab', { name: '結算' }).click();
      
      // 驗證應收 B 的 500
      await expect(pageA.getByText('應收', { exact: false })).toBeVisible();
      await expect(pageA.getByText('NT$500')).toBeVisible();
      
      // 驗證應付 C 的 100
      await expect(pageA.getByText('應付', { exact: false })).toBeVisible();
      await expect(pageA.getByText('NT$100')).toBeVisible();
    });

    // ----------------------------------------
    // 個人功能測試 (維持原樣或略微調整)
    // ----------------------------------------
    await test.step('Personal Ledger Flow', async () => {
      await pageA.goto('/personal');
      await pageA.getByRole('button', { name: '新增分帳' }).click();
      await pageA.getByPlaceholder('輸入朋友名字...').fill('好友Z');
      await pageA.getByRole('button', { name: /新增/ }).click();
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('借錢');
      await fillCalculatorInput(pageA, '100');
      await pageA.locator('.justify-end button').click();
      await expect(pageA.getByText('+NT$100')).toBeVisible();
    });

  });
});
