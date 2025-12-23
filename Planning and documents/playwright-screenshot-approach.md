# Playwright Screenshot Verification Strategy

This document summarizes the approach used to verify and debug the JSync UI using Playwright. This method is specifically designed to capture the "real" rendering of the webview, which is crucial for identifying transparency issues, unwanted outlines, or layout shifts that logs cannot reveal.

## 1. The Strategy
Since Tauri apps are composed of a native window shell and a webview, visual bugs often occur at the "seam" between the two. We use a standalone Playwright script to:
*   Directly target the Vite dev server (`http://localhost:1420`).
*   Emulate the exact dimensions and pixel density of the macOS window.
*   Capture high-resolution screenshots to see sub-pixel artifacts like faint outlines.

## 2. The Verification Script (`quick-screenshot.cjs`)
We created a lightweight Node.js script using Playwright Chromium:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 500 }, // Matches tauri.conf.json
    deviceScaleFactor: 2 // Emulates Retina display to see fine outlines
  });

  const page = await context.newPage();
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });

  // Wait for React animations and backdrop-blur to settle
  await page.waitForTimeout(2000);

  const screenshotPath = process.env.HOME + '/Desktop/jsync-ui-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();
})();
```

## 3. Key Parameters for Debugging
*   **`deviceScaleFactor: 2`**: This is critical. Without it, screenshots may look blurry, hiding the "faint square shapes" or "1px lines" that only appear on high-DPI (Retina) screens.
*   **`waitUntil: 'networkidle'`**: Ensures all assets and Tailwind styles are fully loaded.
*   **`viewport`**: Must match the `width` and `height` defined in `src-tauri/tauri.conf.json`.

## 4. Recent Fixes Verified via this Method
*   **Black Outline**: Fixed by setting `"shadow": false` in `tauri.conf.json`.
*   **Transparency Gaps**: Fixed by explicitly calling `setBackgroundColor` and `setOpaque: false` in the native macOS code (`macos_window.rs`).
*   **Container Leaks**: Fixed by ensuring the root React `div` uses `h-full` to prevent the background from trailing off if the content is short.