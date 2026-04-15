import { test, expect, type Page } from '@playwright/test';

/**
 * Zplit E2E 綜合測試腳本 (涵蓋群組與個人)
 */

// 輔助函式：透過虛擬數字鍵盤 (CalculatorInput) 輸入金額
async function fillCalculatorInput(page: Page, amountStr: string) {
  const trigger = page.locator('div[role="button"]').filter({ hasText: 'NT$' }).first();
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  
  await page.waitForSelector('button.btn-theme-green');

  const clearBtn = page.getByRole('button', { name: 'C', exact: true });
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
  }

  for (const char of amountStr) {
    if (char >= '0' && char <= '9') {
      await page.getByRole('button', { name: char, exact: true }).click();
    } else if (char === '.') {
      await page.getByRole('button', { name: '.', exact: true }).click();
    }
  }
  
  await page.locator('button.btn-theme-green').filter({ has: page.locator('svg.lucide-corner-down-left') }).click();
  await expect(page.locator('button.btn-theme-green')).not.toBeVisible();
}

async function loginAsAnonymous(page: Page, nickname: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const guestBtn = page.getByRole('button', { name: '免登入開始' });
  if (await guestBtn.isVisible()) {
    await guestBtn.click();
    await page.waitForURL('**/onboarding', { timeout: 20000 });
    await page.getByPlaceholder('輸入你的暱稱').fill(nickname);
    await page.getByRole('button', { name: '完成，開始使用！' }).click();
    await page.waitForURL('**/home');
    await page.locator('.dock').waitFor({ state: 'visible' });
  }
}

test.describe('Zplit Complex E2E: 3 Users, CRUD, and Post-Settlement', () => {
  test.setTimeout(300000);

  test('3-User Group Interaction and Settlement Flow', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    let inviteUrl = '';

    await test.step('User A and B log in', async () => {
      await loginAsAnonymous(pageA, 'UserA_Alpha');
      await loginAsAnonymous(pageB, 'UserB_Beta');
    });

    await test.step('User A creates group and gets invite link', async () => {
      await pageA.getByRole('button', { name: '群組' }).waitFor({ state: 'visible' });
      await pageA.getByRole('button', { name: '群組' }).click({ force: true });
      await pageA.getByRole('button', { name: '建立群組' }).click();
      await pageA.getByPlaceholder('例如：墾丁旅遊 2026').fill('三人測試群組');
      await pageA.locator('.justify-end button').click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
      await pageA.getByRole('tab', { name: '設定' }).click();
      inviteUrl = await pageA.locator('input[readonly]').inputValue();
    });

    await test.step('User B joins directly', async () => {
      await pageB.goto(inviteUrl);
      await pageB.getByRole('button', { name: '加入群組', exact: true }).click();
      await pageB.getByRole('button', { name: '以上都不是，以新成員加入' }).click();
      await pageB.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('User C Flow: Open link -> Register -> Join', async () => {
      await pageC.goto(inviteUrl);
      
      // 1. 直接使用邀請連結開啟瀏覽器 (已經 goto)
      // 2. 打開頁面後，點擊註冊與登入
      await pageC.getByRole('button', { name: '立即登入' }).click();
      await pageC.waitForURL('**/login');
      
      // 3. 開始進行註冊 (使用匿名登入作為註冊流程測試)
      await pageC.getByRole('button', { name: '免登入開始' }).click();
      await pageC.waitForURL('**/onboarding');
      await pageC.getByPlaceholder('輸入你的暱稱').fill('UserC_Gamma');
      await pageC.getByRole('button', { name: '完成，開始使用！' }).click();
      
      // 4. 註冊完後要回到這個群組頁面 (測試 redirect 邏輯)
      await pageC.waitForURL(/\/join\/[a-zA-Z0-9_-]+/);
      
      // 進行加入群組
      await pageC.getByRole('button', { name: '加入群組', exact: true }).click();
      await pageC.getByRole('button', { name: '以上都不是，以新成員加入' }).click();
      await pageC.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('Add and Edit expense (1200 to 1500)', async () => {
      await pageA.getByRole('button', { name: '新增帳務' }).click();
      await pageA.getByPlaceholder('例如：Pizza、計程車...').fill('大餐');
      await fillCalculatorInput(pageA, '1200');
      await pageA.locator('.justify-end button').click();
      
      await pageA.getByText('大餐').first().click();
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-pencil') }).click(); 
      await fillCalculatorInput(pageA, '1500'); 
      await pageA.locator('.justify-end button').click();
      
      await pageA.waitForURL(/\/groups\/.*\/expenses\/.*/);
      // 使用更強健的定位器，並等待數值更新
      await expect(pageA.getByText('1,500', { exact: false })).toBeVisible();
      await pageA.getByRole('button', { name: 'Back' }).click();
    });

    await test.step('Add second expense (User B pays 600)', async () => {
      await pageB.getByRole('button', { name: '新增帳務' }).click();
      await pageB.getByPlaceholder('例如：Pizza、計程車...').fill('交通費');
      await fillCalculatorInput(pageB, '600');
      await pageB.locator('.justify-end button').click();
      await pageB.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('Partial Settlement (User C pays User A)', async () => {
      await pageC.getByRole('tab', { name: '結算' }).click();
      await expect(pageC.getByText('NT$500')).toBeVisible();
      await pageC.locator('button.btn-theme-green').first().click();
      await pageC.getByRole('button', { name: '確認' }).click();
      await expect(pageC.getByText('NT$500')).not.toBeVisible();
    });

    await test.step('Add expense after settlement (User C pays 300)', async () => {
      await pageC.getByRole('tab', { name: '總覽' }).click();
      await pageC.getByRole('button', { name: '新增帳務' }).click();
      await pageC.getByPlaceholder('例如：Pizza、計程車...').fill('飲料');
      await fillCalculatorInput(pageC, '300');
      await pageC.locator('.justify-end button').click();
      await pageC.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('Delete expense', async () => {
      await pageA.getByText('交通費').first().click();
      await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-pencil') }).click();
      await pageA.getByRole('button', { name: '刪除' }).click();
      await pageA.getByRole('button', { name: '刪除', exact: true }).last().click();
      await pageA.waitForURL(/\/groups\/[a-zA-Z0-9_-]+/);
    });

    await test.step('Final Balance Verification', async () => {
      await pageA.getByRole('tab', { name: '結算' }).click();
      await expect(pageA.getByText('應收', { exact: false })).toBeVisible();
      await expect(pageA.getByText('NT$500')).toBeVisible();
      await expect(pageA.getByText('應付', { exact: false })).toBeVisible();
      await expect(pageA.getByText('NT$100')).toBeVisible();
    });

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
