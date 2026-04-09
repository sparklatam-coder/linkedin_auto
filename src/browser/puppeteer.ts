import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;

export async function launchBrowser(): Promise<Page> {
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // 실제 브라우저 크기 사용
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // 자동화 감지 방지
      '--window-size=1280,900',
    ],
  });
  page = await browser.newPage();

  // navigator.webdriver 숨기기
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
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

// 사람처럼 랜덤 딜레이
export async function delay(min: number = 3000, max: number = 7000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 사람처럼 마우스 이동
export async function humanMove(page: Page): Promise<void> {
  const x = 200 + Math.floor(Math.random() * 800);
  const y = 200 + Math.floor(Math.random() * 400);
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
  await delay(300, 800);
}

// 사람처럼 스크롤
export async function humanScroll(page: Page): Promise<void> {
  const distance = 200 + Math.floor(Math.random() * 400);
  await page.evaluate((d) => window.scrollBy(0, d), distance);
  await delay(500, 1500);
}

// 사람처럼 타이핑 (속도 변동)
export async function humanType(page: Page, text: string): Promise<void> {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 30 + Math.floor(Math.random() * 100) });
    // 가끔 긴 멈춤 (생각하는 것처럼)
    if (Math.random() < 0.05) await delay(500, 1500);
  }
}
