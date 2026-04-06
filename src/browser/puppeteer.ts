import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;

export async function launchBrowser(): Promise<Page> {
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  return page;
}

export async function getPage(): Promise<Page> {
  if (!page) throw new Error('Browser not launched. Call launchBrowser() first.');
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

export async function delay(min: number = 3000, max: number = 7000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
