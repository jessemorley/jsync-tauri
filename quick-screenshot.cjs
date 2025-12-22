#!/usr/bin/env node
const { chromium } = require('playwright');

(async () => {
  console.log('📸 Taking screenshot...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 400, height: 600 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const screenshotPath = process.env.HOME + '/Desktop/jsync-ui-screenshot.png';
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  await browser.close();
  console.log('✅ Screenshot saved to:', screenshotPath);
})();
